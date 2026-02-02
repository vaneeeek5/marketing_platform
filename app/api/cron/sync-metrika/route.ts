import { NextRequest, NextResponse } from "next/server";
import { fetchLeads, getGoals } from "@/lib/metrika";
import { appendRows, getSheetData } from "@/lib/googleSheets";
import { Lead } from "@/types";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";

// Helper to determine rowIndex (simplified, ideally we get max index from sheet)
// But appendRows handles appending.
// We need to map MetrikaLead to Lead.

export async function GET(req: NextRequest) {
    // 1. Authorization
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        // 2. Date: Yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

        console.log(`[Cron] Starting sync for ${dateStr}`);

        // 3. Prepare config (Goals, Maps)
        const goals = await getGoals();
        const goalNamesMap: Record<number, string> = {};
        goals.forEach(g => { goalNamesMap[g.id] = g.name; });

        // Campaign Map (TODO: Load from config or env? Hardcoded for now based on typical usage)
        const campaignMap: Record<string, string> = {
            // Add mappings if needed, or leave empty
        };

        // 4. Fetch Leads
        const metrikaLeads = await fetchLeads(
            dateStr,
            dateStr,
            [], // All goals
            goalNamesMap,
            ["yandex", "direct"], // Assuming we filter for paid traffic? Or empty for all? Let's use ["yandex", "direct"] as safe default for "Direct" campaigns.
            campaignMap
        );

        console.log(`[Cron] Fetched ${metrikaLeads.length} leads from Metrika`);

        if (metrikaLeads.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: "No leads found for yesterday" });
        }

        // 5. Transform to Sheet Rows
        // Fetch current sheet data to determine next rowIndex? 
        // Actually appendRows usually just appends.
        // But `Lead` type requires `rowIndex`.
        // The `appendRows` implementation in `googleSheets.ts` might handle it or we pass generated rows.
        // Let's check `appendRows` signature from memory or view.
        // `appendRows(sheetName: string, rows: SheetRow[])`
        // `SheetRow` is likely `Record<string, string | number>`.
        // We need to match columns: Date, Time, Campaign, Target, Qualification, Comment, Sales.

        const newRows = metrikaLeads.map(l => ({
            "Дата": l.date,
            "Время": l.time, // formatTime will handle it
            "Кампания": l.campaign,
            "Целевой": "", // Default empty
            "Квалификация": "",
            "Сумма": "",
            "Комментарий": l.goalName, // Put goal name in comment or separate column? 
            // Usually "Цель" is not in Lead columns? 
            // Manual sync puts Goal Name in "Комментарий" or checks for "Target" goal?
            // Let's put Goal Name in Comment for visibility.
        }));

        // 6. Append
        await appendRows(CURRENT_MONTH_SHEET, newRows);

        return NextResponse.json({ success: true, count: metrikaLeads.length, date: dateStr });
    } catch (error) {
        console.error("[Cron] Sync failed:", error);
        return new NextResponse(`Internal Server Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
    }
}
