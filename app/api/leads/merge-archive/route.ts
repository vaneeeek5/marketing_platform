import { NextRequest, NextResponse } from "next/server";
import { getSheetData, updateRow } from "@/lib/googleSheets";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";
import * as XLSX from "xlsx";

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

        let updatedCount = 0;
        const updates = [];

        // Build Map of current rows for fast lookup
        // Key: Date + Time
        const currentMap = new Map<string, number>(); // Key -> RowIndex
        currentRows.forEach(row => {
            // Normalize Date/Time
            const d = row["Дата"]?.toString().trim();
            const t = row["Время"]?.toString().trim();
            if (d && t) {
                // Time from Sheet might be "14:30:00". Archive might be "14:30:00" or excel serial.
                // We assume Archive is properly formatted or we normalize.
                // Ideally we normalize both.
                // For now exact match string.
                currentMap.set(`${d}|${t}`, row.rowIndex);
            }
        });

        for (const row of jsonData) {
            // Archive Row Keys
            // "Дата", "Время"
            // "Квалификация", "Целевой" to update.
            // Check if archive has these columns.
            // Assumption: Archive headers match.

            const date = row["Дата"] || row["Date"]; // flexible
            const time = row["Время"] || row["Time"];

            if (!date || !time) continue;

            const key = `${date}|${time}`;
            const targetRowIndex = currentMap.get(key);

            if (targetRowIndex) {
                // Found match. Prepare update.
                const newQual = row["Квалификация"] || row["Qualification"];
                const newTarget = row["Целевой"] || row["Target"];
                const newSum = row["Сумма"] || row["Amount"];

                const update: any = {};
                if (newQual) update["Квалификация"] = newQual;
                if (newTarget) update["Целевой"] = newTarget;
                if (newSum) update["Сумма"] = newSum;

                if (Object.keys(update).length > 0) {
                    // We can't batch update rows easily with current lib?
                    // `updateRow` is single.
                    // We will iterate updates. 
                    // IMPORTANT: Current `lib/googleSheets` caches. 
                    // We should be careful with many updates.
                    // But for "Archive Import", it might be rare.
                    // We'll proceed with serial updates.
                    await updateRow(CURRENT_MONTH_SHEET, targetRowIndex, update);
                    updatedCount++;
                }
            }
        }

        return NextResponse.json({ success: true, updated: updatedCount });

    } catch (error) {
        console.error("Archive merge error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to merge archive" },
            { status: 500 }
        );
    }
}
