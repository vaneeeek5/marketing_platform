import { NextRequest, NextResponse } from "next/server";
import { getSheetData, updateRow } from "@/lib/googleSheets";
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

    // Check if normalized is valid string before split
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
        // Exact match in minutes (ignoring seconds roughly if minutes match? Or exact?)
        // User requested: "Math.abs(leadTimeMinutes - excelTimeMinutes) === 0"
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
        const excelLeads = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Fetch current sheet data
        const googleLeads = await getSheetData(CURRENT_MONTH_SHEET);

        let matchedCount = 0;
        let p1Count = 0;
        let p2Count = 0;
        let p3Count = 0;
        let notMatched = 0;

        // Process sequentially
        for (const excelLead of excelLeads) {
            // Пропустить если нет целевого статуса (пустые строки) as per request
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
                // User said: "Не обновляем сумму продажи, если её нет в Excel"
                // And in code example: only "Целевой" and "Квалификация" inside updateLeadInSheets
                // But in text "Сумма продажи" was mentioned before. 
                // Let's stick to the code example provided in the prompt:
                // "Целевой": excelLead["Целевой"], "Квалификация": excelLead["Квалификация"]

                const update: any = {};
                if (newQual !== undefined) update["Квалификация"] = newQual;
                if (newTarget !== undefined) update["Целевой"] = newTarget;

                // Let's add sales if present just in case, consistent with previous task, unless explicitly forbidden?
                // The prompt says: "Не обновляем сумму продажи, если её нет в Excel" -> implied update if present.
                if (excelLead["Сумма продажи"] !== undefined) {
                    update["Сумма продажи"] = excelLead["Сумма продажи"];
                }

                if (Object.keys(update).length > 0) {
                    await updateRow(CURRENT_MONTH_SHEET, result.lead.rowIndex, update);
                    console.log(`✓ Сверено (приоритет ${result.priority}): ${excelLead["Дата"]} ${excelLead["Время"]} ${excelLead["Кампания"]}`);
                }
            } else {
                notMatched++;
                console.log(`✗ НЕ НАЙДЕНО: ${excelLead["Дата"]} ${excelLead["Время"]} ${excelLead["Кампания"]}`);
            }
        }

        return NextResponse.json({
            success: true,
            total: excelLeads.length,
            uploaded: excelLeads.length,
            matched: matchedCount,
            notMatched: excelLeads.length - matchedCount, // Consistent with prompt code
            breakdown: {
                exact: p1Count,
                timeRange: p2Count, // Renamed to timeRange as per prompt
                singleDay: p3Count  // Renamed to singleDay as per prompt
            },
            // Keep old keys for backward compatibility if frontend uses them
            priority1: p1Count,
            priority2: p2Count,
            priority3: p3Count
        });

    } catch (error) {
        console.error("Archive merge error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to merge archive" },
            { status: 500 }
        );
    }
}
