import { NextRequest, NextResponse } from "next/server";
import { fetchLeads, getGoals } from "@/lib/metrika";
import { getSheetData, appendRows } from "@/lib/googleSheets";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";
import { formatTime } from "@/lib/utils";

export async function POST(req: NextRequest) {
    try {
        // 1. Get existing data to find duplicates/last entry
        const rows = await getSheetData(CURRENT_MONTH_SHEET);

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
        const todayStrLocal = `${dd}.${mm}.${yyyy}`; // DD.MM.YYYY

        // 2. Fetch goals for mapping
        const goals = await getGoals();
        const goalNamesMap: Record<number, string> = {};
        goals.forEach(g => { goalNamesMap[g.id] = g.name; });

        // 3. Fetch from Metrika (Today)
        const metrikaLeads = await fetchLeads(
            todayStr,
            todayStr,
            [],
            goalNamesMap,
            ["yandex", "direct"],
            {}
        );

        console.log(`[SyncLatest] Fetched ${metrikaLeads.length} leads for today`);

        // 4. Filter duplicates
        const newLeads = [];
        for (const lead of metrikaLeads) {
            // Check if this lead exists in rows
            const exists = rows.some(r => {
                const rDate = r["Дата"]?.toString();
                const rTime = formatTime(r["Время"]?.toString() || "");

                // Match date
                const dateMatch = (rDate === todayStr || rDate === todayStrLocal);

                // Match time exactly
                return dateMatch && rTime === lead.time;
            });

            if (!exists) {
                newLeads.push(lead);
            }
        }

        console.log(`[SyncLatest] Found ${newLeads.length} new leads`);

        if (newLeads.length > 0) {
            const appendData = newLeads.map(l => ({
                "Дата": l.date,
                "Время": l.time,
                "Кампания": l.campaign,
                "Целевой": "",
                "Квалификация": "",
                "Сумма": "",
                "Комментарий": l.goalName
            }));
            await appendRows(CURRENT_MONTH_SHEET, appendData);
        }

        return NextResponse.json({ success: true, added: newLeads.length });

    } catch (error) {
        console.error("Error syncing latest:", error);
        return NextResponse.json(
            { success: false, error: "Failed to sync latest leads" },
            { status: 500 }
        );
    }
}
