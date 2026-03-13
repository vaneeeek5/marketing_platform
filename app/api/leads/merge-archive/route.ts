export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

function parseExcelDate(dateStr: any): string | null {
    if (!dateStr) return null;
    let str = dateStr.toString().trim();
    if (str.includes(' ')) {
        str = str.split(' ')[0];
    }
    if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length >= 3) {
            const day = parts[0];
            const month = parts[1];
            const year = parts[2];
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
    return str;
}

function parseExcelTime(timeStr: any): string | null {
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
    if (!timeStr && timeStr !== 0) return 0;
    const normalized = parseExcelTime(timeStr);
    if (!normalized) return 0;
    const parts = normalized.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    return hours * 60 + minutes;
}

function normalizeCampaign(campaign: any): string {
    return campaign?.toString().toLowerCase().trim() || "";
}

function findColumn(headers: string[], searchTerms: string[]): string | undefined {
    return headers.find(h => {
        const lowerH = h.toLowerCase();
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
    let campaign = "";
    const campaignKeys = ['utm_campaign', 'utm_source', 'campaign', 'Кампания'];
    for (const key of campaignKeys) {
        if (row[key]) {
            campaign = String(row[key]);
            break;
        }
    }
    if (!campaign && campaignCol && row[campaignCol]) {
        campaign = String(row[campaignCol]);
    }
    if (campaign) {
        campaign = campaign.replace(/[{}]/g, '').toLowerCase();
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
    if (row['REFERER']) {
        const referer = String(row['REFERER']).toLowerCase();
        if (referer.includes('kviz') || referer.includes('квиз')) return 'квиз';
        if (referer.includes('complection')) return 'рся';
    }
    return 'неизвестно';
}

function extractTargetStatus(stage: any): string {
    if (!stage) return 'целевой'; 
    const stageStr = String(stage).toLowerCase();
    if (stageStr.includes('спам')) return 'СПАМ';
    if (stageStr.includes('дубль')) return 'дубль';
    if (stageStr.includes('недозвон')) return 'недозвон';
    if (stageStr.includes('не берет трубку') || stageStr.includes('не берёт трубку')) return 'не было в такое время лида';
    const activeKeywords = ['контакт', 'квалифицирован', 'встреча', 'кп', 'отложили', 'согласовано', 'переговоры', 'презентация'];
    if (activeKeywords.some(w => stageStr.includes(w))) return 'целевой';
    if (stageStr.includes('закрыто')) {
        const targetCloseReasons = ['не квал', 'не актуальна', 'конкурент', 'нет денег', 'не подходит', 'отказ'];
        if (targetCloseReasons.some(r => stageStr.includes(r))) return 'целевой';
    }
    return 'целевой';
}

function extractQualification(stage: any): string {
    if (!stage) return 'обычный';
    const stageStr = String(stage).toLowerCase();
    if (stageStr.includes('квалифицирован') && !stageStr.includes('не квал')) return 'квал';
    if (stageStr.includes('дубль') || stageStr.includes('недозвон')) return 'дубль';
    if (stageStr.includes('закрыто')) return 'закрыто';
    return 'обычный';
}

function matchLead(normalizedRow: any, dbLeads: any[]) {
    if (!normalizedRow.date) return null;

    let match = dbLeads.find(lead => {
        const lDate = lead.date.toISOString().split('T')[0];
        const lTime = lead.date.toISOString().split('T')[1].substring(0,8);
        if (lDate !== normalizedRow.date) return false;
        if (normalizeCampaign(lead.campaign) !== normalizedRow.campaign) return false;
        const leadTimeMinutes = normalizeTime(lTime);
        return Math.abs(leadTimeMinutes - normalizedRow.timeMinutes) === 0;
    });

    if (match) return { lead: match, priority: 1 };

    match = dbLeads.find(lead => {
        const lDate = lead.date.toISOString().split('T')[0];
        const lTime = lead.date.toISOString().split('T')[1].substring(0,8);
        if (lDate !== normalizedRow.date) return false;
        if (normalizeCampaign(lead.campaign) !== normalizedRow.campaign) return false;
        const leadTimeMinutes = normalizeTime(lTime);
        const diff = Math.abs(leadTimeMinutes - normalizedRow.timeMinutes);
        return diff > 0 && diff <= 10;
    });

    if (match) return { lead: match, priority: 2 };

    const sameDayCampaign = dbLeads.filter(lead => {
        const lDate = lead.date.toISOString().split('T')[0];
        return lDate === normalizedRow.date && normalizeCampaign(lead.campaign) === normalizedRow.campaign
    });

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

        const project = await prisma.project.findFirst();
        if (!project) return NextResponse.json({ success: false, error: "Project not found" }, { status: 400 });

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const excelLeads = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as any[];

        const headers = Object.keys(excelLeads[0] || {});

        const dateColumn = findColumn(headers, ['дата', 'создан']) || "Дата создания";
        const stageColumn = findStageColumn(headers) || "Этап сделки";
        const campaignColumn = findCampaignColumn(headers) || "utm_campaign";
        const timeColumn = headers.find(h => h.toLowerCase().includes('время') || h.toLowerCase().includes('time')) || "Время";

        console.log(`Detected columns - Date: ${dateColumn}, Time: ${timeColumn}, Stage: ${stageColumn}, Campaign: ${campaignColumn}`);

        // Получить текущие лиды из БД
        const dbLeads = await prisma.lead.findMany({ where: { projectId: project.id } });

        let matchedCount = 0;
        let p1Count = 0;
        let p2Count = 0;
        let p3Count = 0;
        let notMatched = 0;

        const pendingUpdates: Array<{ id: string, data: any }> = [];

        for (const excelLead of excelLeads) {
            const rawDate = excelLead[dateColumn];
            const rawStage = excelLead[stageColumn];

            const parsedDate = parseExcelDate(rawDate);
            if (!parsedDate) continue; 

            const normalizedRow = {
                date: parsedDate,
                timeMinutes: 0,
                campaign: extractCampaign(excelLead, campaignColumn),
                target: extractTargetStatus(rawStage),
                qualification: extractQualification(rawStage),
                amount: excelLead["Бюджет"] || excelLead["Сумма"] || excelLead["Сумма продажи"] || ""
            };

            if (excelLead[timeColumn]) {
                normalizedRow.timeMinutes = normalizeTime(excelLead[timeColumn]);
            } else if (typeof rawDate === 'string' && rawDate.includes(':')) {
                const parts = rawDate.split(' ');
                if (parts.length > 1) {
                    normalizedRow.timeMinutes = normalizeTime(parts[1]);
                }
            }

            const result = matchLead(normalizedRow, dbLeads);

            if (result) {
                matchedCount++;
                if (result.priority === 1) p1Count++;
                else if (result.priority === 2) p2Count++;
                else if (result.priority === 3) p3Count++;

                const updateData: any = {};
                updateData.qualification = normalizedRow.qualification;
                updateData.status = normalizedRow.target;

                if (normalizedRow.amount) {
                    updateData.saleAmount = parseFloat(String(normalizedRow.amount).replace(/[^\d.]/g, "")) || 0;
                }

                if (Object.keys(updateData).length > 0) {
                    pendingUpdates.push({
                        id: result.lead.id,
                        data: updateData
                    });
                }
            } else {
                notMatched++;
            }
        }

        // BATCH PROCESSING
        const BATCH_SIZE = 50;
        let processedCount = 0;

        for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
            const batch = pendingUpdates.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(update => 
                prisma.lead.update({ where: { id: update.id }, data: update.data })
            ));
            
            processedCount += batch.length;
            console.log(`✓ Processed batch ${i / BATCH_SIZE + 1} (${batch.length} rows)`);
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
