import { NextRequest, NextResponse } from "next/server";
import { getSheetData, updateRow, updateRowsBatch } from "@/lib/googleSheets";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";
import * as XLSX from "xlsx";

function parseExcelDate(dateStr: any): string | null {
    // "01.12.2025" -> "2025-12-01"
    // "01.12.2025 14:30:00" -> "2025-12-01"
    if (!dateStr) return null;

    let str = dateStr.toString().trim();

    // Remove time part if present
    if (str.includes(' ')) {
        str = str.split(' ')[0];
    }

    // Если формат "DD.MM.YYYY"
    if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length >= 3) {
            const day = parts[0];
            const month = parts[1];
            const year = parts[2];
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }

    // Если уже "YYYY-MM-DD" or Excel serial date (if xlsx raw=false failed to format)
    // But we used raw=false, so it should be string.

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


// --- Helper Functions ported from transform_amo_table.py ---

function findColumn(headers: string[], searchTerms: string[]): string | undefined {
    return headers.find(h => {
        const lowerH = h.toLowerCase();
        // AND logic for search terms in a single string (space separated in my thought, but let's accept array)
        // actually searchTerms is array of keywords that ALL must be present? Or ANY?
        // The python script had specific logic.
        // Date: 'дата' AND 'создан'
        // Stage: 'этап' OR 'статус'

        // Let's make it flexible. 
        // If searchTerms has multiple items, let's say we need ALL of them?
        // Wait, the python script logic was:
        // if 'дата' in col.lower() and 'создан' in col.lower():

        return searchTerms.every(term => lowerH.includes(term.toLowerCase()));
    });
}

function findStageColumn(headers: string[]): string | undefined {
    return headers.find(h => {
        const lower = h.toLowerCase();
        return lower.includes('этап') || lower.includes('статус') || lower.includes('stage') || lower.includes('status');
    });
}

function findCampaignColumn(headers: string[]): string | undefined {
    return headers.find(h => {
        const lower = h.toLowerCase();
        return lower.includes('utm_campaign') || lower.includes('utm_source') || lower.includes('campaign') || lower.includes('кампания');
    });
}

function extractCampaign(row: any, campaignCol: string | null): string {
    // 1. Try explicit campaign column if mapped
    let campaign = "";

    // Check common known keys first (priority to specific utm keys)
    const campaignKeys = ['utm_campaign', 'utm_source', 'campaign', 'Кампания'];
    for (const key of campaignKeys) {
        if (row[key]) {
            campaign = String(row[key]);
            break;
        }
    }

    // Fallback to detected campaign column
    if (!campaign && campaignCol && row[campaignCol]) {
        campaign = String(row[campaignCol]);
    }

    if (campaign) {
        campaign = campaign.replace(/[{}]/g, '').toLowerCase();

        // Mapping from script
        if (campaign.includes('рся')) return 'рся';
        if (campaign.includes('mk3') || campaign.includes('мк3')) return 'мк3';
        if (campaign.includes('kviz') || campaign.includes('квиз')) {
            if (campaign.includes('mk') || campaign.includes('мк')) return 'мкквиз';
            return 'квиз';
        }
        if (campaign.includes('поиск') || campaign.includes('search')) return 'поиск';
        if (['мк', 'mk'].includes(campaign)) return 'мк';

        return campaign;
    }

    // 2. Try REFERER
    if (row['REFERER']) {
        const referer = String(row['REFERER']).toLowerCase();
        if (referer.includes('kviz') || referer.includes('квиз')) return 'квиз';
        if (referer.includes('complection')) return 'рся';
    }

    return 'неизвестно';
}

function extractTargetStatus(stage: any): string {
    if (!stage) return 'целевой'; // Default per script

    const stageStr = String(stage).toLowerCase();

    // Priority checks
    if (stageStr.includes('спам')) return 'СПАМ';
    if (stageStr.includes('дубль')) return 'дубль';
    if (stageStr.includes('недозвон')) return 'недозвон';
    if (stageStr.includes('не берет трубку') || stageStr.includes('не берёт трубку')) return 'не было в такое время лида';

    // Target keywords
    const activeKeywords = ['контакт', 'квалифицирован', 'встреча', 'кп', 'отложили',
        'согласовано', 'переговоры', 'презентация'];
    if (activeKeywords.some(w => stageStr.includes(w))) return 'целевой';

    // Closed but target
    if (stageStr.includes('закрыто')) {
        const targetCloseReasons = ['не квал', 'не актуальна', 'конкурент',
            'нет денег', 'не подходит', 'отказ'];
        if (targetCloseReasons.some(r => stageStr.includes(r))) return 'целевой';
    }

    return 'целевой';
}

function extractQualification(stage: any): string {
    if (!stage) return 'обычный';

    const stageStr = String(stage).toLowerCase();

    // Explicit qualified
    if (stageStr.includes('квалифицирован') && !stageStr.includes('не квал')) return 'квал';

    // Double/No answer
    if (stageStr.includes('дубль') || stageStr.includes('недозвон')) return 'дубль';

    // Closed
    if (stageStr.includes('закрыто')) return 'закрыто';

    return 'обычный';
}


function matchLead(normalizedRow: any, googleLeads: any[]) {
    if (!normalizedRow.date) return null;

    // Приоритет 1: Точное совпадение (дата + время + кампания)
    let match = googleLeads.find(lead => {
        if (parseExcelDate(lead["Дата"]) !== normalizedRow.date) return false;
        if (normalizeCampaign(lead["Кампания"]) !== normalizedRow.campaign) return false;

        const leadTimeMinutes = normalizeTime(lead["Время"]);
        return Math.abs(leadTimeMinutes - normalizedRow.timeMinutes) === 0;
    });

    if (match) return { lead: match, priority: 1 };

    // Приоритет 2: ±10 минут
    match = googleLeads.find(lead => {
        if (parseExcelDate(lead["Дата"]) !== normalizedRow.date) return false;
        if (normalizeCampaign(lead["Кампания"]) !== normalizedRow.campaign) return false;

        const leadTimeMinutes = normalizeTime(lead["Время"]);
        const diff = Math.abs(leadTimeMinutes - normalizedRow.timeMinutes);
        return diff > 0 && diff <= 10;
    });

    if (match) return { lead: match, priority: 2 };

    // Приоритет 3: Единственный за день
    const sameDayCampaign = googleLeads.filter(lead =>
        parseExcelDate(lead["Дата"]) === normalizedRow.date &&
        normalizeCampaign(lead["Кампания"]) === normalizedRow.campaign
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

        // Identify Columns
        const headers = Object.keys(excelLeads[0] || {});

        const dateColumn = findColumn(headers, ['дата', 'создан']) || "Дата создания";
        const stageColumn = findStageColumn(headers) || "Этап сделки";
        const campaignColumn = findCampaignColumn(headers) || "utm_campaign";
        const timeColumn = headers.find(h => {
            const lower = h.toLowerCase();
            return lower.includes('время') || lower.includes('time');
        }) || "Время";

        console.log(`Detected columns - Date: ${dateColumn}, Time: ${timeColumn}, Stage: ${stageColumn}, Campaign: ${campaignColumn}`);

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
            // Apply transformation logic
            const rawDate = excelLead[dateColumn];
            const rawStage = excelLead[stageColumn];

            // If strictly creating date fails, we might skip. But parseExcelDate is robust-ish.
            const parsedDate = parseExcelDate(rawDate);
            if (!parsedDate) continue; // Skip invalid dates

            // Normalize
            const normalizedRow = {
                date: parsedDate,
                // Time might be in date column or separate "Время". 
                // Script says: df[date_column].dt.strftime('%H:%M:%S'). 
                // So if "Время" col exists use it, otherwise extract from date?
                // The script actually extracted time from the datetime object.
                // In Excel JSON, if it's a datetime string, we can try to parse time.
                timeMinutes: 0,
                campaign: extractCampaign(excelLead, campaignColumn),
                target: extractTargetStatus(rawStage),
                qualification: extractQualification(rawStage),
                amount: excelLead["Бюджет"] || excelLead["Сумма"] || excelLead["Сумма продажи"] || "" // Try to find amount
            };

            // Fix time extraction
            // If rawDate is "01.12.2025 14:30:00", we need 14:30.
            // If there is a separate "Время" column, use it.
            if (excelLead[timeColumn]) {
                normalizedRow.timeMinutes = normalizeTime(excelLead[timeColumn]);
            } else if (typeof rawDate === 'string' && rawDate.includes(':')) {
                // Try parse time from date string
                // "18.01.2025 15:47:06"
                const parts = rawDate.split(' ');
                if (parts.length > 1) {
                    normalizedRow.timeMinutes = normalizeTime(parts[1]);
                }
            }

            // Match
            const result = matchLead(normalizedRow, googleLeads);

            if (result) {
                // Update stats
                matchedCount++;
                if (result.priority === 1) p1Count++;
                else if (result.priority === 2) p2Count++;
                else if (result.priority === 3) p3Count++;

                // Prepare update
                const updateData: Record<string, string> = {};

                // Only update if changed? Or always overwrite? 
                // Script doesn't specify deeply, just "updates".
                // Let's overwrite target/qual.
                updateData["Квалификация"] = normalizedRow.qualification;
                updateData["Целевой"] = normalizedRow.target;

                if (normalizedRow.amount) {
                    updateData["Сумма продажи"] = String(normalizedRow.amount);
                }

                if (Object.keys(updateData).length > 0) {
                    pendingUpdates.push({
                        rowIndex: result.lead.rowIndex,
                        data: updateData
                    });
                }
            } else {
                notMatched++;
                // console.log(`✗ НЕ НАЙДЕНО: ${normalizedRow.date} ${normalizedRow.timeMinutes} ${normalizedRow.campaign}`);
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
            breaking: {
                exact: p1Count,
                timeRange: p2Count,
                singleDay: p3Count
            },
            debugInfo: {
                firstRowRaw: excelLeads[0],
                firstRowNormalized: excelLeads.length > 0 ? {
                    date: parseExcelDate(excelLeads[0][dateColumn]),
                    time: excelLeads[0][timeColumn] ? normalizeTime(excelLeads[0][timeColumn]) : "n/a",
                    campaign: extractCampaign(excelLeads[0], campaignColumn)
                } : null,
                detectedColumns: { date: dateColumn, time: timeColumn, stage: stageColumn, campaign: campaignColumn }
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
