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
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Loader2, CalendarDays, Wallet } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ru } from 'date-fns/locale';
import { format } from 'date-fns';
import { registerLocale } from "react-datepicker";
registerLocale('ru', ru);

import { ExpenseData } from "@/lib/metrika";

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<ExpenseData[]>([]);
    const [totalSpend, setTotalSpend] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            let s: string | undefined;
            let e: string | undefined;

            if (selectedPeriod === "custom" && customStart && customEnd) {
                // Custom range
                s = format(customStart, 'yyyy-MM-dd');
                e = format(customEnd, 'yyyy-MM-dd');
            } else {
                const { start, end } = calculatePeriodDates(selectedPeriod);
                if (start && end) {
                    s = format(start, 'yyyy-MM-dd');
                    e = format(end, 'yyyy-MM-dd');
                }
            }

            if (!s || !e) {
                // Should not happen for valid periods, but handle safety
                setLoading(false);
                return;
            }

            const response = await fetch(`/api/expenses?startDate=${s}&endDate=${e}`);
            if (!response.ok) throw new Error("Ошибка загрузки данных");

            const result = await response.json();
            setExpenses(result.expenses || []);
            setTotalSpend(result.total?.spend || 0);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Неизвестная ошибка");
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
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

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Расходы</h1>
                    <p className="text-muted-foreground mt-1">
                        Статистика расходов по кампаниям за {getPeriodLabel()}
                    </p>
                </div>

                {/* Period Filter */}
                <div className="flex gap-2 items-center">
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
                </div>
            </div>

            {/* Total Card */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Общий расход</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                formatCurrency(totalSpend)
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Суммарный расход за период
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Расход по кампаниям</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    {loading ? (
                        <div className="flex items-center justify-center min-h-[200px]">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                        <div className="text-center text-destructive py-8">{error}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Кампания</TableHead>
                                    <TableHead>Визиты</TableHead>
                                    <TableHead>CPC (ср.)</TableHead>
                                    <TableHead className="text-right">Расход</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                            Нет данных о расходах за этот период
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    expenses.map((item) => (
                                        <TableRow key={item.campaign}>
                                            <TableCell className="font-medium">{item.campaign}</TableCell>
                                            <TableCell>{item.visits}</TableCell>
                                            <TableCell>{formatCurrency(item.cpc)}</TableCell>
                                            <TableCell className="text-right font-bold">
                                                {formatCurrency(item.spend)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
