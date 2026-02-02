import { NextRequest, NextResponse } from "next/server";
import { getSheetData, getBudgetData, getSheetNames } from "@/lib/googleSheets";
import { COLUMN_NAMES, CURRENT_MONTH_SHEET, THRESHOLDS } from "@/lib/constants";
import {
    isTargetLead,
    isQualifiedLead,
    isSale,
    parseDate,
    getWeekNumber,
} from "@/lib/utils";
import {
    KPIMetrics,
    TrendData,
    Recommendation,
    CampaignStats,
    AnalyticsResponse,
} from "@/types";

// Mapping months to quarter
const MONTH_TO_QUARTER: Record<string, number> = {
    "Январь": 1, "Февраль": 1, "Март": 1,
    "Апрель": 2, "Май": 2, "Июнь": 2,
    "Июль": 3, "Август": 3, "Сентябрь": 3,
    "Октябрь": 4, "Ноябрь": 4, "Декабрь": 4,
};

const MONTH_ORDER = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

// Helper to parse sheet name and extract month/year
function parseSheetName(sheet: string): { month: string; year: number } | null {
    const monthPattern = /^(Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь|Декабрь)(?:\s+(\d{4}))?$/;
    const match = sheet.match(monthPattern);
    if (!match) return null;
    return {
        month: match[1],
        year: match[2] ? parseInt(match[2]) : 2024 // Default to 2024 if no year
    };
}

// Get sheets for period aggregation
async function getSheetsForPeriod(
    currentSheet: string,
    period: string
): Promise<string[]> {
    if (period === "month" || period === "week") {
        return [currentSheet];
    }

    const allSheets = await getSheetNames();
    const current = parseSheetName(currentSheet);
    if (!current) return [currentSheet];

    const currentYear = current.year;

    if (period === "quarter") {
        const quarter = MONTH_TO_QUARTER[current.month];
        const quarterMonths = Object.entries(MONTH_TO_QUARTER)
            .filter(([, q]) => q === quarter)
            .map(([m]) => m);

        return allSheets.filter((sheet) => {
            const parsed = parseSheetName(sheet);
            return parsed && parsed.year === currentYear && quarterMonths.includes(parsed.month);
        });
    }

    if (period === "year") {
        return allSheets.filter((sheet) => {
            const parsed = parseSheetName(sheet);
            return parsed && parsed.year === currentYear;
        });
    }

    return [currentSheet];
}

// GET /api/analytics/summary - получить агрегированные метрики
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sheetName = searchParams.get("sheet") || CURRENT_MONTH_SHEET;
        const period = searchParams.get("period") || "month";

        // Get all sheets needed for the period
        const sheetsToFetch = await getSheetsForPeriod(sheetName, period);

        // Fetch data from all sheets
        const allData: Record<string, string | number | undefined>[] = [];
        for (const sheet of sheetsToFetch) {
            try {
                const sheetData = await getSheetData(sheet);
                allData.push(...sheetData);
            } catch (err) {
                console.warn(`Не удалось загрузить лист ${sheet}:`, err);
            }
        }

        const budgetData = await getBudgetData();

        // Подсчёт KPI
        let totalLeads = 0;
        let targetLeads = 0;
        let qualifiedLeads = 0;
        let sales = 0;

        // Статистика по кампаниям
        const campaignStatsMap: Record<
            string,
            {
                total: number;
                target: number;
                qualified: number;
                sales: number;
            }
        > = {};

        // Данные для трендов по неделям
        const weeklyData: Record<
            string,
            { leads: number; targetLeads: number; sales: number }
        > = {};

        allData.forEach((row) => {
            totalLeads++;

            const qualification = String(row[COLUMN_NAMES.QUALIFICATION] || "");
            const salesValue = row[COLUMN_NAMES.SALES];
            const campaign = String(row[COLUMN_NAMES.CAMPAIGN] || "Другое");
            const dateStr = String(row[COLUMN_NAMES.DATE] || "");

            // Инициализация статистики кампании
            if (!campaignStatsMap[campaign]) {
                campaignStatsMap[campaign] = {
                    total: 0,
                    target: 0,
                    qualified: 0,
                    sales: 0,
                };
            }
            campaignStatsMap[campaign].total++;

            // Подсчёт целевых
            if (isTargetLead(qualification)) {
                targetLeads++;
                campaignStatsMap[campaign].target++;
            }

            // Подсчёт квалифицированных
            if (isQualifiedLead(qualification)) {
                qualifiedLeads++;
                campaignStatsMap[campaign].qualified++;
            }

            // Подсчёт продаж
            if (isSale(salesValue as string | number)) {
                sales++;
                campaignStatsMap[campaign].sales++;
            }

            // Агрегация по неделям
            const date = parseDate(dateStr);
            if (date) {
                const weekNum = getWeekNumber(date);
                const weekKey = `Неделя ${weekNum}`;
                if (!weeklyData[weekKey]) {
                    weeklyData[weekKey] = { leads: 0, targetLeads: 0, sales: 0 };
                }
                weeklyData[weekKey].leads++;
                if (isTargetLead(qualification)) {
                    weeklyData[weekKey].targetLeads++;
                }
                if (isSale(salesValue as string | number)) {
                    weeklyData[weekKey].sales++;
                }
            }
        });

        // Calculate Metrika Stats from the same data
        const byGoal: Record<string, number> = {};
        let metrikaTotal = 0;

        allData.forEach((row) => {
            // Check if it's a Metrika lead (has "Цель")
            const goal = String(row["Цель"] || "").trim();
            if (goal) {
                metrikaTotal++;
                byGoal[goal] = (byGoal[goal] || 0) + 1;
            }
        });

        const metrikaStats = {
            total: metrikaTotal,
            byGoal
        };

        // Расчёт метрик
        const targetPercent = totalLeads > 0 ? (targetLeads / totalLeads) * 100 : 0;
        const qualifiedPercent =
            totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;
        const conversionRate = totalLeads > 0 ? (sales / totalLeads) * 100 : 0;

        // Расчёт финансовых метрик (если есть данные бюджета)
        let totalSpend: number | undefined;
        let cpl: number | undefined;
        let cpo: number | undefined;

        if (budgetData) {
            totalSpend = Object.values(budgetData).reduce((sum, val) => sum + val, 0);
            cpl = totalLeads > 0 ? totalSpend / totalLeads : undefined;
            cpo = sales > 0 ? totalSpend / sales : undefined;
        }

        const kpi: KPIMetrics = {
            totalLeads,
            targetLeads,
            qualifiedLeads,
            sales,
            targetPercent,
            qualifiedPercent,
            conversionRate,
            totalSpend,
            cpl,
            cpo,
        };

        // Формирование данных трендов
        const trends: TrendData[] = Object.entries(weeklyData)
            .sort((a, b) => {
                const numA = parseInt(a[0].replace("Неделя ", ""));
                const numB = parseInt(b[0].replace("Неделя ", ""));
                return numA - numB;
            })
            .map(([week, data]) => ({
                week,
                ...data,
            }));

        // Формирование статистики по кампаниям
        const campaignStats: CampaignStats[] = Object.entries(campaignStatsMap)
            .map(([name, stats]) => ({
                name,
                totalLeads: stats.total,
                targetLeads: stats.target,
                qualifiedLeads: stats.qualified,
                sales: stats.sales,
                targetPercent: stats.total > 0 ? (stats.target / stats.total) * 100 : 0,
                qualifiedPercent:
                    stats.total > 0 ? (stats.qualified / stats.total) * 100 : 0,
                conversionRate: stats.total > 0 ? (stats.sales / stats.total) * 100 : 0,
                spend: budgetData?.[name],
                cpl:
                    budgetData?.[name] && stats.total > 0
                        ? budgetData[name] / stats.total
                        : undefined,
            }))
            .sort((a, b) => b.totalLeads - a.totalLeads);

        // Генерация рекомендаций
        const recommendations: Recommendation[] = [];

        // Проверка CPL
        if (cpl && cpl > THRESHOLDS.HIGH_CPL) {
            recommendations.push({
                type: "warning",
                title: "Высокая стоимость лида",
                description: `CPL составляет ${Math.round(cpl)} ₽, что выше порога в ${THRESHOLDS.HIGH_CPL} ₽. Рекомендуется проверить настройки таргетинга.`,
            });
        }

        // Проверка целевых по кампаниям
        campaignStats.forEach((campaign) => {
            if (
                campaign.totalLeads >= 10 &&
                campaign.targetPercent < THRESHOLDS.LOW_TARGET_PERCENT
            ) {
                recommendations.push({
                    type: "warning",
                    title: "Низкий процент целевых лидов",
                    description: `Только ${campaign.targetPercent.toFixed(1)}% целевых лидов. Добавьте минус-слова или уточните таргетинг.`,
                    campaign: campaign.name,
                });
            }

            if (campaign.cpl && campaign.cpl > THRESHOLDS.HIGH_CPL) {
                recommendations.push({
                    type: "warning",
                    title: "Высокий CPL в кампании",
                    description: `CPL составляет ${Math.round(campaign.cpl)} ₽. Проверьте эффективность ключевых слов.`,
                    campaign: campaign.name,
                });
            }
        });

        // Позитивные рекомендации
        if (conversionRate > 5) {
            recommendations.push({
                type: "success",
                title: "Хорошая конверсия",
                description: `Конверсия в продажу ${conversionRate.toFixed(1)}% — выше среднего показателя.`,
            });
        }

        // Info about data
        if (sheetsToFetch.length > 1) {
            recommendations.unshift({
                type: "info",
                title: "Агрегированные данные",
                description: `Данные собраны из ${sheetsToFetch.length} листов: ${sheetsToFetch.join(", ")}`,
            });
        }

        const response: AnalyticsResponse = {
            kpi,
            trends,
            recommendations,
            campaignStats,
            metrikaStats,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Ошибка при получении аналитики:", error);
        return NextResponse.json(
            { error: "Не удалось получить аналитику" },
            { status: 500 }
        );
    }
}
