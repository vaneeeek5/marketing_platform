"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { KPICard } from "@/components/kpi-card";
import { LeadsTrendChart } from "@/components/charts/leads-trend-chart";
import { RecommendationsWidget } from "@/components/recommendations-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Users,
    Target,
    Award,
    ShoppingCart,
    TrendingUp,
    DollarSign,
    Loader2,
    Calendar,
    CalendarDays,
    Database,
} from "lucide-react";
import { AnalyticsResponse } from "@/types";
import { formatNumber, formatCurrency } from "@/lib/utils";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ru } from 'date-fns/locale';
import { format } from 'date-fns';
import { registerLocale } from "react-datepicker";
registerLocale('ru', ru);

type PeriodType = "week" | "month" | "quarter" | "year";

const PERIOD_OPTIONS = [
    { value: "week", label: "Неделя" },
    { value: "month", label: "Месяц" },
    { value: "quarter", label: "Квартал" },
    { value: "year", label: "Год" },
    { value: "custom", label: "Период" },
] as const;

export default function DashboardPage() {
    const [data, setData] = useState<AnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentSheet] = useState("Лиды");
    const [period, setPeriod] = useState<string>("month");
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
    const [startDate, endDate] = dateRange;

    // fetchSheets removed as we use single sheet

    const fetchData = useCallback(async () => {
        // currentSheet always exists
        setLoading(true);
        try {
            let url = `/api/analytics/summary?sheet=${encodeURIComponent(currentSheet)}&period=${period}`;
            if (period === "custom" && startDate && endDate) {
                // Pass local YYYY-MM-DD strings
                const s = format(startDate, 'yyyy-MM-dd');
                const e = format(endDate, 'yyyy-MM-dd');
                url += `&startDate=${s}&endDate=${e}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error("Ошибка загрузки данных");
            const result = await response.json();
            setData(result);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Неизвестная ошибка";
            setError(message);
            toast.error("Не удалось загрузить данные", {
                description: message,
            });
        } finally {
            setLoading(false);
        }
    }, [currentSheet, period]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getPeriodLabel = () => {
        switch (period) {
            case "week": return "текущую неделю";
            case "month": return "текущий месяц";
            case "quarter": return "текущий квартал";
            case "year": return "текущий год";
            default: return "текущий период";
        }
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <p className="text-lg text-destructive mb-2">Ошибка загрузки</p>
                <p className="text-muted-foreground">{error}</p>
            </div>
        );
    }

    if (!data) return null;

    const { kpi, trends, recommendations } = data;

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Page header with filters */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Главная</h1>
                    <p className="text-muted-foreground mt-1">
                        Обзор маркетинговых показателей за {getPeriodLabel()}
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    {/* Sheet selector removed */}

                    {/* Period selector */}
                    <div className="flex items-center gap-2">
                        {period === "custom" && (
                            <div className="relative z-50">
                                <DatePicker
                                    selectsRange={true}
                                    startDate={startDate}
                                    endDate={endDate}
                                    onChange={(update: [Date | null, Date | null]) => {
                                        setDateRange(update);
                                    }}
                                    isClearable={true}
                                    locale="ru"
                                    dateFormat="dd.MM.yyyy"
                                    placeholderText="Выберите даты"
                                    className="h-10 w-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                        )}

                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <Select value={period} onValueChange={(v) => setPeriod(v)}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PERIOD_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Loading overlay */}
            {loading && (
                <div className="fixed top-20 right-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm flex items-center gap-2 shadow-lg z-50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка...
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <KPICard
                    title="Всего лидов"
                    value={formatNumber(kpi.totalLeads)}
                    subtitle={`За ${getPeriodLabel()}`}
                    icon={Users}
                    variant="info"
                />
                <KPICard
                    title="Целевые лиды"
                    value={formatNumber(kpi.targetLeads)}
                    subtitle={`${kpi.targetPercent.toFixed(1)}% от общего`}
                    icon={Target}
                    variant="success"
                />
                <KPICard
                    title="Квалифицированные"
                    value={formatNumber(kpi.qualifiedLeads)}
                    subtitle={`${kpi.qualifiedPercent.toFixed(1)}% от общего`}
                    icon={Award}
                    variant="warning"
                />
                <KPICard
                    title="Продажи"
                    value={formatNumber(kpi.sales)}
                    subtitle={`Конверсия: ${kpi.conversionRate.toFixed(1)}%`}
                    icon={ShoppingCart}
                    variant="success"
                />
            </div>

            {/* Metrika Widget (New) */}
            <MetrikaWidget stats={data.metrikaStats} />

            {/* Financial KPIs (if available) */}
            {kpi.totalSpend !== undefined && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KPICard
                        title="Общие расходы"
                        value={formatCurrency(kpi.totalSpend)}
                        subtitle="За текущий период"
                        icon={DollarSign}
                        variant="default"
                    />
                    {kpi.cpl !== undefined && (
                        <KPICard
                            title="CPL (стоимость лида)"
                            value={formatCurrency(kpi.cpl)}
                            subtitle="Cost Per Lead"
                            icon={TrendingUp}
                            variant={kpi.cpl > 3000 ? "danger" : "success"}
                        />
                    )}
                    {kpi.cpo !== undefined && (
                        <KPICard
                            title="CPO (стоимость продажи)"
                            value={formatCurrency(kpi.cpo)}
                            subtitle="Cost Per Order"
                            icon={ShoppingCart}
                            variant="info"
                        />
                    )}
                </div>
            )}

            {/* Charts and Recommendations */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Trend Chart */}
                <Card className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Динамика лидов по неделям
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {trends.length > 0 ? (
                            <LeadsTrendChart data={trends} />
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                Недостаточно данных для построения графика
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                    <CardHeader>
                        <CardTitle>Рекомендации</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RecommendationsWidget recommendations={recommendations} />
                    </CardContent>
                </Card>
            </div>

            {/* Campaign Stats Table */}
            {data.campaignStats && data.campaignStats.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Статистика по кампаниям</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 font-medium">Кампания</th>
                                        <th className="text-right py-3 px-4 font-medium">Лиды</th>
                                        <th className="text-right py-3 px-4 font-medium">Целевые %</th>
                                        <th className="text-right py-3 px-4 font-medium">Квал</th>
                                        <th className="text-right py-3 px-4 font-medium">Продажи</th>
                                        <th className="text-right py-3 px-4 font-medium">Конверсия</th>
                                        {data.campaignStats.some((c) => c.cpl) && (
                                            <th className="text-right py-3 px-4 font-medium">CPL</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.campaignStats.map((campaign) => (
                                        <tr
                                            key={campaign.name}
                                            className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                                        >
                                            <td className="py-3 px-4 font-medium">{campaign.name}</td>
                                            <td className="text-right py-3 px-4">
                                                {formatNumber(campaign.totalLeads)}
                                            </td>
                                            <td className="text-right py-3 px-4">
                                                <span
                                                    className={
                                                        campaign.targetPercent < 15
                                                            ? "text-red-600"
                                                            : "text-green-600"
                                                    }
                                                >
                                                    {campaign.targetPercent.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="text-right py-3 px-4">
                                                {formatNumber(campaign.qualifiedLeads)}
                                            </td>
                                            <td className="text-right py-3 px-4">
                                                {formatNumber(campaign.sales)}
                                            </td>
                                            <td className="text-right py-3 px-4">
                                                {campaign.conversionRate.toFixed(1)}%
                                            </td>
                                            {data.campaignStats.some((c) => c.cpl) && (
                                                <td className="text-right py-3 px-4">
                                                    {campaign.cpl
                                                        ? formatCurrency(campaign.cpl)
                                                        : "—"}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function MetrikaWidget({ stats }: { stats?: { total: number, byGoal: Record<string, number> } }) {
    if (!stats) return null;

    return (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Лиды из Метрики
                    </CardTitle>
                    <a href="/metrika-leads" className="text-sm font-medium text-blue-600 hover:text-blue-500 flex items-center gap-1">
                        Все лиды <TrendingUp className="h-3 w-3" />
                    </a>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <div className="text-3xl font-bold">{stats.total}</div>
                        <div className="text-sm text-muted-foreground">Всего лидов за текущий период</div>
                    </div>
                    <div className="flex-[3] grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(stats.byGoal).slice(0, 6).map(([goal, count]) => (
                            <div key={goal} className="bg-white/50 dark:bg-black/20 rounded p-2 text-sm border flex flex-col">
                                <span className="font-medium text-xs text-muted-foreground truncate" title={goal}>{goal}</span>
                                <span className="font-bold">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
