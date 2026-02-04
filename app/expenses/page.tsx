"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { Loader2, Wallet, Calendar, ChevronDown } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ru } from 'date-fns/locale';
import {
    format,
    subDays,
    startOfMonth,
    endOfMonth,
    subMonths,
    startOfWeek,
    endOfWeek,
    subWeeks,
    isAfter,
    differenceInDays
} from 'date-fns';
import { registerLocale } from "react-datepicker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

registerLocale('ru', ru);

import { ExpenseData } from "@/lib/metrika";

type ViewMode = 'month' | 'week';

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<ExpenseData[]>([]);
    const [campaignDictionary, setCampaignDictionary] = useState<string[]>([]);
    const [totalSpend, setTotalSpend] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // View Mode state
    const [viewMode, setViewMode] = useState<ViewMode>('month');

    // Data range state
    // We track the continuous range of loaded data: from `earliestLoadedDate` to `yesterday`
    const [earliestLoadedDate, setEarliestLoadedDate] = useState<Date | null>(null);
    const [latestLoadedDate, setLatestLoadedDate] = useState<Date | null>(null); // Anchor (usually yesterday)

    // Campaign filter state
    const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
    const [showCampaignFilter, setShowCampaignFilter] = useState(false);
    const [hasDirectAccess, setHasDirectAccess] = useState(true);

    // AbortController to manage pending requests
    const abortControllerRef = useRef<AbortController | null>(null);

    // Get unique campaign names from expenses + dictionary
    const allCampaigns = Array.from(new Set([
        ...expenses.map(e => e.campaign),
        ...campaignDictionary
    ])).sort();

    // Filter expenses
    const filteredExpenses = selectedCampaigns.size === 0
        ? expenses
        : expenses.filter(e => selectedCampaigns.has(e.campaign));

    const filteredTotalSpend = filteredExpenses.reduce((sum, e) => sum + e.spend, 0);

    // Helper: Get 'Yesterday' as the fixed end date
    const getAnchorDate = () => subDays(new Date(), 1);

    // Helper: Calculate initial range for a mode
    const getInitialRange = (mode: ViewMode) => {
        const end = getAnchorDate();
        let start: Date;

        if (mode === 'month') {
            start = startOfMonth(end);
        } else {
            // Week starts on Monday
            start = startOfWeek(end, { weekStartsOn: 1 });
        }
        return { start, end };
    };

    // Helper: Calculate NEXT previous chunk based on current earliest date
    const getNextPreviousChunk = (currentEarliest: Date, mode: ViewMode) => {
        // The new chunk ends strictly before the current earliest
        const end = subDays(currentEarliest, 1);
        let start: Date;

        if (mode === 'month') {
            start = startOfMonth(end);
        } else {
            start = startOfWeek(end, { weekStartsOn: 1 });
        }
        return { start, end };
    };

    // Reset and load initial data when View Mode changes
    useEffect(() => {
        const { start, end } = getInitialRange(viewMode);

        // Reset state
        setExpenses([]);
        setCampaignDictionary([]);
        setTotalSpend(0);
        setEarliestLoadedDate(start);
        setLatestLoadedDate(end);

        loadChunk(start, end, true);
    }, [viewMode]);

    const loadChunk = async (start: Date, end: Date, isReset: boolean) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setLoading(true);
        setError(null);

        try {
            const sStr = format(start, 'yyyy-MM-dd');
            const eStr = format(end, 'yyyy-MM-dd');

            console.log(`Loading chunk: ${sStr} to ${eStr}`);

            const response = await fetch(`/api/expenses?startDate=${sStr}&endDate=${eStr}`, {
                signal: abortController.signal
            });

            if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);

            const result = await response.json();

            // Merge Logic
            setExpenses(prev => {
                const base = isReset ? [] : prev;
                const newItems = result.expenses || [];

                // Merge map
                const map = new Map<string, ExpenseData>();

                // Add existing
                base.forEach(item => map.set(item.campaign, { ...item }));

                // Merge new
                newItems.forEach((item: ExpenseData) => {
                    const key = item.campaign;
                    if (map.has(key)) {
                        const existing = map.get(key)!;
                        existing.spend += item.spend;
                        existing.visits += item.visits;
                        // Recalculate CPC
                        existing.cpc = existing.visits > 0 ? existing.spend / existing.visits : 0;
                    } else {
                        map.set(key, item);
                    }
                });

                return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
            });

            // Update Dictionary
            setCampaignDictionary(prev => {
                const newDict = new Set(isReset ? [] : prev);
                if (result.campaignDictionary) {
                    result.campaignDictionary.forEach((c: string) => newDict.add(c));
                }
                return Array.from(newDict).sort();
            });

            // Update Total Spend
            setTotalSpend(prev => (isReset ? 0 : prev) + (result.total?.spend || 0));

            // Check direct access access
            if (result.hasDirectAccess !== undefined) {
                setHasDirectAccess(result.hasDirectAccess);
            }

            // Update Earliest Date if successful
            if (!isReset) {
                setEarliestLoadedDate(start);
            }

        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : "Неизвестная ошибка");
        } finally {
            if (!abortController.signal.aborted) {
                setLoading(false);
            }
        }
    };

    const handleLoadMore = () => {
        if (!earliestLoadedDate) return;

        const { start, end } = getNextPreviousChunk(earliestLoadedDate, viewMode);
        loadChunk(start, end, false);
    };

    const getFormattedRange = () => {
        if (!earliestLoadedDate || !latestLoadedDate) return "Загрузка...";
        return `${format(earliestLoadedDate, 'd MMMM yyyy', { locale: ru })} - ${format(latestLoadedDate, 'd MMMM yyyy', { locale: ru })}`;
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Расходы</h1>
                    <p className="text-muted-foreground mt-1">
                        Данные за период: <span className="font-medium text-foreground">{getFormattedRange()}</span>
                    </p>
                </div>

                <div className="flex gap-2 items-center">
                    {/* View Mode Switcher */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {viewMode === 'month' ? 'По месяцам' : 'По неделям'}
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewMode('month')}>
                                По месяцам
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setViewMode('week')}>
                                По неделям
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Campaign Filter */}
                    <div className="relative">
                        <div
                            className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted/50 cursor-pointer bg-background ${selectedCampaigns.size > 0 ? 'border-primary' : ''}`}
                            onClick={() => setShowCampaignFilter(!showCampaignFilter)}
                        >
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                                {selectedCampaigns.size === 0 ? 'Все кампании' :
                                    selectedCampaigns.size === 1 ? Array.from(selectedCampaigns)[0] :
                                        `${selectedCampaigns.size} кампаний`}
                            </span>
                        </div>

                        {/* Campaign Filter Popup */}
                        {showCampaignFilter && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowCampaignFilter(false)}
                                />
                                <div className="absolute right-0 z-50 mt-2 w-64 bg-popover text-popover-foreground rounded-lg shadow-xl border p-4 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-sm">Кампании</h3>
                                        {selectedCampaigns.size > 0 && (
                                            <button
                                                className="text-sm text-primary hover:underline"
                                                onClick={() => setSelectedCampaigns(new Set())}
                                            >
                                                Сбросить
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                        {allCampaigns.length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-2">Нет доступных кампаний</p>
                                        ) : (
                                            allCampaigns.map(campaign => (
                                                <label
                                                    key={campaign}
                                                    className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCampaigns.has(campaign)}
                                                        onChange={(e) => {
                                                            const newSet = new Set(selectedCampaigns);
                                                            if (e.target.checked) newSet.add(campaign);
                                                            else newSet.delete(campaign);
                                                            setSelectedCampaigns(newSet);
                                                        }}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    />
                                                    <span className="text-sm">{campaign}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Direct Login Warning */}
            {!loading && !hasDirectAccess && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800">
                    <Wallet className="h-5 w-5 shrink-0" />
                    <div>
                        <p className="text-sm font-medium">Логин Яндекс.Директ не указан</p>
                        <p className="text-sm mt-1 opacity-90">
                            Чтобы видеть расходы по кампаниям, укажите логин в <a href="/settings" className="underline font-semibold hover:text-amber-900">Настройках</a>.
                            Сейчас отображаются только визиты.
                        </p>
                    </div>
                </div>
            )}

            {/* Total Card */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Общий расход</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(filteredTotalSpend)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {selectedCampaigns.size > 0 ? `Сумма по выбранным кампаниям` : 'Суммарный расход за загруженный период'}
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
                    {expenses.length === 0 && loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[200px] gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Загрузка данных...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center text-destructive py-8">{error}</div>
                    ) : (
                        <div className="space-y-4">
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
                                    {filteredExpenses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                                {selectedCampaigns.size > 0 ? 'Нет данных для выбранных кампаний' : 'Нет данных'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredExpenses.map((item) => (
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

                            {/* Load More Button */}
                            <div className="flex justify-center pt-4">
                                <Button
                                    variant="secondary"
                                    onClick={handleLoadMore}
                                    disabled={loading}
                                    className="min-w-[200px]"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Загрузка...
                                        </>
                                    ) : (
                                        `Загрузить предыдущий ${viewMode === 'month' ? 'месяц' : 'неделю'}`
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
