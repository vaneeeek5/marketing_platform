export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchLeads, getGoals } from "@/lib/metrika";
import { updateMetrikaSettings, getMetrikaSettings } from "@/lib/googleSheets";

// Increase timeout for this route if deployed to Vercel
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { dateFrom, dateTo, goalIds, manual, action } = body;

        // Get default project
        const project = await prisma.project.findFirst();
        if (!project) {
            return NextResponse.json({ error: "No projects exist to attach leads to." }, { status: 400 });
        }

        // HANDLE CLEAR ACTION
        if (action === "clean") {
            if (dateFrom && dateTo) {
                const start = new Date(dateFrom);
                const end = new Date(dateTo);
                end.setHours(23, 59, 59, 999);
                
                const deleteResult = await prisma.lead.deleteMany({
                    where: {
                        projectId: project.id,
                        date: { gte: start, lte: end }
                    }
                });
                return NextResponse.json({
                    success: true,
                    message: `Удалено ${deleteResult.count} лидов из БД за период ${dateFrom} - ${dateTo}`
                });
            } else {
                const deleteResult = await prisma.lead.deleteMany({
                    where: { projectId: project.id }
                });
                return NextResponse.json({
                    success: true,
                    message: `All ${deleteResult.count} leads removed.`
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

        // 3. Update status in settings
        if (manual) {
            await updateMetrikaSettings({ last_sync_result: `Sync started to DB...` });
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

        let metrikaLeads: any[] = [];
        try {
            metrikaLeads = await fetchLeads(
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
                metrikaLeads = await fetchLeads(
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

        if (metrikaLeads.length === 0) {
            const msg = "No leads found in Metrika for this period";
            if (manual) await updateMetrikaSettings({ last_sync_result: msg });
            return NextResponse.json({
                success: true,
                added: 0,
                skipped: 0,
                message: msg
            });
        }

        // 6. Deduplication in DB
        const visitIds = metrikaLeads.map(l => l.visitId);
        const existingLeads = await prisma.lead.findMany({
            where: {
                projectId: project.id,
                metrikaVisitId: { in: visitIds }
            },
            select: { metrikaVisitId: true }
        });
        
        const existingIds = new Set(existingLeads.map(l => l.metrikaVisitId));
        const newLeads = metrikaLeads.filter(l => !existingIds.has(l.visitId));

        // 7. Insert to DB
        let addedCount = 0;
        if (newLeads.length > 0) {
            const recordsToCreate = newLeads.map(lead => {
                const matchingRule = Object.values(settings.campaign_rules || {}).find(r => r.name === lead.campaign);
                
                // Parse date properly to Date object
                let dateObj = new Date(`${lead.date}T${lead.time || "00:00:00"}`);
                if (isNaN(dateObj.getTime())) {
                    dateObj = new Date();
                }

                return {
                    projectId: project.id,
                    metrikaVisitId: lead.visitId,
                    date: dateObj,
                    campaign: lead.campaign || "",
                    goal: lead.goalName || "",
                    status: matchingRule?.target_status || "",
                    qualification: matchingRule?.qualification_status || "",
                    saleAmount: matchingRule?.amount ? parseFloat(String(matchingRule.amount)) : 0,
                };
            });

            const result = await prisma.lead.createMany({
                data: recordsToCreate,
                skipDuplicates: true // fallback safety
            });
            addedCount = result.count;
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
