"use client";

import { useEffect, useState, useCallback } from "react";
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
import { formatDate, formatTime } from "@/lib/utils";
import {
    Loader2,

    Filter,
    Save,
    X,
    Search,
    Users,
    Calendar,
} from "lucide-react";

const STATUS_OPTIONS = [
    { value: "квал", label: "Квал" },
    { value: "дубль", label: "Дубль" },
    { value: "обычный", label: "Обычный" },
    { value: "закрыто", label: "Закрыто" },
];

const TARGET_OPTIONS = [
    { value: "целевой", label: "Целевой" },
    { value: "СПАМ", label: "СПАМ" },
    { value: "не было в такое время лида", label: "Не было в такое время лида" },
    { value: "недозвон", label: "Недозвон" },
    { value: "дубль", label: "Дубль" },
];

export default function LeadsPage() {
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

    // Edit state
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<{
        qualification: string;
        comment: string;
        sales: string;
    }>({ qualification: "", comment: "", sales: "" });
    const [saving, setSaving] = useState(false);

    const fetchLeads = useCallback(async () => {
        // ... implementation same ...
        if (!currentSheet) return;

        setLoading(true);
        try {
            const response = await fetch(
                `/api/leads?sheet=${encodeURIComponent(currentSheet)}`
            );
            if (!response.ok) throw new Error("Ошибка загрузки данных");
            const result: LeadsResponse = await response.json();
            setLeads(result.leads);

            // Extract unique campaigns
            const uniqueCampaigns = Array.from(
                new Set(result.leads.map((l) => l.campaign).filter(Boolean))
            );
            setCampaigns(uniqueCampaigns);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Неизвестная ошибка");
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

        setFilteredLeads(filtered);
    }, [leads, campaignFilter, statusFilter, searchQuery]);

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
        const previousLeads = [...leads];
        setLeads((prev) =>
            prev.map((lead) =>
                lead.rowIndex === rowIndex
                    ? { ...lead, [field === 'target' ? 'Целевой' : 'qualification']: value }
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
                    value,
                }),
            });

            if (!response.ok) throw new Error("Ошибка обновления");
        } catch (err) {
            setLeads(previousLeads);
            alert("Ошибка при обновлении");
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
        } catch (err) {
            alert("Ошибка сохранения");
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
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Показано {filteredLeads.length} из {leads.length} лидов
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Дата</TableHead>
                                    <TableHead className="w-[80px]">Время</TableHead>
                                    <TableHead>Кампания</TableHead>
                                    <TableHead className="w-[140px]">Целевой</TableHead>
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
                                    filteredLeads.map((lead) => (
                                        <TableRow key={lead.rowIndex} className="table-row-hover">
                                            <TableCell className="font-medium">
                                                {formatDate(lead.date)}
                                            </TableCell>
                                            <TableCell>{formatTime(lead.time)}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                                    {lead.campaign || "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={String(lead["Целевой"] ?? "")}
                                                    onValueChange={(v) => handleInlineUpdate(lead.rowIndex, 'target', v)}
                                                >
                                                    <SelectTrigger className="h-8 w-full border-transparent bg-transparent hover:bg-muted focus:ring-0">
                                                        <SelectValue placeholder="-" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {TARGET_OPTIONS.map((opt) => (
                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                <StatusBadge status={opt.value} />
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={lead.qualification}
                                                    onValueChange={(v) => handleInlineUpdate(lead.rowIndex, 'qualification', v)}
                                                >
                                                    <SelectTrigger className="h-8 w-full border-transparent bg-transparent hover:bg-muted focus:ring-0">
                                                        <SelectValue placeholder="-" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {STATUS_OPTIONS.map((status) => (
                                                            <SelectItem key={status.value} value={status.value}>
                                                                <StatusBadge status={status.value} />
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
