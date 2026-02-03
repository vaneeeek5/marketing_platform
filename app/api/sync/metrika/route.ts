import { NextRequest, NextResponse } from "next/server";
import {
    fetchLeads,
    getGoals
} from "@/lib/metrika";
import {
    appendRows,
    checkVisitIdsExist,
    ensureMetrikaSheetExists,
    clearSheetContent,
    updateMetrikaSettings,
    getMetrikaSettings,
    SheetRow
} from "@/lib/googleSheets";

// Increase timeout for this route if deployed to Vercel
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { dateFrom, dateTo, goalIds, manual, action } = body;

        // TARGET SHEET IS ALWAYS "Лиды"
        const targetSheet = "Лиды";

        // 2. Ensure sheets exist
        await ensureMetrikaSheetExists(targetSheet);

        // HANDLE CLEAR ACTION
        if (action === "clean") {
            if (dateFrom && dateTo) {
                const { deleteRowsByDateRange } = await import("@/lib/googleSheets");
                const count = await deleteRowsByDateRange(targetSheet, dateFrom, dateTo);
                return NextResponse.json({
                    success: true,
                    message: `Cleared ${count} rows from ${targetSheet} for period ${dateFrom} - ${dateTo}`
                });
            } else {
                // Determine if we should allow full clear?
                // For safety, let's keep full clear but maybe log it.
                // Or better, only allow full clear if explicitly requested?
                // The current UI only sends action=clean without dates effectively doing full clear.
                // We will update UI to always send dates if manual mode is open.
                // But providing fallback for now.
                await clearSheetContent(targetSheet);
                return NextResponse.json({
                    success: true,
                    message: `Sheet ${targetSheet} fully cleared`
                });
            }
        }

        // SYNC ACTION
        if (!dateFrom || !dateTo) {
            return NextResponse.json(
                { error: "dateFrom and dateTo are required" },
                { status: 400 }
            );
        }

        // 3. Update status
        if (manual) {
            await updateMetrikaSettings({ last_sync_result: `Sync started for ${targetSheet}...` });
        }

        // 4. Fetch valid goals
        let validGoalIds = goalIds || [];
        let goalNamesMap: Record<number, string> = {};
        const settings = await getMetrikaSettings();

        try {
            const availableGoals = await getGoals();
            const availableGoalIds = new Set(availableGoals.map(g => g.id));
            if (validGoalIds.length > 0) {
                validGoalIds = validGoalIds.filter((id: number) => availableGoalIds.has(Number(id)));
            }
            availableGoals.forEach(g => {
                goalNamesMap[g.id] = g.name;
            });
        } catch (e) {
            console.warn("Could not fetch goal names", e);
        }

        const legacyCampaignMap: Record<string, string> = {};
        if (settings.campaign_rules) {
            Object.entries(settings.campaign_rules).forEach(([id, rule]) => {
                if (rule.name) legacyCampaignMap[id] = rule.name;
            });
        }

        // 5. Fetch leads from Metrika
        console.log(`Fetching leads from ${dateFrom} to ${dateTo}`);

        let leads: any[] = [];
        try {
            leads = await fetchLeads(
                dateFrom,
                dateTo,
                validGoalIds,
                goalNamesMap,
                settings.allowed_utm_sources,
                legacyCampaignMap
            );
        } catch (fetchError: any) {
            if (fetchError.message && fetchError.message.includes("Unknown field")) {
                console.warn("Retrying without goals...", fetchError.message);
                leads = await fetchLeads(
                    dateFrom,
                    dateTo,
                    [],
                    goalNamesMap,
                    settings.allowed_utm_sources,
                    legacyCampaignMap
                );
            } else {
                throw fetchError;
            }
        }

        if (leads.length === 0) {
            const msg = "No leads found in Metrika for this period";
            if (manual) await updateMetrikaSettings({ last_sync_result: msg });
            return NextResponse.json({
                success: true,
                added: 0,
                skipped: 0,
                message: msg
            });
        }

        // 6. Deduplication
        const visitIds = leads.map(l => l.visitId);
        const existingIds = await checkVisitIdsExist(targetSheet, visitIds);
        const newLeads = leads.filter(l => !existingIds.has(l.visitId));

        // 7. Append to Sheets
        let addedCount = 0;
        if (newLeads.length > 0) {
            const rowsToAdd: SheetRow[] = newLeads.map(lead => {
                const matchingRule = Object.values(settings.campaign_rules || {}).find(r => r.name === lead.campaign);

                const row: SheetRow = {
                    "Дата": lead.date,
                    "Время": lead.time,
                    "Кампания": lead.campaign,
                    "Цель": lead.goalName,
                    "metrika_visit_id": lead.visitId,
                    "Целевой": matchingRule?.target_status || "",
                    "Квалификация": matchingRule?.qualification_status || "",
                    "Сумма продажи": matchingRule?.amount ? String(matchingRule.amount) : ""
                };
                return row;
            });

            addedCount = await appendRows(targetSheet, rowsToAdd);
        }

        const resultMsg = `Added: ${addedCount}, Skipped: ${existingIds.size} (Duplicates)`;
        await updateMetrikaSettings({
            last_sync_date: new Date().toISOString(),
            last_sync_result: resultMsg
        });

        return NextResponse.json({
            success: true,
            added: addedCount,
            skipped: existingIds.size,
            message: "Sync completed successfully"
        });

    } catch (error: any) {
        console.error("Sync error:", error);
        return NextResponse.json(
            { error: error.message || "Sync failed" },
            { status: 500 }
        );
    }
}
