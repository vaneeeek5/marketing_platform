import { NextRequest, NextResponse } from "next/server";
import { getSheetData, updateRow, CURRENT_MONTH_SHEET } from "@/lib/googleSheets";
import { Lead } from "@/types";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sheetName = searchParams.get("sheet") || CURRENT_MONTH_SHEET;

        const rawData = await getSheetData(sheetName);

        // Transform to Lead type
        const leads: Lead[] = rawData.map((row, index) => {
            // Note: row.rowIndex from getSheetData is already set
            const rowIndex = typeof row.rowIndex === 'number' ? row.rowIndex : (index + 2);

            return {
                rowIndex,
                metrika_visit_id: String(row["metrika_visit_id"] || ""),
                number: String(row["Номер"] || ""), // Assuming column name if exists, or remove if unused
                campaign: String(row["Кампания"] || ""),
                date: String(row["Дата"] || ""),
                time: String(row["Время"] || ""),
                qualification: String(row["Квалификация"] || ""),
                comment: String(row["Комментарий"] || ""), // Assuming extra col
                sales: String(row["Сумма продажи"] || ""),
                "Целевой": String(row["Целевой"] || ""),
                "Цель": String(row["Цель"] || "")
            };
        });

        // Default Sort: Date Descending (Newest first)
        leads.sort((a, b) => {
            // Combine Date and Time for comparison
            // Assuming format YYYY-MM-DD or DD.MM.YYYY. 
            // If DD.MM.YYYY, simple string compare might fail for days/months crossing.
            // Let's safe-parse if possible.
            // Actually user dates usually "YYYY-MM-DD" from Metrika or manual string.
            // If they are purely string "2025-12-01", localCompare works.
            // But if "01.12.2025", we need custom parse. 
            // Let's try to normalize for sorting.

            const getDateVal = (l: Lead) => {
                const d = l.date || "";
                // If "DD.MM.YYYY" -> "YYYY-MM-DD" for string sort
                if (d.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
                    const [day, month, year] = d.split('.');
                    return `${year}-${month}-${day}T${l.time || "00:00:00"}`;
                }
                return `${d}T${l.time || "00:00:00"}`;
            };

            const dateA = getDateVal(a);
            const dateB = getDateVal(b);

            // Descending
            if (dateA < dateB) return 1;
            if (dateA > dateB) return -1;
            return 0;
        });

        return NextResponse.json({
            leads,
            total: leads.length,
            sheetName
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { sheetName, rowIndex, field, value } = body;

        if (!sheetName || !rowIndex || !field) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Map field "qualification" or "comment" to column header
        // Assuming standard headers
        let columnHeader = "";
        if (field === 'qualification') columnHeader = "Квалификация";
        if (field === 'comment') columnHeader = "Комментарий";
        if (field === 'target') columnHeader = "Целевой";
        if (field === 'sales') columnHeader = "Сумма продажи";

        if (!columnHeader) {
            return NextResponse.json({ error: "Invalid field" }, { status: 400 });
        }

        await updateRow(sheetName, rowIndex, { [columnHeader]: value });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
    }
}
