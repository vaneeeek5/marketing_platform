"use client";

import { useEffect, useState } from "react";
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
import { CampaignStats, AnalyticsResponse } from "@/types";
import { formatNumber, formatCurrency, formatPercent } from "@/lib/utils";
import { FileText, Download, Loader2, BarChart3 } from "lucide-react";
import * as XLSX from "xlsx";

export default function ReportsPage() {
    const [data, setData] = useState<AnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch("/api/analytics/summary");
                if (!response.ok) throw new Error("Ошибка загрузки данных");
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Неизвестная ошибка");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

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
                        Аналитика эффективности рекламных кампаний
                    </p>
                </div>

                <Button onClick={handleExport} disabled={exporting} className="gap-2">
                    {exporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    Экспорт в Excel
                </Button>
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
                    <Tabs defaultValue="all">
                        <TabsList className="mb-4">
                            <TabsTrigger value="all">Все данные</TabsTrigger>
                            <TabsTrigger value="efficiency">Эффективность</TabsTrigger>
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
                                            <TableHead className="text-right">Продажи</TableHead>
                                            <TableHead className="text-right">Конверсия</TableHead>
                                            {totals.spend > 0 && (
                                                <>
                                                    <TableHead className="text-right">Расходы</TableHead>
                                                    <TableHead className="text-right">CPL</TableHead>
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
                                                </>
                                            )}
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="efficiency">
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Best performing */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base text-green-600">
                                            🏆 Лучшие кампании
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {[...campaignStats]
                                                .sort((a, b) => b.targetPercent - a.targetPercent)
                                                .slice(0, 3)
                                                .map((campaign, index) => (
                                                    <div
                                                        key={campaign.name}
                                                        className="flex items-center justify-between"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-lg font-bold text-muted-foreground">
                                                                {index + 1}
                                                            </span>
                                                            <span className="font-medium">{campaign.name}</span>
                                                        </div>
                                                        <span className="text-green-600 font-medium">
                                                            {campaign.targetPercent.toFixed(1)}% целевых
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Needs improvement */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base text-amber-600">
                                            ⚠️ Требуют внимания
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {[...campaignStats]
                                                .filter((c) => c.targetPercent < 20 && c.totalLeads >= 5)
                                                .sort((a, b) => a.targetPercent - b.targetPercent)
                                                .slice(0, 3)
                                                .map((campaign) => (
                                                    <div
                                                        key={campaign.name}
                                                        className="flex items-center justify-between"
                                                    >
                                                        <span className="font-medium">{campaign.name}</span>
                                                        <span className="text-red-600 font-medium">
                                                            {campaign.targetPercent.toFixed(1)}% целевых
                                                        </span>
                                                    </div>
                                                ))}
                                            {campaignStats.filter(
                                                (c) => c.targetPercent < 20 && c.totalLeads >= 5
                                            ).length === 0 && (
                                                    <p className="text-muted-foreground text-sm">
                                                        Все кампании работают эффективно
                                                    </p>
                                                )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
