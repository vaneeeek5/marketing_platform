import { NextRequest, NextResponse } from "next/server";
import { getSheetData, updateRow, updateRowsBatch } from "@/lib/googleSheets";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";
import * as XLSX from "xlsx";

function parseExcelDate(dateStr: any): string | null {
    // "01.12.2025" -> "2025-12-01"
    if (!dateStr) return null;

    const str = dateStr.toString().trim();

    // Если формат "DD.MM.YYYY"
    if (str.includes('.')) {
        const [day, month, year] = str.split('.');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Если уже "YYYY-MM-DD"
    return str;
}

function parseExcelTime(timeStr: any): string | null {
    // "0:00:00" -> "00:00:00"
    // "4:50:00" -> "04:50:00"
    if (!timeStr && timeStr !== 0) return null;

    const str = timeStr.toString().trim();
    const parts = str.split(':');

    if (parts.length === 3) {
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1].padStart(2, '0');
        const seconds = parts[2].padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    return str;
}

function normalizeTime(timeStr: any): number {
    // "04:50:33" -> минуты от начала дня: 4*60 + 50 = 290
    if (!timeStr && timeStr !== 0) return 0;

    const normalized = parseExcelTime(timeStr);
    if (!normalized) return 0;

    const parts = normalized.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    return hours * 60 + minutes;
}

function normalizeCampaign(campaign: any): string {
    // "РСЯ" -> "рся", "МК" -> "мк"
    return campaign?.toString().toLowerCase().trim() || "";
}

function findMatchingLead(excelLead: any, googleLeads: any[]) {
    const excelDate = parseExcelDate(excelLead["Дата"]);
    const excelTimeMinutes = normalizeTime(excelLead["Время"]);
    const excelCampaign = normalizeCampaign(excelLead["Кампания"]);

    if (!excelDate) return null;

    // Приоритет 1: Точное совпадение (дата + время + кампания)
    let match = googleLeads.find(lead => {
        if (parseExcelDate(lead["Дата"]) !== excelDate) return false;
        if (normalizeCampaign(lead["Кампания"]) !== excelCampaign) return false;

        const leadTimeMinutes = normalizeTime(lead["Время"]);
        return Math.abs(leadTimeMinutes - excelTimeMinutes) === 0;
    });

    if (match) return { lead: match, priority: 1 };

    // Приоритет 2: ±10 минут (дата + время±10мин + кампания)
    match = googleLeads.find(lead => {
        if (parseExcelDate(lead["Дата"]) !== excelDate) return false;
        if (normalizeCampaign(lead["Кампания"]) !== excelCampaign) return false;

        const leadTimeMinutes = normalizeTime(lead["Время"]);
        const diff = Math.abs(leadTimeMinutes - excelTimeMinutes);
        return diff > 0 && diff <= 10;
    });

    if (match) return { lead: match, priority: 2 };

    // Приоритет 3: Единственный за день (дата + кампания, если только 1 лид)
    const sameDayCampaign = googleLeads.filter(lead =>
        parseExcelDate(lead["Дата"]) === excelDate &&
        normalizeCampaign(lead["Кампания"]) === excelCampaign
    );

    if (sameDayCampaign.length === 1) {
        return { lead: sameDayCampaign[0], priority: 3 };
    }

    return null;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Use raw: false to ensure we get formatted strings for Date/Time
        const excelLeads = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as any[];

        // Получить текущие лиды из Google Sheets
        const googleLeads = await getSheetData(CURRENT_MONTH_SHEET);

        let matchedCount = 0;
        let p1Count = 0;
        let p2Count = 0;
        let p3Count = 0;
        let notMatched = 0;

        // Collect all updates first
        const pendingUpdates: Array<{ rowIndex: number, data: Record<string, string> }> = [];

        for (const excelLead of excelLeads) {
            // Пропустить если нет целевого статуса (пустые строки)
            if (!excelLead["Целевой"]) continue;

            const result = findMatchingLead(excelLead, googleLeads);

            if (result) {
                // Update stats
                matchedCount++;
                if (result.priority === 1) p1Count++;
                else if (result.priority === 2) p2Count++;
                else if (result.priority === 3) p3Count++;

                // Prepare update
                const newQual = excelLead["Квалификация"];
                const newTarget = excelLead["Целевой"];

                const updateData: Record<string, string> = {};
                if (newQual !== undefined) updateData["Квалификация"] = newQual;
                if (newTarget !== undefined) updateData["Целевой"] = newTarget;

                if (excelLead["Сумма продажи"] !== undefined) {
                    updateData["Сумма продажи"] = excelLead["Сумма продажи"];
                }

                if (Object.keys(updateData).length > 0) {
                    pendingUpdates.push({
                        rowIndex: result.lead.rowIndex,
                        data: updateData
                    });
                }
            } else {
                notMatched++;
                console.log(`✗ НЕ НАЙДЕНО: ${excelLead["Дата"]} ${excelLead["Время"]} ${excelLead["Кампания"]}`);
            }
        }

        // BATCH PROCESSING
        const BATCH_SIZE = 50;
        let processedCount = 0;

        for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
            const batch = pendingUpdates.slice(i, i + BATCH_SIZE);

            // Retry logic
            let retries = 0;
            const MAX_RETRIES = 3;
            let success = false;

            while (!success && retries < MAX_RETRIES) {
                try {
                    await updateRowsBatch(CURRENT_MONTH_SHEET, batch);
                    success = true;
                    processedCount += batch.length;
                    console.log(`✓ Processed batch ${i / BATCH_SIZE + 1} (${batch.length} rows)`);
                } catch (err: any) {
                    console.error(`Batch error (attempt ${retries + 1}):`, err);
                    retries++;
                    if (retries < MAX_RETRIES) {
                        const delay = Math.pow(2, retries) * 1000;
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            }

            if (!success) {
                console.error(`Failed to process batch after ${MAX_RETRIES} retries. Skipping.`);
            }

            // Delay between batches to respect rate limits
            if (i + BATCH_SIZE < pendingUpdates.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        return NextResponse.json({
            success: true,
            total: excelLeads.length,
            matched: matchedCount,
            updated: processedCount,
            notMatched: excelLeads.length - matchedCount,
            breakdown: {
                exact: p1Count,
                timeRange: p2Count,
                singleDay: p3Count
            }
        });

    } catch (error) {
        console.error("Archive merge error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to merge archive" },
            { status: 500 }
        );
    }
}
