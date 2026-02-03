import { NextRequest, NextResponse } from "next/server";
import { getSheetData, getSheetNames } from "@/lib/googleSheets";
import { COLUMN_NAMES, CURRENT_MONTH_SHEET } from "@/lib/constants";
import { parseDate } from "@/lib/utils";
import { PeriodGroup, GroupedAnalyticsResponse, KPIMetrics, CampaignStats } from "@/types";
import { startOfWeek, endOfWeek, format, startOfMonth, endOfMonth, eachWeekOfInterval, eachMonthOfInterval, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

// Helper: Group data by calendar weeks
function groupDataByWeeks(
    allData: Record<string, string | number | undefined>[],
    startDate: Date,
    endDate: Date,
    expensesMap: Map<string, number>
): PeriodGroup[] {
    // Get all weeks in the range
    const weeks = eachWeekOfInterval(
        { start: startDate, end: endDate },
        { weekStartsOn: 1, locale: ru } // Monday start
    );

    const periodGroups: PeriodGroup[] = [];

    for (const weekStart of weeks) {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1, locale: ru });

        // Filter data for this week
        const weekData = allData.filter(row => {
            const dateStr = String(row[COLUMN_NAMES.DATE] || "");
            const date = parseDate(dateStr);
            if (!date) return false;

            // Reset hours for comparison
            const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const weekStartNorm = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
            const weekEndNorm = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());

            return targetDate >= weekStartNorm && targetDate <= weekEndNorm;
        });

        if (weekData.length === 0) continue; // Skip empty weeks

        // Calculate stats for this week
        const { campaignStats, totals } = calculateStats(weekData, expensesMap);

        periodGroups.push({
            name: `${format(weekStart, "dd.MM")} - ${format(weekEnd, "dd.MM")}`,
            startDate: format(weekStart, "yyyy-MM-dd"),
            endDate: format(weekEnd, "yyyy-MM-dd"),
            campaignStats,
            totals
        });
    }

    return periodGroups;
}

// Helper: Group data by months
function groupDataByMonths(
    allData: Record<string, string | number | undefined>[],
    startDate: Date,
    endDate: Date,
    expensesMap: Map<string, number>
): PeriodGroup[] {
    // Get all months in the range
    const months = eachMonthOfInterval({ start: startDate, end: endDate });

    const periodGroups: PeriodGroup[] = [];

    for (const monthStart of months) {
        const monthEnd = endOfMonth(monthStart);

        // Filter data for this month
        const monthData = allData.filter(row => {
            const dateStr = String(row[COLUMN_NAMES.DATE] || "");
            const date = parseDate(dateStr);
            if (!date) return false;

            const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const monthStartNorm = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate());
            const monthEndNorm = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate());

            return targetDate >= monthStartNorm && targetDate <= monthEndNorm;
        });

        if (monthData.length === 0) continue; // Skip empty months

        // Calculate stats for this month
        const { campaignStats, totals } = calculateStats(monthData, expensesMap);

        periodGroups.push({
            name: format(monthStart, "LLLL yyyy", { locale: ru }), // "Декабрь 2025"
            startDate: format(monthStart, "yyyy-MM-dd"),
            endDate: format(monthEnd, "yyyy-MM-dd"),
            campaignStats,
            totals
        });
    }

    return periodGroups;
}

// Helper: Calculate campaign stats and totals from data
function calculateStats(
    data: Record<string, string | number | undefined>[],
    expensesMap: Map<string, number>
): {
    campaignStats: CampaignStats[];
    totals: { totalLeads: number; targetLeads: number; qualifiedLeads: number; sales: number; spend: number };
} {
    const campaignStatsMap: Record<
        string,
        { total: number; target: number; qualified: number; sales: number }
    > = {};

    let totalLeads = 0;
    let targetLeads = 0;
    let qualifiedLeads = 0;
    let salesCount = 0;

    data.forEach(row => {
        const campaign = String(row[COLUMN_NAMES.CAMPAIGN] || "Другое");

        // Target check
        const targetVal = String(row["Целевой"] || "").trim().toLowerCase();
        const isTarget = targetVal === "целевой" || targetVal === "целевая" || targetVal === "да" || targetVal === "+";

        // Qualified check
        const qualVal = String(row["Квалификация"] || "").trim().toLowerCase();
        const isQualified = qualVal === "квал" || qualVal === "квалифицированный";

        // Sales check
        const salesRaw = row["Сумма продажи"];
        const isSales = salesRaw && String(salesRaw).trim() !== "" && String(salesRaw) !== "0";

        if (!campaignStatsMap[campaign]) {
            campaignStatsMap[campaign] = { total: 0, target: 0, qualified: 0, sales: 0 };
        }

        campaignStatsMap[campaign].total++;
        totalLeads++;

        if (isTarget) {
            campaignStatsMap[campaign].target++;
            targetLeads++;
        }
        if (isQualified) {
            campaignStatsMap[campaign].qualified++;
            qualifiedLeads++;
        }
        if (isSales) {
            campaignStatsMap[campaign].sales++;
            salesCount++;
        }
    });

    // Build campaign stats array
    const campaignStats: CampaignStats[] = Object.entries(campaignStatsMap)
        .map(([name, stats]) => {
            const spend = expensesMap.get(name.toLowerCase().trim()) || 0;
            return {
                name,
                totalLeads: stats.total,
                targetLeads: stats.target,
                qualifiedLeads: stats.qualified,
                sales: stats.sales,
                targetPercent: stats.total > 0 ? (stats.target / stats.total) * 100 : 0,
                qualifiedPercent: stats.total > 0 ? (stats.qualified / stats.total) * 100 : 0,
                conversionRate: stats.total > 0 ? (stats.sales / stats.total) * 100 : 0,
                spend: spend || undefined,
                cpl: spend > 0 && stats.total > 0 ? spend / stats.total : undefined
            };
        })
        .sort((a, b) => b.totalLeads - a.totalLeads);

    const totalSpend = campaignStats.reduce((sum, c) => sum + (c.spend || 0), 0);

    return {
        campaignStats,
        totals: {
            totalLeads,
            targetLeads,
            qualifiedLeads,
            sales: salesCount,
            spend: totalSpend
        }
    };
}

// GET /api/analytics/grouped - получить данные, сгруппированные по неделям или месяцам
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const viewType = searchParams.get("viewType") || "byWeek"; // byWeek | byMonth
        const startDateStr = searchParams.get("startDate");
        const endDateStr = searchParams.get("endDate");

        if (!startDateStr || !endDateStr) {
            return NextResponse.json(
                { error: "startDate and endDate are required" },
                { status: 400 }
            );
        }

        const startDate = parseISO(startDateStr);
        const endDate = parseISO(endDateStr);

        // Fetch all sheets (to cover the date range)
        const allSheetNames = await getSheetNames();
        const allData: Record<string, string | number | undefined>[] = [];

        for (const sheet of allSheetNames) {
            try {
                const sheetData = await getSheetData(sheet);
                allData.push(...sheetData);
            } catch (err) {
                console.warn(`Failed to load sheet ${sheet}:`, err);
            }
        }

        // Filter data by date range
        const filteredData = allData.filter(row => {
            const dateStr = String(row[COLUMN_NAMES.DATE] || "");
            const date = parseDate(dateStr);
            if (!date) return false;

            const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

            return targetDate >= start && targetDate <= end;
        });

        // Fetch expenses for the period
        const expensesMap = new Map<string, number>();
        try {
            const expensesRes = await fetch(
                `${request.nextUrl.origin}/api/expenses?startDate=${startDateStr}&endDate=${endDateStr}`
            );
            if (expensesRes.ok) {
                const expensesData = await expensesRes.json();
                if (expensesData.expenses) {
                    expensesData.expenses.forEach((exp: { campaign: string; spend: number }) => {
                        expensesMap.set(exp.campaign.toLowerCase().trim(), exp.spend);
                    });
                }
            }
        } catch (expErr) {
            console.warn("Failed to fetch expenses:", expErr);
        }

        // Group data
        let periods: PeriodGroup[];
        if (viewType === "byMonth") {
            periods = groupDataByMonths(filteredData, startDate, endDate, expensesMap);
        } else {
            periods = groupDataByWeeks(filteredData, startDate, endDate, expensesMap);
        }

        // Calculate overall KPI
        const { totals: overallTotals } = calculateStats(filteredData, expensesMap);
        const overallKpi: KPIMetrics = {
            totalLeads: overallTotals.totalLeads,
            targetLeads: overallTotals.targetLeads,
            qualifiedLeads: overallTotals.qualifiedLeads,
            sales: overallTotals.sales,
            targetPercent: overallTotals.totalLeads > 0 ? (overallTotals.targetLeads / overallTotals.totalLeads) * 100 : 0,
            qualifiedPercent: overallTotals.totalLeads > 0 ? (overallTotals.qualifiedLeads / overallTotals.totalLeads) * 100 : 0,
            conversionRate: overallTotals.totalLeads > 0 ? (overallTotals.sales / overallTotals.totalLeads) * 100 : 0,
            totalSpend: overallTotals.spend || undefined,
            cpl: overallTotals.spend > 0 && overallTotals.totalLeads > 0 ? overallTotals.spend / overallTotals.totalLeads : undefined,
            cpo: overallTotals.spend > 0 && overallTotals.sales > 0 ? overallTotals.spend / overallTotals.sales : undefined
        };

        const response: GroupedAnalyticsResponse = {
            periods,
            overallKpi
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Error in grouped analytics:", error);
        return NextResponse.json(
            { error: "Failed to fetch grouped analytics" },
            { status: 500 }
        );
    }
}
