import { NextRequest, NextResponse } from "next/server";
import { getSheetData, updateRow } from "@/lib/googleSheets";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";
import * as XLSX from "xlsx";

function timeToMinutes(timeString: string | number): number {
    if (typeof timeString === 'number') {
        // Excel serial time (fraction of day)
        return Math.round(timeString * 24 * 60);
    }
    const str = String(timeString || "").trim();
    if (!str) return 0;

    // "14:53:33" -> 14*60 + 53 = 893 минут
    const parts = str.split(':');
    const hours = parseInt(parts[0] || "0", 10);
    const minutes = parseInt(parts[1] || "0", 10);
    return hours * 60 + minutes;
}

function findMatchingLead(archiveLead: any, currentLeads: any[]) {
    const archiveDate = archiveLead["Дата"] || archiveLead["Date"];
    const archiveTime = archiveLead["Время"] || archiveLead["Time"];
    const archiveCampaign = archiveLead["Кампания"] || archiveLead["Campaign"];

    if (!archiveDate || !archiveCampaign) return null;

    // 1. ТОЧНОЕ СОВПАДЕНИЕ (приоритет 1)
    let match = currentLeads.find(lead =>
        String(lead["Дата"]).trim() === String(archiveDate).trim() &&
        String(lead["Время"]).trim() === String(archiveTime).trim() &&
        String(lead["Кампания"]).trim() === String(archiveCampaign).trim()
    );
    if (match) return { lead: match, priority: 1 };

    // 2. СОВПАДЕНИЕ С ПОГРЕШНОСТЬЮ ВРЕМЕНИ (приоритет 2)
    const archiveTimeMinutes = timeToMinutes(archiveTime);
    // Find all potential candidates first to pick best or just first?
    // User logic: "match = currentLeads.find" -> first match.
    match = currentLeads.find(lead => {
        if (String(lead["Дата"]).trim() !== String(archiveDate).trim()) return false;
        if (String(lead["Кампания"]).trim() !== String(archiveCampaign).trim()) return false;

        const leadTimeMinutes = timeToMinutes(lead["Время"]);
        const diff = Math.abs(archiveTimeMinutes - leadTimeMinutes);
        return diff <= 10;
    });
    if (match) return { lead: match, priority: 2 };

    // 3. СОВПАДЕНИЕ ПО ДАТЕ И КАМПАНИИ (приоритет 3)
    const sameDayCampaign = currentLeads.filter(lead =>
        String(lead["Дата"]).trim() === String(archiveDate).trim() &&
        String(lead["Кампания"]).trim() === String(archiveCampaign).trim()
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Fetch current sheet data
        const currentRows = await getSheetData(CURRENT_MONTH_SHEET);

        let matchedCount = 0;
        let p1Count = 0;
        let p2Count = 0;
        let p3Count = 0;
        let notMatched = 0;

        // Process sequentially to be safe with updates
        for (const archiveLead of jsonData) {
            const result = findMatchingLead(archiveLead, currentRows);

            if (result) {
                // Update stats
                matchedCount++;
                if (result.priority === 1) p1Count++;
                else if (result.priority === 2) p2Count++;
                else if (result.priority === 3) p3Count++;

                // Prepare update
                const newQual = archiveLead["Квалификация"] || archiveLead["Qualification"];
                const newTarget = archiveLead["Целевой"] || archiveLead["Target"];
                const newSum = archiveLead["Сумма продажи"] || archiveLead["Сумма"] || archiveLead["Amount"]; // "Сумма продажи" as per new request

                const update: any = {};
                // Only update if value exists in archive
                if (newQual !== undefined) update["Квалификация"] = newQual;
                if (newTarget !== undefined) update["Целевой"] = newTarget;
                if (newSum !== undefined) update["Сумма продажи"] = newSum; // Using correct column name from previous task

                // Also support old column "Сумма" if needed? User specifically asked for "Сумма продажи" in previous Task 15.
                // But in this prompt user code had: "Сумма продажи": archiveLead["Сумма продажи"]

                if (Object.keys(update).length > 0) {
                    await updateRow(CURRENT_MONTH_SHEET, result.lead.rowIndex, update);
                }
            } else {
                notMatched++;
            }
        }

        return NextResponse.json({
            success: true,
            uploaded: jsonData.length,
            matched: matchedCount,
            priority1: p1Count,
            priority2: p2Count,
            priority3: p3Count,
            notMatched: notMatched
        });

    } catch (error) {
        console.error("Archive merge error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to merge archive" },
            { status: 500 }
        );
    }
}
