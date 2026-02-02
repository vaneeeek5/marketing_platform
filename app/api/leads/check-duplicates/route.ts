import { NextRequest, NextResponse } from "next/server";
import { getSheetData, updateRow } from "@/lib/googleSheets";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";
import { Lead } from "@/types";

export async function POST(req: NextRequest) {
    try {
        const leads = await getSheetData(CURRENT_MONTH_SHEET);
        const map = new Map<string, number>();
        const duplicates: { rowIndex: number }[] = [];

        // Identify duplicates
        // Key: Date + Time + Campaign + (Client ID if available? No, usually Date+Time is unique enough for Metrika logs down to second)
        // Let's use Date + Time + ClientID (if exists in comment?).
        // Actually, identical Date + Time + Campaign is suspicious enough.
        // Let's use Date + Time.

        leads.forEach((lead) => {
            const date = lead["Дата"]?.toString() || "";
            const time = lead["Время"]?.toString() || "";
            // const campaign = lead["Кампания"]?.toString() || "";

            if (!date || !time) return;

            const key = `${date}|${time}`;

            if (map.has(key)) {
                // Duplicate found
                // Only mark if not already marked "дубль" ?
                // Check 'Qualification' column
                const qual = lead["Квалификация"]?.toString().toLowerCase() || "";
                if (!qual.includes("дубль")) {
                    duplicates.push({ rowIndex: lead.rowIndex });
                }
            } else {
                map.set(key, lead.rowIndex);
            }
        });

        console.log(`Found ${duplicates.length} new duplicates to mark.`);

        // Update duplicates in parallel (limit concurrency if needed, but for <50 items it's fine)
        // Google Sheets API has limits, so serial or small batch is safer.
        // We'll do serial for safety.

        let markedCount = 0;
        for (const dup of duplicates) {
            await updateRow(CURRENT_MONTH_SHEET, dup.rowIndex, {
                "Квалификация": "Дубль",
                "Комментарий": "Автоматически определен как дубль"
            });
            markedCount++;
        }

        return NextResponse.json({
            success: true,
            message: `Проверено. Отмечено дублей: ${markedCount}`,
            count: markedCount
        });

    } catch (error) {
        console.error("Error checking duplicates:", error);
        return NextResponse.json(
            { success: false, error: "Failed to check duplicates" },
            { status: 500 }
        );
    }
}
