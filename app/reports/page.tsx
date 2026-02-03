"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CampaignStats, AnalyticsResponse, GroupedAnalyticsResponse, PeriodGroup } from "@/types";
import { formatNumber, formatCurrency, formatPercent } from "@/lib/utils";
import { FileText, Download, Loader2, BarChart3, CalendarDays } from "lucide-react";
import * as XLSX from "xlsx";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ru } from 'date-fns/locale';
import { format } from 'date-fns';
import { registerLocale } from "react-datepicker";
registerLocale('ru', ru);

// Component to display campaign stats table for a single period
function PeriodTable({ period }: { period: PeriodGroup }) {
    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Кампания</TableHead>
                        <TableHead className="text-right">Всего</TableHead>
                        <TableHead className="text-right">Целевых</TableHead>
                        <TableHead className="text-right">% Соотн.</TableHead>
                        <TableHead className="text-right">Квал</TableHead>
                        <TableHead className="text-right">Соотн. %</TableHead>
                        <TableHead className="text-right">Продажи</TableHead>
                        <TableHead className="text-right">Расходы</TableHead>
                        <TableHead className="text-right">Цена лида</TableHead>
                        <TableHead className="text-right">Цена целевого</TableHead>
                        <TableHead className="text-right">Цена квал</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {period.campaignStats.map((campaign) => {
                        const costPerTarget =
                            campaign.spend && campaign.targetLeads > 0
                                ? campaign.spend / campaign.targetLeads
                                : undefined;
                        const costPerQualified =
                            campaign.spend && campaign.qualifiedLeads > 0
                                ? campaign.spend / campaign.qualifiedLeads
                                : undefined;

                        return (
                            <TableRow key={campaign.name}>
                                <TableCell className="font-medium">{campaign.name}</TableCell>
                                <TableCell className="text-right">{formatNumber(campaign.totalLeads)}</TableCell>
                                <TableCell className="text-right">{formatNumber(campaign.targetLeads)}</TableCell>
                                <TableCell className="text-right">{formatPercent(campaign.targetPercent)}</TableCell>
                                <TableCell className="text-right">{formatNumber(campaign.qualifiedLeads)}</TableCell>
                                <TableCell className="text-right">{formatPercent(campaign.qualifiedPercent)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatNumber(campaign.sales)}</TableCell>
                                <TableCell className="text-right">
                                    {campaign.spend ? formatCurrency(campaign.spend) : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                    {campaign.cpl ? formatCurrency(campaign.cpl) : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                    {costPerTarget ? formatCurrency(costPerTarget) : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                    {costPerQualified ? formatCurrency(costPerQualified) : "—"}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {/* Totals Row */}
                    <TableRow className="font-semibold bg-muted/30">
                        <TableCell>Итого</TableCell>
                        <TableCell className="text-right">{formatNumber(period.totals.totalLeads)}</TableCell>
                        <TableCell className="text-right">{formatNumber(period.totals.targetLeads)}</TableCell>
                        <TableCell className="text-right">
                            {period.totals.totalLeads > 0
                                ? formatPercent((period.totals.targetLeads / period.totals.totalLeads) * 100)
                                : "—"}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(period.totals.qualifiedLeads)}</TableCell>
                        <TableCell className="text-right">
                            {period.totals.totalLeads > 0
                                ? formatPercent((period.totals.qualifiedLeads / period.totals.totalLeads) * 100)
                                : "—"}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(period.totals.sales)}</TableCell>
                        <TableCell className="text-right">
                            {period.totals.spend > 0 ? formatCurrency(period.totals.spend) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                            {period.totals.spend > 0 && period.totals.totalLeads > 0
                                ? formatCurrency(period.totals.spend / period.totals.totalLeads)
                                : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                            {period.totals.spend > 0 && period.totals.targetLeads > 0
                                ? formatCurrency(period.totals.spend / period.totals.targetLeads)
                                : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                            {period.totals.spend > 0 && period.totals.qualifiedLeads > 0
                                ? formatCurrency(period.totals.spend / period.totals.qualifiedLeads)
                                : "—"}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </>
    );
}

export default function ReportsPage() {
    const [data, setData] = useState<AnalyticsResponse | null>(null);
    const [groupedData, setGroupedData] = useState<GroupedAnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("all");

    // Period state
    const [period, setPeriod] = useState<string>("quarter");
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
    const [startDate, endDate] = dateRange;
    const [showPeriodPopup, setShowPeriodPopup] = useState(false);
    const [tempPeriod, setTempPeriod] = useState<string>("quarter");
    const [showCustomRange, setShowCustomRange] = useState(false);

    // Calculate dates
    const calculatePeriodDates = (periodType: string) => {
        const today = new Date();
        const end = new Date(today);
        const start = new Date(today);

        switch (periodType) {
            case "week":
                start.setDate(today.getDate() - 7);
                break;
            case "month":
                start.setDate(today.getDate() - 30);
                break;
            case "quarter":
                start.setDate(today.getDate() - 90);
                break;
            case "year":
                start.setDate(today.getDate() - 365);
                break;
            default:
                return { start: null, end: null };
        }
        return { start, end };
    };

    const fetchData = useCallback(async (selectedPeriod: string, customStart?: Date | null, customEnd?: Date | null) => {
        setLoading(true);
        try {
            let url = "/api/analytics/summary?";

            let s: string | undefined;
            let e: string | undefined;

            if (selectedPeriod === "custom" && customStart && customEnd) {
                // Custom range
                s = format(customStart, 'yyyy-MM-dd');
                e = format(customEnd, 'yyyy-MM-dd');
                url += `period=custom&startDate=${s}&endDate=${e}`;
            } else {
                const { start, end } = calculatePeriodDates(selectedPeriod);
                if (start && end) {
                    s = format(start, 'yyyy-MM-dd');
                    e = format(end, 'yyyy-MM-dd');
                    url += `period=custom&startDate=${s}&endDate=${e}`;
                } else {
                    url += `period=${selectedPeriod}`;
                }
            }

            console.log("Fetching reports data:", url);
            const response = await fetch(url);
            if (!response.ok) throw new Error("Ошибка загрузки данных");
            const result = await response.json();

            // Fetch expenses to merge with campaign stats
            if (s && e) {
                try {
                    const expensesRes = await fetch(`/api/expenses?startDate=${s}&endDate=${e}`);
                    if (expensesRes.ok) {
                        const expensesData = await expensesRes.json();
                        if (expensesData.expenses && result.campaignStats) {
                            // Create a map of expenses by campaign name (lowercase for matching)
                            const expenseMap = new Map<string, { spend: number; visits: number }>();
                            expensesData.expenses.forEach((exp: { campaign: string; spend: number; visits: number }) => {
                                expenseMap.set(exp.campaign.toLowerCase().trim(), { spend: exp.spend, visits: exp.visits });
                            });

                            // Merge with campaign stats
                            result.campaignStats = result.campaignStats.map((cs: any) => {
                                const expData = expenseMap.get(cs.name.toLowerCase().trim());
                                if (expData) {
                                    cs.spend = expData.spend;
                                    cs.cpl = cs.totalLeads > 0 ? expData.spend / cs.totalLeads : 0;
                                }
                                return cs;
                            });
                        }
                    }
                } catch (expErr) {
                    console.warn("Failed to fetch expenses for reports:", expErr);
                }
            }

            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Неизвестная ошибка");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData("quarter");
    }, [fetchData]);

    const handleApplyPeriod = () => {
        if (tempPeriod === 'custom') {
            setShowPeriodPopup(false);
            setShowCustomRange(true);
        } else {
            setPeriod(tempPeriod);
            setDateRange([null, null]);
            fetchData(tempPeriod);
            setShowPeriodPopup(false);
            setShowCustomRange(false);
        }
    };

    const handleApplyCustomRange = () => {
        if (startDate && endDate) {
            setPeriod('custom');
            fetchData('custom', startDate, endDate);
            setShowCustomRange(false);
        }
    };

    const getPeriodLabel = () => {
        if (period === 'custom' && startDate && endDate) {
            return `${format(startDate, 'dd.MM.yyyy')} - ${format(endDate, 'dd.MM.yyyy')}`;
        }
        switch (period) {
            case "week": return "последние 7 дней";
            case "month": return "последние 30 дней";
            case "quarter": return "последние 90 дней";
            case "year": return "последние 365 дней";
            default: return "выбранный период";
        }
    };

    const handleExport = () => {
        if (!data?.campaignStats) return;

        setExporting(true);
        try {
            // Prepare data for Excel
            const exportData = data.campaignStats.map((campaign) => ({
                "Кампания": campaign.name,
                "Всего лидов": campaign.totalLeads,
                "Целевые": campaign.targetLeads,
                "% Целевых": `${campaign.targetPercent.toFixed(1)}%`,
                "Квалифицированные": campaign.qualifiedLeads,
                "% Квал": `${campaign.qualifiedPercent.toFixed(1)}%`,
                "Продажи": campaign.sales,
                "Конверсия %": `${campaign.conversionRate.toFixed(1)}%`,
                "Расходы": campaign.spend || "—",
                "CPL": campaign.cpl ? Math.round(campaign.cpl) : "—",
            }));

            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Set column widths
            ws["!cols"] = [
                { wch: 15 },
                { wch: 12 },
                { wch: 10 },
                { wch: 12 },
                { wch: 18 },
                { wch: 10 },
                { wch: 10 },
                { wch: 12 },
                { wch: 12 },
                { wch: 10 },
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Отчёт по кампаниям");

            // Add summary sheet
            const summaryData = [
                { "Показатель": "Всего лидов", "Значение": data.kpi.totalLeads },
                { "Показатель": "Целевые лиды", "Значение": data.kpi.targetLeads },
                { "Показатель": "% Целевых", "Значение": `${data.kpi.targetPercent.toFixed(1)}%` },
                { "Показатель": "Квалифицированные", "Значение": data.kpi.qualifiedLeads },
                { "Показатель": "Продажи", "Значение": data.kpi.sales },
                { "Показатель": "Конверсия", "Значение": `${data.kpi.conversionRate.toFixed(1)}%` },
            ];

            if (data.kpi.totalSpend) {
                summaryData.push(
                    { "Показатель": "Общие расходы", "Значение": data.kpi.totalSpend },
                    { "Показатель": "CPL", "Значение": data.kpi.cpl || 0 },
                    { "Показатель": "CPO", "Значение": data.kpi.cpo || 0 }
                );
            }

            const wsSummary = XLSX.utils.json_to_sheet(summaryData);
            wsSummary["!cols"] = [{ wch: 20 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, wsSummary, "Сводка");

            // Download
            const date = new Date().toISOString().split("T")[0];
            XLSX.writeFile(wb, `Отчёт_кампании_${date}.xlsx`);
        } catch (err) {
            alert("Ошибка экспорта");
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <p className="text-lg text-destructive mb-2">Ошибка загрузки</p>
                <p className="text-muted-foreground">{error}</p>
            </div>
        );
    }

    if (!data) return null;

    const { campaignStats, kpi } = data;

    // Calculate totals
    const totals = {
        totalLeads: campaignStats.reduce((sum, c) => sum + c.totalLeads, 0),
        targetLeads: campaignStats.reduce((sum, c) => sum + c.targetLeads, 0),
        qualifiedLeads: campaignStats.reduce((sum, c) => sum + c.qualifiedLeads, 0),
        sales: campaignStats.reduce((sum, c) => sum + c.sales, 0),
        spend: campaignStats.reduce((sum, c) => sum + (c.spend || 0), 0),
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Отчёты</h1>
                    <p className="text-muted-foreground mt-1">
                        Аналитика эффективности рекламных кампаний за {getPeriodLabel()}
                    </p>
                </div>

                <div className="flex gap-2 items-center">
                    {/* Filter Button */}
                    <div className="relative">
                        <div
                            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted/50 cursor-pointer bg-background"
                            onClick={() => setShowPeriodPopup(!showPeriodPopup)}
                        >
                            <CalendarDays className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium text-sm">
                                {period === 'custom' ? getPeriodLabel() :
                                    (period === 'week' ? "Неделя" :
                                        period === 'month' ? "Месяц" :
                                            period === 'quarter' ? "Квартал" :
                                                period === 'year' ? "Год" : "Период")}
                            </span>
                        </div>

                        {/* Period Popup */}
                        {showPeriodPopup && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowPeriodPopup(false)}
                                />

                                <div className="absolute right-0 z-50 mt-2 w-72 bg-popover text-popover-foreground rounded-lg shadow-xl border p-4 animate-in fade-in zoom-in-95 duration-200">
                                    <h3 className="font-semibold mb-3 text-sm">Выберите период</h3>

                                    <div className="space-y-1">
                                        {[
                                            { value: 'week', label: 'Неделя', desc: 'Последние 7 дней' },
                                            { value: 'month', label: 'Месяц', desc: 'Последние 30 дней' },
                                            { value: 'quarter', label: 'Квартал', desc: 'Последние 90 дней' },
                                            { value: 'year', label: 'Год', desc: 'Последние 365 дней' },
                                            { value: 'custom', label: '📅 Свой диапазон', desc: 'Выбрать даты вручную' }
                                        ].map(option => (
                                            <div
                                                key={option.value}
                                                className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors ${tempPeriod === option.value ? 'bg-primary/10' : 'hover:bg-muted'
                                                    }`}
                                                onClick={() => setTempPeriod(option.value)}
                                            >
                                                <div className={`mt-0.5 h-4 w-4 rounded-full border border-primary flex items-center justify-center ${tempPeriod === option.value ? 'bg-primary' : ''
                                                    }`}>
                                                    {tempPeriod === option.value && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm">{option.label}</div>
                                                    <div className="text-xs text-muted-foreground">{option.desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        onClick={handleApplyPeriod}
                                        className="w-full mt-4"
                                        size="sm"
                                    >
                                        Применить
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Custom Range Modal */}
                    {showCustomRange && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                            <div className="bg-background rounded-lg shadow-lg w-full max-w-sm p-6 border">
                                <h3 className="text-lg font-semibold mb-4">Выберите диапазон дат</h3>

                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium">Период:</label>
                                        <DatePicker
                                            selected={startDate}
                                            onChange={(update: [Date | null, Date | null]) => {
                                                setDateRange(update);
                                            }}
                                            startDate={startDate}
                                            endDate={endDate}
                                            selectsRange
                                            inline
                                            locale="ru"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button
                                            onClick={handleApplyCustomRange}
                                            disabled={!startDate || !endDate}
                                            className="flex-1"
                                        >
                                            Применить
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowCustomRange(false)}
                                            className="flex-1"
                                        >
                                            Отмена
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <Button onClick={handleExport} disabled={exporting} className="gap-2">
                        {exporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        Экспорт
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{formatNumber(kpi.totalLeads)}</div>
                        <p className="text-sm text-muted-foreground">Всего лидов</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-blue-600">
                            {kpi.targetPercent.toFixed(1)}%
                        </div>
                        <p className="text-sm text-muted-foreground">Целевые</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">
                            {formatNumber(kpi.sales)}
                        </div>
                        <p className="text-sm text-muted-foreground">Продажи</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-amber-600">
                            {kpi.conversionRate.toFixed(1)}%
                        </div>
                        <p className="text-sm text-muted-foreground">Конверсия</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Report Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Отчёт по кампаниям
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all" onValueChange={async (value) => {
                        setActiveTab(value);
                        if (value === 'byWeek' || value === 'byMonth') {
                            setLoading(true);
                            try {
                                let s: string;
                                let e: string;
                                if (startDate && endDate) {
                                    s = format(startDate, 'yyyy-MM-dd');
                                    e = format(endDate, 'yyyy-MM-dd');
                                } else {
                                    const { start, end } = calculatePeriodDates(period);
                                    if (!start || !end) throw new Error("Invalid period");
                                    s = format(start, 'yyyy-MM-dd');
                                    e = format(end, 'yyyy-MM-dd');
                                }
                                const url = `/api/analytics/grouped?viewType=${value}&startDate=${s}&endDate=${e}`;
                                const response = await fetch(url);
                                if (!response.ok) throw new Error("Ошибка загрузки");
                                const result = await response.json();
                                setGroupedData(result);
                            } catch (err) {
                                setError(err instanceof Error ? err.message : "Ошибка");
                            } finally {
                                setLoading(false);
                            }
                        }
                    }}>
                        <TabsList className="mb-4">
                            <TabsTrigger value="all">Все данные</TabsTrigger>
                            <TabsTrigger value="efficiency">Эффективность</TabsTrigger>
                            <TabsTrigger value="byWeek">Неделя</TabsTrigger>
                            <TabsTrigger value="byMonth">Месяц</TabsTrigger>
                        </TabsList>

                        <TabsContent value="all">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Кампания</TableHead>
                                            <TableHead className="text-right">Лиды</TableHead>
                                            <TableHead className="text-right">Целевые</TableHead>
                                            <TableHead className="text-right">% Целевых</TableHead>
                                            <TableHead className="text-right">Квал</TableHead>
                                            <TableHead className="text-right">% Квал</TableHead>
                                            <TableHead className="text-right">Продажи</TableHead>
                                            <TableHead className="text-right">Конверсия</TableHead>
                                            {totals.spend > 0 && (
                                                <>
                                                    <TableHead className="text-right">Расходы</TableHead>
                                                    <TableHead className="text-right">CPL</TableHead>
                                                    <TableHead className="text-right">CPT</TableHead>
                                                    <TableHead className="text-right">CPQ</TableHead>
                                                </>
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {campaignStats.map((campaign) => (
                                            <TableRow key={campaign.name}>
                                                <TableCell className="font-medium">
                                                    {campaign.name}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatNumber(campaign.totalLeads)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatNumber(campaign.targetLeads)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span
                                                        className={
                                                            campaign.targetPercent < 15
                                                                ? "text-red-600 font-medium"
                                                                : campaign.targetPercent > 30
                                                                    ? "text-green-600 font-medium"
                                                                    : ""
                                                        }
                                                    >
                                                        {campaign.targetPercent.toFixed(1)}%
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatNumber(campaign.qualifiedLeads)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span
                                                        className={
                                                            campaign.qualifiedPercent < 10
                                                                ? "text-red-600 font-medium"
                                                                : campaign.qualifiedPercent > 20
                                                                    ? "text-green-600 font-medium"
                                                                    : ""
                                                        }
                                                    >
                                                        {campaign.qualifiedPercent.toFixed(1)}%
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatNumber(campaign.sales)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {campaign.conversionRate.toFixed(1)}%
                                                </TableCell>
                                                {totals.spend > 0 && (
                                                    <>
                                                        <TableCell className="text-right">
                                                            {campaign.spend
                                                                ? formatCurrency(campaign.spend)
                                                                : "—"}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {campaign.cpl ? (
                                                                <span
                                                                    className={
                                                                        campaign.cpl > 3000
                                                                            ? "text-red-600 font-medium"
                                                                            : "text-green-600 font-medium"
                                                                    }
                                                                >
                                                                    {formatCurrency(campaign.cpl)}
                                                                </span>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {campaign.spend && campaign.targetLeads > 0 ? (
                                                                <span className={
                                                                    (campaign.spend / campaign.targetLeads) > 10000
                                                                        ? "text-red-600 font-medium"
                                                                        : "text-green-600 font-medium"
                                                                }>
                                                                    {formatCurrency(campaign.spend / campaign.targetLeads)}
                                                                </span>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {campaign.spend && campaign.qualifiedLeads > 0 ? (
                                                                <span className={
                                                                    (campaign.spend / campaign.qualifiedLeads) > 20000
                                                                        ? "text-red-600 font-medium"
                                                                        : "text-green-600 font-medium"
                                                                }>
                                                                    {formatCurrency(campaign.spend / campaign.qualifiedLeads)}
                                                                </span>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                        ))}

                                        {/* Totals row */}
                                        <TableRow className="bg-muted/50 font-medium">
                                            <TableCell>ИТОГО</TableCell>
                                            <TableCell className="text-right">
                                                {formatNumber(totals.totalLeads)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatNumber(totals.targetLeads)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {totals.totalLeads > 0
                                                    ? ((totals.targetLeads / totals.totalLeads) * 100).toFixed(1)
                                                    : 0}
                                                %
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatNumber(totals.qualifiedLeads)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {totals.totalLeads > 0
                                                    ? ((totals.qualifiedLeads / totals.totalLeads) * 100).toFixed(1)
                                                    : 0}
                                                %
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatNumber(totals.sales)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {totals.totalLeads > 0
                                                    ? ((totals.sales / totals.totalLeads) * 100).toFixed(1)
                                                    : 0}
                                                %
                                            </TableCell>
                                            {totals.spend > 0 && (
                                                <>
                                                    <TableCell className="text-right">
                                                        {formatCurrency(totals.spend)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {totals.totalLeads > 0
                                                            ? formatCurrency(totals.spend / totals.totalLeads)
                                                            : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {totals.targetLeads > 0
                                                            ? formatCurrency(totals.spend / totals.targetLeads)
                                                            : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {totals.qualifiedLeads > 0
                                                            ? formatCurrency(totals.spend / totals.qualifiedLeads)
                                                            : "—"}
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="efficiency">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Top by Leads */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-semibold">
                                            Лидеры по лидам
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {[...campaignStats]
                                                .sort((a, b) => b.totalLeads - a.totalLeads)
                                                .slice(0, 5)
                                                .map((campaign, index) => (
                                                    <div key={campaign.name} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <span className="text-sm font-bold text-muted-foreground w-4">
                                                                {index + 1}
                                                            </span>
                                                            <span className="text-sm font-medium truncate" title={campaign.name}>
                                                                {campaign.name}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-bold">
                                                            {campaign.totalLeads}
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Top by Target */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-semibold text-green-700">
                                            Лидеры по целевым
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {[...campaignStats]
                                                .sort((a, b) => b.targetLeads - a.targetLeads)
                                                .slice(0, 5)
                                                .map((campaign, index) => (
                                                    <div key={campaign.name} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <span className="text-sm font-bold text-muted-foreground w-4">
                                                                {index + 1}
                                                            </span>
                                                            <span className="text-sm font-medium truncate" title={campaign.name}>
                                                                {campaign.name}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-bold text-green-700">
                                                                {campaign.targetLeads}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {campaign.targetPercent.toFixed(0)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Top by Qualified */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-semibold text-blue-700">
                                            Лидеры по квалам
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {[...campaignStats]
                                                .sort((a, b) => b.qualifiedLeads - a.qualifiedLeads)
                                                .slice(0, 5)
                                                .map((campaign, index) => (
                                                    <div key={campaign.name} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <span className="text-sm font-bold text-muted-foreground w-4">
                                                                {index + 1}
                                                            </span>
                                                            <span className="text-sm font-medium truncate" title={campaign.name}>
                                                                {campaign.name}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-bold text-blue-700">
                                                                {campaign.qualifiedLeads}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {campaign.qualifiedPercent.toFixed(0)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Cost-based rankings */}
                            {totals.spend > 0 && (
                                <>
                                    <h4 className="text-sm font-semibold text-muted-foreground mt-6 mb-3">Стоимость лидов</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Cheapest CPL */}
                                        <Card className="border-green-200 bg-green-50/30">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base font-semibold text-green-700">
                                                    🏆 Самые дешёвые лиды
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    {[...campaignStats]
                                                        .filter(c => c.cpl && c.cpl > 0)
                                                        .sort((a, b) => (a.cpl || 0) - (b.cpl || 0))
                                                        .slice(0, 5)
                                                        .map((campaign, index) => (
                                                            <div key={campaign.name} className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <span className="text-xs font-bold text-green-700 w-4">{index + 1}</span>
                                                                    <span className="text-sm truncate" title={campaign.name}>{campaign.name}</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-green-700">{formatCurrency(campaign.cpl || 0)}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Cheapest CPT */}
                                        <Card className="border-green-200 bg-green-50/30">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base font-semibold text-green-700">
                                                    🎯 Самые дешёвые целевые
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    {[...campaignStats]
                                                        .filter(c => c.spend && c.targetLeads > 0)
                                                        .map(c => ({ ...c, cpt: (c.spend || 0) / c.targetLeads }))
                                                        .sort((a, b) => a.cpt - b.cpt)
                                                        .slice(0, 5)
                                                        .map((campaign, index) => (
                                                            <div key={campaign.name} className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <span className="text-xs font-bold text-green-700 w-4">{index + 1}</span>
                                                                    <span className="text-sm truncate" title={campaign.name}>{campaign.name}</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-green-700">{formatCurrency(campaign.cpt)}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Cheapest CPQ */}
                                        <Card className="border-green-200 bg-green-50/30">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base font-semibold text-green-700">
                                                    ✅ Самые дешёвые квалы
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    {[...campaignStats]
                                                        .filter(c => c.spend && c.qualifiedLeads > 0)
                                                        .map(c => ({ ...c, cpq: (c.spend || 0) / c.qualifiedLeads }))
                                                        .sort((a, b) => a.cpq - b.cpq)
                                                        .slice(0, 5)
                                                        .map((campaign, index) => (
                                                            <div key={campaign.name} className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <span className="text-xs font-bold text-green-700 w-4">{index + 1}</span>
                                                                    <span className="text-sm truncate" title={campaign.name}>{campaign.name}</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-green-700">{formatCurrency(campaign.cpq)}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                        {/* Most Expensive CPL */}
                                        <Card className="border-red-200 bg-red-50/30">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base font-semibold text-red-700">
                                                    💸 Самые дорогие лиды
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    {[...campaignStats]
                                                        .filter(c => c.cpl && c.cpl > 0)
                                                        .sort((a, b) => (b.cpl || 0) - (a.cpl || 0))
                                                        .slice(0, 5)
                                                        .map((campaign, index) => (
                                                            <div key={campaign.name} className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <span className="text-xs font-bold text-red-700 w-4">{index + 1}</span>
                                                                    <span className="text-sm truncate" title={campaign.name}>{campaign.name}</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-red-700">{formatCurrency(campaign.cpl || 0)}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Most Expensive CPT */}
                                        <Card className="border-red-200 bg-red-50/30">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base font-semibold text-red-700">
                                                    🎯 Самые дорогие целевые
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    {[...campaignStats]
                                                        .filter(c => c.spend && c.targetLeads > 0)
                                                        .map(c => ({ ...c, cpt: (c.spend || 0) / c.targetLeads }))
                                                        .sort((a, b) => b.cpt - a.cpt)
                                                        .slice(0, 5)
                                                        .map((campaign, index) => (
                                                            <div key={campaign.name} className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <span className="text-xs font-bold text-red-700 w-4">{index + 1}</span>
                                                                    <span className="text-sm truncate" title={campaign.name}>{campaign.name}</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-red-700">{formatCurrency(campaign.cpt)}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Most Expensive CPQ */}
                                        <Card className="border-red-200 bg-red-50/30">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base font-semibold text-red-700">
                                                    ❌ Самые дорогие квалы
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    {[...campaignStats]
                                                        .filter(c => c.spend && c.qualifiedLeads > 0)
                                                        .map(c => ({ ...c, cpq: (c.spend || 0) / c.qualifiedLeads }))
                                                        .sort((a, b) => b.cpq - a.cpq)
                                                        .slice(0, 5)
                                                        .map((campaign, index) => (
                                                            <div key={campaign.name} className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <span className="text-xs font-bold text-red-700 w-4">{index + 1}</span>
                                                                    <span className="text-sm truncate" title={campaign.name}>{campaign.name}</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-red-700">{formatCurrency(campaign.cpq)}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        {/* Weekly View */}
                        <TabsContent value="byWeek">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : groupedData && groupedData.periods.length > 0 ? (
                                <div className="space-y-6">
                                    {groupedData.periods.map((period) => (
                                        <Card key={period.name} className="border-2">
                                            <CardHeader className="bg-muted/30">
                                                <CardTitle className="text-lg flex items-center justify-between">
                                                    <span>{period.name}</span>
                                                    <span className="text-sm font-normal text-muted-foreground">
                                                        {period.startDate} — {period.endDate}
                                                    </span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-6">
                                                <PeriodTable period={period} />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    Нет данных за выбранный период
                                </div>
                            )}
                        </TabsContent>

                        {/* Monthly View */}
                        <TabsContent value="byMonth">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : groupedData && groupedData.periods.length > 0 ? (
                                <div className="space-y-6">
                                    {groupedData.periods.map((period) => (
                                        <Card key={period.name} className="border-2">
                                            <CardHeader className="bg-muted/30">
                                                <CardTitle className="text-lg flex items-center justify-between">
                                                    <span>{period.name}</span>
                                                    <span className="text-sm font-normal text-muted-foreground">
                                                        {period.startDate} — {period.endDate}
                                                    </span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-6">
                                                <PeriodTable period={period} />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    Нет данных за выбранный период
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
