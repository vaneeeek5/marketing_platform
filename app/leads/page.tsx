"use client";

import { toast } from "sonner";
import { successNotification } from "@/lib/notifications";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lead, LeadsResponse } from "@/types";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";
import CampaignBadge from "@/components/CampaignBadge";
import { formatDate, formatTime, parseDate } from "@/lib/utils";
import {
    Loader2,
    Filter,
    Save,
    X,
    Search,
    Users,
    Calendar,
    ArrowUpDown,
    CopyCheck,
    RefreshCw,
    Settings,
} from "lucide-react";

const RESET_OPTION = { value: "-", label: "-" };

const STATUS_OPTIONS = [
    RESET_OPTION,
    { value: "квал", label: "Квал" },
    { value: "дубль", label: "Дубль" },
    { value: "обычный", label: "Обычный" },
    { value: "закрыто", label: "Закрыто" },
    { value: "empty", label: "Без статуса" },
];

const TARGET_OPTIONS = [
    RESET_OPTION,
    { value: "Целевой", label: "Целевой" },
    { value: "СПАМ", label: "СПАМ" },
    { value: "Не было в такое время лида", label: "Не было в такое время лида" },
    { value: "Недозвон", label: "Недозвон" },
    { value: "Дубль", label: "Дубль" },
    { value: "empty", label: "Без статуса" },
];

function getTargetStatusColor(status: string | number | null | undefined) {
    const s = String(status || "").toLowerCase().trim();
    if (s === 'целевой') return { backgroundColor: '#dcfce7', color: '#166534' }; // Green
    if (s === 'спам') return { backgroundColor: '#fee2e2', color: '#991b1b' }; // Red
    if (s === 'дубль') return { backgroundColor: '#fef3c7', color: '#854d0e' }; // Yellow
    if (s === 'недозвон') return { backgroundColor: '#dbeafe', color: '#1e40af' }; // Blue
    if (s.includes('не было')) return { backgroundColor: '#fecaca', color: '#991b1b' }; // Bright Red
    return { backgroundColor: '#f3f4f6', color: '#6b7280' }; // Gray default
}

function getQualificationColor(status: string | number | null | undefined) {
    const s = String(status || "").toLowerCase().trim();
    if (s.includes('квал')) return { backgroundColor: '#dcfce7', color: '#166534' }; // Green
    if (s === 'дубль') return { backgroundColor: '#fee2e2', color: '#991b1b' }; // Red
    if (s === 'обычный') return { backgroundColor: '#dbeafe', color: '#1e40af' }; // Blue
    if (s === 'закрыто') return { backgroundColor: '#e5e7eb', color: '#374151' }; // Gray-Dark
    return { backgroundColor: '#f3f4f6', color: '#6b7280' }; // Gray default
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [campaigns, setCampaigns] = useState<string[]>([]);
    const [currentSheet, setCurrentSheet] = useState(CURRENT_MONTH_SHEET);

    // Filters
    // Filters
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]); // Multi-select
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]); // Multi-select
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]); // Multi-select
    const [searchQuery, setSearchQuery] = useState<string>("");

    // UI toggles
    const [showCampaignFilter, setShowCampaignFilter] = useState(false);
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [showTargetFilter, setShowTargetFilter] = useState(false);

    // Sync state
    const [syncing, setSyncing] = useState(false);

    // Goals selection state
    const [availableGoals, setAvailableGoals] = useState<{ id: number; name: string; type: string }[]>([]);
    const [selectedGoalIds, setSelectedGoalIds] = useState<number[]>([]);
    const [showGoalsFilter, setShowGoalsFilter] = useState(false); // Used for UI toggle now
    const [loadingGoals, setLoadingGoals] = useState(false);
    const [showSettings, setShowSettings] = useState(false); // Collapsible settings block

    // Date Filter State
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Edit state
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<{
        qualification: string;
        comment: string;
        sales: string;
    }>({ qualification: "", comment: "", sales: "" });
    const [saving, setSaving] = useState(false);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{
        key: 'date' | 'campaign' | null;
        direction: 'asc' | 'desc';
    }>({ key: null, direction: 'asc' });

    const handleSort = (key: 'date' | 'campaign') => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedLeads = useMemo(() => {
        if (!sortConfig.key) return filteredLeads;

        return [...filteredLeads].sort((a, b) => {
            const aVal = sortConfig.key === 'date' ? a.date : (a.campaign || '');
            const bVal = sortConfig.key === 'date' ? b.date : (b.campaign || '');

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredLeads, sortConfig]);

    const handleCheckDuplicates = async () => {
        const toastId = toast.loading("Проверка дублей...");
        try {
            const response = await fetch("/api/leads/check-duplicates", {
                method: "POST",
            });
            const result = await response.json();

            if (result.success) {
                toast.dismiss(toastId);
                successNotification(result.message);
                fetchLeads();
            } else {
                toast.dismiss(toastId);
                toast.error("Ошибка проверки: " + result.error);
            }
        } catch (err) {
            toast.dismiss(toastId);
            toast.error("Ошибка при выполнении запроса");
        }
    };

    const fetchLeads = useCallback(async () => {
        if (!currentSheet) return;

        setLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        try {
            const response = await fetch(
                `/api/leads?sheet=${encodeURIComponent(currentSheet)}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Ошибка загрузки данных: ${response.status}`);
            }

            const result: LeadsResponse = await response.json();
            setLeads(result.leads);

            // Extract unique campaigns
            const uniqueCampaigns = Array.from(
                new Set(result.leads.map((l) => l.campaign).filter(Boolean))
            );
            setCampaigns(uniqueCampaigns);
            setError(null);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError("Превышено время ожидания загрузки (timeout 15s). Попробуйте обновить страницу.");
                toast.error("Слишком долгая загрузка");
            } else {
                setError(err instanceof Error ? err.message : "Неизвестная ошибка");
                toast.error("Не удалось загрузить лиды");
            }
        } finally {
            setLoading(false);
        }
    }, [currentSheet]);

    // Load available goals and settings
    const loadGoalsAndSettings = useCallback(async () => {
        setLoadingGoals(true);
        try {
            const goalsRes = await fetch("/api/metrika/goals");
            if (goalsRes.ok) {
                const goalsData = await goalsRes.json();
                setAvailableGoals(goalsData.goals || []);
            }

            const settingsRes = await fetch("/api/metrika/settings");
            if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                if (settingsData.goals) {
                    const selected = Object.entries(settingsData.goals)
                        .filter(([_, enabled]) => enabled)
                        .map(([id, _]) => Number(id));
                    setSelectedGoalIds(selected);
                }
            }
        } catch (err) {
            console.error("Error loading goals:", err);
        } finally {
            setLoadingGoals(false);
        }
    }, []);

    const saveGoalSettings = async () => {
        try {
            const goalsObject: Record<string, boolean> = {};
            availableGoals.forEach(goal => {
                goalsObject[String(goal.id)] = selectedGoalIds.includes(goal.id);
            });

            const response = await fetch("/api/metrika/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goals: goalsObject })
            });

            if (response.ok) {
                successNotification("Настройки целей сохранены");
            } else {
                toast.error("Ошибка сохранения настроек");
            }
        } catch (err) {
            toast.error("Ошибка сети");
        }
    };

    const toggleGoal = (goalId: number) => {
        setSelectedGoalIds(prev =>
            prev.includes(goalId)
                ? prev.filter(id => id !== goalId)
                : [...prev, goalId]
        );
    };

    useEffect(() => {
        fetchLeads();
        loadGoalsAndSettings();
    }, [currentSheet, fetchLeads, loadGoalsAndSettings]);

    // Apply filters
    useEffect(() => {
        let filtered = [...leads];

        // Campaign Filter
        if (selectedCampaigns.length > 0) {
            filtered = filtered.filter((l) =>
                selectedCampaigns.includes(l.campaign)
            );
        }

        // Status Filter (Multi-select)
        if (selectedStatuses.length > 0) {
            filtered = filtered.filter((l) =>
                selectedStatuses.some(status => {
                    if (status === 'empty') {
                        return !l.qualification || l.qualification.trim() === '';
                    }
                    return l.qualification?.toLowerCase().trim() === status.toLowerCase().trim();
                })
            );
        }

        // Target Filter (Multi-select)
        if (selectedTargets.length > 0) {
            filtered = filtered.filter((l) =>
                selectedTargets.some(target => {
                    const val = l["Целевой"];
                    if (target === 'empty') {
                        return !val || String(val).trim() === '';
                    }
                    return String(val || "").toLowerCase().trim() === target.toLowerCase().trim();
                })
            );
        }

        // Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (l) =>
                    l.comment?.toLowerCase().includes(query) ||
                    l.campaign?.toLowerCase().includes(query) ||
                    l.date?.includes(query)
            );
        }

        // Date Filter
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            filtered = filtered.filter((l) => {
                const date = parseDate(l.date);
                if (!date) return false;
                return date >= start && date <= end;
            });
        }

        setFilteredLeads(filtered);
    }, [leads, selectedCampaigns, selectedStatuses, selectedTargets, searchQuery, startDate, endDate]);

    const handleEdit = (lead: Lead) => {
        setEditingRow(lead.rowIndex);
        setEditValues({
            qualification: lead.qualification,
            comment: lead.comment,
            sales: lead.sales,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({ qualification: "", comment: "", sales: "" });
    };

    const handleInlineUpdate = async (rowIndex: number, field: string, value: string) => {
        const effectiveValue = value === '-' ? '' : value;
        const previousLeads = [...leads];
        setLeads((prev) =>
            prev.map((lead) =>
                lead.rowIndex === rowIndex
                    ? { ...lead, [field === 'target' ? 'Целевой' : 'qualification']: effectiveValue }
                    : lead
            )
        );

        try {
            const response = await fetch("/api/leads", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sheetName: currentSheet,
                    rowIndex,
                    field,
                    value: effectiveValue,
                }),
            });

            if (!response.ok) throw new Error("Ошибка обновления");
            successNotification("Статус обновлен");
        } catch (err) {
            setLeads(previousLeads);
            toast.error("Ошибка при обновлении статуса");
        }
    };

    const handleSave = async (rowIndex: number) => {
        setSaving(true);
        try {
            if (editValues.sales !== undefined) {
                await fetch("/api/leads", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sheetName: currentSheet,
                        rowIndex,
                        field: "sales",
                        value: editValues.sales,
                    }),
                });
            }

            if (editValues.comment !== undefined) {
                await fetch("/api/leads", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sheetName: currentSheet,
                        rowIndex,
                        field: "comment",
                        value: editValues.comment,
                    }),
                });
            }

            setLeads((prev) =>
                prev.map((lead) =>
                    lead.rowIndex === rowIndex
                        ? {
                            ...lead,
                            sales: editValues.sales,
                            comment: editValues.comment,
                        }
                        : lead
                )
            );

            setEditingRow(null);
            successNotification("Изменения сохранены");
        } catch (err) {
            toast.error("Ошибка сохранения");
        } finally {
            setSaving(false);
        }
    };

    if (loading && leads.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error && leads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <p className="text-lg text-destructive mb-2">Ошибка загрузки</p>
                <p className="text-muted-foreground">{error}</p>
            </div>
        );
    }



    const handleSmartSync = async () => {
        if (selectedGoalIds.length === 0) {
            toast.error("Выберите хотя бы одну цель для загрузки лидов");
            return;
        }

        setSyncing(true);
        const toastId = toast.loading("Синхронизация с Метрикой (данные обрабатываются с задержкой, берем по вчерашний день)...");
        try {
            // Calculate dates: Yesterday and 30 days ago
            // Metrika Logs API requires date2 < today
            const end = new Date();
            end.setDate(end.getDate() - 1); // Yesterday

            const start = new Date();
            start.setDate(end.getDate() - 30); // 30 days before that

            const dateTo = end.toISOString().split('T')[0];
            const dateFrom = start.toISOString().split('T')[0];

            const response = await fetch("/api/sync/metrika", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dateFrom,
                    dateTo,
                    goalIds: selectedGoalIds,
                    manual: true,
                    // No 'action: clean' - this ensures we append/deduplicate
                })
            });

            const result = await response.json();

            if (result.success) {
                toast.dismiss(toastId);
                successNotification(`Синхронизация завершена. Добавлено: ${result.added}, Пропущено (дубли): ${result.skipped}`);
                fetchLeads(); // Refresh table
            } else {
                toast.dismiss(toastId);
                toast.error(`Ошибка синхронизации: ${result.message || result.error}`);
            }
        } catch (err) {
            toast.dismiss(toastId);
            toast.error("Ошибка сети при синхронизации");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Лиды</h1>
                    <p className="text-muted-foreground mt-1">
                        Управление лидами
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSettings(!showSettings)}
                        className={showSettings ? "bg-muted" : ""}
                        title="Настройки целей"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSmartSync}
                        disabled={syncing || loading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {syncing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {syncing ? "Синхронизация..." : "Подгрузить лиды"}
                    </Button>

                    <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading || syncing}>
                        <Filter className="mr-2 h-4 w-4" />
                        Обновить таблицу
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Фильтры
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Поиск по комментарию, кампании..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Campaign filter */}

                        {/* Campaign Filter Multi-Select */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                className="w-full justify-between sm:w-[200px]"
                                onClick={() => setShowCampaignFilter(!showCampaignFilter)}
                            >
                                <span className="truncate">
                                    {selectedCampaigns.length === 0
                                        ? "Все кампании"
                                        : `Кампании: ${selectedCampaigns.length}`}
                                </span>
                                <Filter className="h-4 w-4 opacity-50" />
                            </Button>

                            {showCampaignFilter && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowCampaignFilter(false)}
                                    />
                                    <div className="absolute z-50 mt-2 w-56 bg-popover text-popover-foreground rounded-lg shadow-xl border p-3 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between mb-2 pb-2 border-b">
                                            <span className="font-medium text-sm">Кампании</span>
                                            <span
                                                className="text-xs text-primary cursor-pointer hover:underline"
                                                onClick={() => setSelectedCampaigns([])}
                                            >
                                                Сбросить
                                            </span>
                                        </div>
                                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                            {campaigns.map((campaign) => {
                                                const isSelected = selectedCampaigns.includes(campaign);
                                                return (
                                                    <div
                                                        key={campaign}
                                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md cursor-pointer"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedCampaigns(prev => prev.filter(s => s !== campaign));
                                                            } else {
                                                                setSelectedCampaigns(prev => [...prev, campaign]);
                                                            }
                                                        }}
                                                    >
                                                        <div className={`h-4 w-4 rounded border flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-input"}`}>
                                                            {isSelected && <div className="h-2.5 w-3.5 bg-primary-foreground mask-check" style={{ clipPath: "polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)", backgroundColor: "white" }} />}
                                                        </div>
                                                        <span className="text-sm">{campaign}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Target Filter Multi-Select */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                className="w-full justify-between sm:w-[200px]"
                                onClick={() => setShowTargetFilter(!showTargetFilter)}
                            >
                                <span className="truncate">
                                    {selectedTargets.length === 0
                                        ? "Все целевые"
                                        : `Целевые: ${selectedTargets.length}`}
                                </span>
                                <Filter className="h-4 w-4 opacity-50" />
                            </Button>

                            {showTargetFilter && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowTargetFilter(false)}
                                    />
                                    <div className="absolute z-50 mt-2 w-56 bg-popover text-popover-foreground rounded-lg shadow-xl border p-3 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between mb-2 pb-2 border-b">
                                            <span className="font-medium text-sm">Целевой статус</span>
                                            <span
                                                className="text-xs text-primary cursor-pointer hover:underline"
                                                onClick={() => setSelectedTargets([])}
                                            >
                                                Сбросить
                                            </span>
                                        </div>
                                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                            {TARGET_OPTIONS.filter(o => o.value !== '-').map((option) => {
                                                const isSelected = selectedTargets.includes(option.value);
                                                return (
                                                    <div
                                                        key={option.value}
                                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md cursor-pointer"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedTargets(prev => prev.filter(s => s !== option.value));
                                                            } else {
                                                                setSelectedTargets(prev => [...prev, option.value]);
                                                            }
                                                        }}
                                                    >
                                                        <div className={`h-4 w-4 rounded border flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-input"}`}>
                                                            {isSelected && <div className="h-2.5 w-3.5 bg-primary-foreground mask-check" style={{ clipPath: "polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)", backgroundColor: "white" }} />}
                                                        </div>
                                                        <span className="text-sm">{option.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Status Filter Multi-Select */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                className="w-full justify-between sm:w-[200px]"
                                onClick={() => setShowStatusFilter(!showStatusFilter)}
                            >
                                <span className="truncate">
                                    {selectedStatuses.length === 0
                                        ? "Все статусы"
                                        : `Выбрано: ${selectedStatuses.length}`}
                                </span>
                                <Filter className="h-4 w-4 opacity-50" />
                            </Button>

                            {showStatusFilter && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowStatusFilter(false)}
                                    />
                                    <div className="absolute z-50 mt-2 w-56 bg-popover text-popover-foreground rounded-lg shadow-xl border p-3 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between mb-2 pb-2 border-b">
                                            <span className="font-medium text-sm">Статусы</span>
                                            <span
                                                className="text-xs text-primary cursor-pointer hover:underline"
                                                onClick={() => setSelectedStatuses([])}
                                            >
                                                Сбросить
                                            </span>
                                        </div>
                                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                            {STATUS_OPTIONS.filter(o => o.value !== '-').map((option) => {
                                                const isSelected = selectedStatuses.includes(option.value);
                                                return (
                                                    <div
                                                        key={option.value}
                                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md cursor-pointer"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedStatuses(prev => prev.filter(s => s !== option.value));
                                                            } else {
                                                                setSelectedStatuses(prev => [...prev, option.value]);
                                                            }
                                                        }}
                                                    >
                                                        <div className={`h-4 w-4 rounded border flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-input"}`}>
                                                            {isSelected && <div className="h-2.5 w-3.5 bg-primary-foreground mask-check" style={{ clipPath: "polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)", backgroundColor: "white" }} />}
                                                        </div>
                                                        <span className="text-sm">{option.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Date Filter */}
                        <div className="relative w-full sm:w-auto">
                            <Button
                                variant="outline"
                                className="w-full justify-between sm:w-[240px]"
                                onClick={() => setShowDatePicker(!showDatePicker)}
                            >
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span>
                                        {startDate && endDate
                                            ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                                            : "Выберите период"}
                                    </span>
                                </div>
                                {startDate && endDate && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setStartDate("");
                                            setEndDate("");
                                            setShowDatePicker(false);
                                        }}
                                        className="ml-2 hover:bg-muted rounded-full p-0.5"
                                    >
                                        <X className="h-3 w-3" />
                                    </div>
                                )}
                            </Button>

                            {/* Popup */}
                            {showDatePicker && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowDatePicker(false)}
                                    />
                                    <div className="absolute z-50 mt-2 right-0 top-full bg-popover text-popover-foreground rounded-lg shadow-xl border p-4 w-[300px]">
                                        <h3 className="font-semibold mb-3">Период дат</h3>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    С какой даты:
                                                </label>
                                                <Input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    По какую дату:
                                                </label>
                                                <Input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    min={startDate}
                                                    className="w-full"
                                                />
                                            </div>

                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    size="sm"
                                                    className="flex-1"
                                                    disabled={!startDate || !endDate}
                                                    onClick={() => setShowDatePicker(false)}
                                                >
                                                    Применить
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="flex-1"
                                                    onClick={() => {
                                                        setStartDate("");
                                                        setEndDate("");
                                                        setShowDatePicker(false);
                                                    }}
                                                >
                                                    Сбросить
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Goals Selection (Collapsible) */}
            {showSettings && (
                <Card className="animate-in fade-in slide-in-from-top-2">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <CopyCheck className="h-4 w-4" />
                                Настройки целей Метрики
                            </CardTitle>
                            {selectedGoalIds.length > 0 && (
                                <span className="text-sm text-muted-foreground">
                                    Выбрано: {selectedGoalIds.length} из {availableGoals.length}
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingGoals ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : availableGoals.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">
                                Не удалось загрузить цели из Метрики. Проверьте токен.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {availableGoals.map((goal) => {
                                        const isSelected = selectedGoalIds.includes(goal.id);
                                        return (
                                            <div
                                                key={goal.id}
                                                className={`flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer border transition-colors ${isSelected
                                                    ? "bg-primary/5 border-primary/20"
                                                    : "hover:bg-muted border-transparent hover:border-border"
                                                    }`}
                                                onClick={() => toggleGoal(goal.id)}
                                            >
                                                <div className={`h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? "bg-primary border-primary" : "border-input"}`}>
                                                    {isSelected && <div className="h-2.5 w-3.5 bg-primary-foreground mask-check" style={{ clipPath: "polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)", backgroundColor: "white" }} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium leading-none truncate" title={goal.name}>{goal.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">ID: {goal.id}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t justify-end">
                                    <Button
                                        size="sm"
                                        onClick={saveGoalSettings}
                                        disabled={loadingGoals}
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        Сохранить настройки
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Actions & Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 my-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Показано {filteredLeads.length} из {leads.length} лидов
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCheckDuplicates} disabled={loading}>
                        <CopyCheck className="mr-2 h-4 w-4" />
                        Сверка по дублям
                    </Button>
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead
                                        className="w-[100px] sticky left-0 z-20 bg-card shadow-[1px_0_0_0_rgba(0,0,0,0.1)] cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort('date')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Дата <ArrowUpDown className="h-3 w-3" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[80px]">Время</TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort('campaign')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Кампания <ArrowUpDown className="h-3 w-3" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[160px]">Целевой</TableHead>
                                    <TableHead className="w-[180px]">Квалификация</TableHead>
                                    <TableHead className="w-[120px]">Сумма</TableHead>
                                    <TableHead>Комментарий</TableHead>
                                    <TableHead className="w-[100px] text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLeads.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={8}
                                            className="text-center py-8 text-muted-foreground"
                                        >
                                            Нет данных для отображения
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedLeads.map((lead) => (
                                        <TableRow key={lead.rowIndex} className="table-row-hover">
                                            <TableCell className="font-medium sticky left-0 z-10 bg-card shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                                                {formatDate(lead.date)}
                                            </TableCell>
                                            <TableCell>{formatTime(lead.time)}</TableCell>
                                            <TableCell>
                                                <CampaignBadge campaign={lead.campaign} />
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={String(lead["Целевой"] ?? "")}
                                                    onValueChange={(v) => handleInlineUpdate(lead.rowIndex, 'target', v)}
                                                >
                                                    <SelectTrigger className="h-auto py-1 w-full border-transparent bg-transparent hover:bg-muted focus:ring-0 p-0 text-left">
                                                        <SelectValue>
                                                            {lead["Целевой"] ? (
                                                                <span
                                                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-normal break-words leading-tight"
                                                                    style={getTargetStatusColor(lead["Целевой"])}
                                                                >
                                                                    {lead["Целевой"]}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {TARGET_OPTIONS.map((opt) => (
                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                {opt.value === '-' ? (
                                                                    <span className="text-muted-foreground">-</span>
                                                                ) : (
                                                                    <span
                                                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                                                        style={getTargetStatusColor(opt.value)}
                                                                    >
                                                                        {opt.label}
                                                                    </span>
                                                                )}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={lead.qualification || "-"}
                                                    onValueChange={(v) => handleInlineUpdate(lead.rowIndex, 'qualification', v)}
                                                >
                                                    <SelectTrigger className="h-8 w-full border-transparent bg-transparent hover:bg-muted focus:ring-0">
                                                        <SelectValue>
                                                            {lead.qualification ? (
                                                                <span
                                                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                                                                    style={getQualificationColor(lead.qualification)}
                                                                >
                                                                    {lead.qualification}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {STATUS_OPTIONS.map((status) => (
                                                            <SelectItem key={status.value} value={status.value}>
                                                                {status.value === '-' ? (
                                                                    <span className="text-muted-foreground">-</span>
                                                                ) : (
                                                                    <span
                                                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                                                        style={getQualificationColor(status.value)}
                                                                    >
                                                                        {status.label}
                                                                    </span>
                                                                )}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            {/* SALES EDIT */}
                                            <TableCell>
                                                {editingRow === lead.rowIndex ? (
                                                    <Input
                                                        value={editValues.sales}
                                                        onChange={(e) =>
                                                            setEditValues((prev) => ({
                                                                ...prev,
                                                                sales: e.target.value,
                                                            }))
                                                        }
                                                        className="h-8"
                                                        placeholder="0"
                                                    />
                                                ) : (
                                                    <span>{String(lead.sales || "—")}</span>
                                                )}
                                            </TableCell>
                                            {/* COMMENT EDIT */}
                                            <TableCell>
                                                {editingRow === lead.rowIndex ? (
                                                    <Input
                                                        value={editValues.comment}
                                                        onChange={(e) =>
                                                            setEditValues((prev) => ({
                                                                ...prev,
                                                                comment: e.target.value,
                                                            }))
                                                        }
                                                        className="h-8"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-muted-foreground line-clamp-2">
                                                        {lead.comment || "—"}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {editingRow === lead.rowIndex ? (
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={handleCancelEdit}
                                                            disabled={saving}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSave(lead.rowIndex)}
                                                            disabled={saving}
                                                        >
                                                            {saving ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Save className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleEdit(lead)}
                                                    >
                                                        Изменить
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
