import { NextRequest, NextResponse } from "next/server";
import { getSheetData, getSheetNames, getMetrikaSettings, getCampaignMapping } from "@/lib/googleSheets";
import { COLUMN_NAMES } from "@/lib/constants";
import { parseDate, normalizeCampaignName } from "@/lib/utils";
import { PeriodGroup, GroupedAnalyticsResponse, KPIMetrics, CampaignStats } from "@/types";
import { startOfWeek, endOfWeek, format, startOfMonth, endOfMonth, eachWeekOfInterval, eachMonthOfInterval, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

// Helper: Group data by calendar weeks
// Helper: Group data by calendar weeks
function groupDataByWeeks(
    allData: Record<string, string | number | undefined>[],
    startDate: Date,
    endDate: Date,
    expensesArray: any[],
    campaignMap: Map<string, string>
): PeriodGroup[] {
    const weeks = eachWeekOfInterval(
        { start: startDate, end: endDate },
        { weekStartsOn: 1, locale: ru }
    );

    const periodGroups: PeriodGroup[] = [];

    for (const weekStart of weeks) {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1, locale: ru });
        const weekStartNorm = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        const weekEndNorm = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());

        // Filter Leads
        const weekData = allData.filter(row => {
            const dateStr = String(row[COLUMN_NAMES.DATE] || "");
            const date = parseDate(dateStr);
            if (!date) return false;

            const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            return targetDate >= weekStartNorm && targetDate <= weekEndNorm;
        });

        // Filter & Aggregate Expenses
        const periodExpensesMap = new Map<string, number>();
        expensesArray.forEach(exp => {
            // exp.date is YYYY-MM-DD
            if (!exp.date) return;
            const expDate = parseISO(exp.date);
            const targetExpDate = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());

            if (targetExpDate >= weekStartNorm && targetExpDate <= weekEndNorm) {
                const key = normalizeCampaignName(exp.campaign);
                const current = periodExpensesMap.get(key) || 0;
                periodExpensesMap.set(key, current + exp.spend);
            }
        });

        if (weekData.length === 0 && periodExpensesMap.size === 0) continue;

        const { campaignStats, totals } = calculateStats(weekData, periodExpensesMap, campaignMap);

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
    expensesArray: any[],
    campaignMap: Map<string, string>
): PeriodGroup[] {
    const months = eachMonthOfInterval({ start: startDate, end: endDate });

    const periodGroups: PeriodGroup[] = [];

    for (const monthStart of months) {
        const monthEnd = endOfMonth(monthStart);
        const monthStartNorm = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate());
        const monthEndNorm = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate());

        // Filter Leads
        const monthData = allData.filter(row => {
            const dateStr = String(row[COLUMN_NAMES.DATE] || "");
            const date = parseDate(dateStr);
            if (!date) return false;

            const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            return targetDate >= monthStartNorm && targetDate <= monthEndNorm;
        });

        // Filter & Aggregate Expenses
        const periodExpensesMap = new Map<string, number>();
        expensesArray.forEach(exp => {
            if (!exp.date) return;
            const expDate = parseISO(exp.date);
            const targetExpDate = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());

            if (targetExpDate >= monthStartNorm && targetExpDate <= monthEndNorm) {
                const key = normalizeCampaignName(exp.campaign);
                const current = periodExpensesMap.get(key) || 0;
                periodExpensesMap.set(key, current + exp.spend);
            }
        });

        if (monthData.length === 0 && periodExpensesMap.size === 0) continue;

        const { campaignStats, totals } = calculateStats(monthData, periodExpensesMap, campaignMap);

        periodGroups.push({
            name: format(monthStart, "LLLL yyyy", { locale: ru }),
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
    expensesMap: Map<string, number>,
    campaignMap: Map<string, string>
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
        let campaign = String(row[COLUMN_NAMES.CAMPAIGN] || "Другое");

        // Apply campaign mapping (normalization)
        const normName = normalizeCampaignName(campaign);
        const mappedName = campaignMap.get(normName);
        if (mappedName) {
            campaign = mappedName;
        }

        const targetVal = String(row["Целевой"] || "").trim().toLowerCase();
        const isTarget = targetVal === "целевой" || targetVal === "целевая" || targetVal === "да" || targetVal === "+";

        const qualVal = String(row["Квалификация"] || "").trim().toLowerCase();
        const isQualified = qualVal === "квал" || qualVal === "квалифицированный";

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

    const campaignStats: CampaignStats[] = Object.entries(campaignStatsMap)
        .map(([name, stats]) => {
            const spend = expensesMap.get(normalizeCampaignName(name)) || 0;
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

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const viewType = searchParams.get("viewType") || "byWeek";
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

        const filteredData = allData.filter(row => {
            const dateStr = String(row[COLUMN_NAMES.DATE] || "");
            const date = parseDate(dateStr);
            if (!date) return false;

            const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

            return targetDate >= start && targetDate <= end;
        });

        // Fetch expenses server-side with daily grouping
        const expensesArray: any[] = [];
        try {
            // Import dynamically to avoid circular deps if any, though likely fine as static import
            const { fetchExpenses } = await import("@/lib/metrika");
            // Transform Date objects to YYYY-MM-DD for API
            const sStr = format(startDate, "yyyy-MM-dd");
            const eStr = format(endDate, "yyyy-MM-dd");

            const result = await fetchExpenses(sStr, eStr, {}, [], true); // true = groupByDate
            if (result.expenses) {
                expensesArray.push(...result.expenses);
            }
        } catch (expErr) {
            console.warn("Failed to fetch expenses:", expErr);
        }

        // Prepare campaign mapping
        let campaignMap = new Map<string, string>();
        try {
            const settings = await getMetrikaSettings();
            const rawMapping = getCampaignMapping(settings);
            Object.entries(rawMapping).forEach(([k, v]) => {
                campaignMap.set(normalizeCampaignName(k), v);
            });
        } catch (e) {
            console.warn("Failed to load campaign settings:", e);
        }

        let periods: PeriodGroup[];
        if (viewType === "byMonth") {
            periods = groupDataByMonths(filteredData, startDate, endDate, expensesArray, campaignMap);
        } else {
            periods = groupDataByWeeks(filteredData, startDate, endDate, expensesArray, campaignMap);
        }

        // Calculate overall totals (using all filtered data and all expenses in range)
        // We reuse CalculateStats but we need to generate a map for the WHOLE period first
        const totalExpensesMap = new Map<string, number>();
        expensesArray.forEach(exp => {
            const key = normalizeCampaignName(exp.campaign);
            const current = totalExpensesMap.get(key) || 0;
            totalExpensesMap.set(key, current + exp.spend);
        });

        const { totals: overallTotals } = calculateStats(filteredData, totalExpensesMap, campaignMap);
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
