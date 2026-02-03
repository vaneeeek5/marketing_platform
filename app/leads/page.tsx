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
import { StatusBadge } from "@/components/status-badge";
import { Lead, LeadsResponse } from "@/types";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

const RESET_OPTION = { value: "-", label: "-" };

const STATUS_OPTIONS = [
    RESET_OPTION,
    { value: "квал", label: "Квал" },
    { value: "дубль", label: "Дубль" },
    { value: "обычный", label: "Обычный" },
    { value: "закрыто", label: "Закрыто" },
];

const TARGET_OPTIONS = [
    RESET_OPTION,
    { value: "Целевой", label: "Целевой" },
    { value: "СПАМ", label: "СПАМ" },
    { value: "Не было в такое время лида", label: "Не было в такое время лида" },
    { value: "Недозвон", label: "Недозвон" },
    { value: "Дубль", label: "Дубль" },
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
    console.log("Leads page mounting...");
    // ... state ...
    const [leads, setLeads] = useState<Lead[]>([]);
    const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [campaigns, setCampaigns] = useState<string[]>([]);
    const [currentSheet, setCurrentSheet] = useState(CURRENT_MONTH_SHEET);

    // Filters
    const [campaignFilter, setCampaignFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

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
            // For dates, we might need parsing if format is DD.MM.YYYY
            // Assuming string comparison works for simplified checking or ISO dates
            const aVal = sortConfig.key === 'date' ? a.date : (a.campaign || '');
            const bVal = sortConfig.key === 'date' ? b.date : (b.campaign || '');

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredLeads, sortConfig]);

    const handleSyncLatest = async () => {
        const toastId = toast.loading("Обновление данных...");
        try {
            const response = await fetch("/api/metrika/sync-latest", {
                method: "POST",
            });
            const result = await response.json();

            if (result.success) {
                toast.dismiss(toastId);
                successNotification(`Добавлено ${result.added} новых лидов`);
                fetchLeads();
            } else {
                toast.dismiss(toastId);
                toast.error("Ошибка обновления: " + result.error);
            }
        } catch (err) {
            toast.dismiss(toastId);
            toast.error("Ошибка при выполнении запроса");
        }
    };

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

        console.log("Leads page: Starting fetch...", { sheet: currentSheet });
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
                const errorText = await response.text();
                console.error("Leads fetch failed:", response.status, errorText);
                throw new Error(`Ошибка загрузки данных: ${response.status}`);
            }

            const result: LeadsResponse = await response.json();
            console.log("Leads fetched successfully:", result.leads.length);
            setLeads(result.leads);

            // Extract unique campaigns
            const uniqueCampaigns = Array.from(
                new Set(result.leads.map((l) => l.campaign).filter(Boolean))
            );
            setCampaigns(uniqueCampaigns);
            setError(null);
        } catch (err: any) {
            console.error("Leads fetch error:", err);
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

    // ... rest of hooks ...
    useEffect(() => {
        fetchLeads();
    }, [currentSheet, fetchLeads]);

    // Apply filters
    useEffect(() => {
        let filtered = [...leads];

        if (campaignFilter !== "all") {
            filtered = filtered.filter((l) => l.campaign === campaignFilter);
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter((l) =>
                l.qualification?.toLowerCase().includes(statusFilter.toLowerCase())
            );
        }

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
                // Reset hours for comparison to be safe with timezones if needed, 
                // but since we cover 00:00 to 23:59 of selected days, simple comparison works if standard objects.
                return date >= start && date <= end;
            });
        }

        setFilteredLeads(filtered);
    }, [leads, campaignFilter, statusFilter, searchQuery, startDate, endDate]);

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

    // Generic inline update handler (optimistic)
    const handleInlineUpdate = async (rowIndex: number, field: string, value: string) => {
        // Handle reset
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
            // Update SALES
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

            // Update COMMENT
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

            // Update local state
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
                    <Button variant="outline" size="sm" onClick={fetchLeads}>
                        <Filter className="mr-2 h-4 w-4" />
                        Обновить
                    </Button>
                </div>
            </div>

            {/* Loading indicator */}
            {loading && (
                <div className="fixed top-20 right-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm flex items-center gap-2 shadow-lg z-50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка...
                </div>
            )}

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
                        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Кампания" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все кампании</SelectItem>
                                {campaigns.map((campaign) => (
                                    <SelectItem key={campaign} value={campaign}>
                                        {campaign}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Status filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Статус" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все статусы</SelectItem>
                                {STATUS_OPTIONS.map((status) => (
                                    <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

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
