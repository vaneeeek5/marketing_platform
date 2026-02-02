"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Database, Download, Calendar, Search, Filter } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MetrikaLead } from "@/lib/metrika";

export default function MetrikaLeadsPage() {
    // We don't have a direct API to fetch leads from sheet yet for display?
    // The requirement says: "Table showing data from 'Январь 2026 NEW'".
    // We need an endpoint to fetch leads.
    // I missed creating GET /api/metrika-leads endpoint in the plan?
    // Requirement 11 says: "Create new page /metrika-leads: Table showing data...".
    // It doesn't explicitly say "Create API", but we need one to fetch data from the sheet.
    // I can reuse getSheetData logic in a new API route or server component.
    // Since this project uses "use client" mostly, I'll create an API route.

    // STARTING WITH API ROUTE CREATION for LEADS (inline decision)

    const [leads, setLeads] = useState<any[]>([]); // Using any for sheet row
    const [loading, setLoading] = useState(true);
    const [filterGoal, setFilterGoal] = useState("all");
    const [search, setSearch] = useState("");
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            // We need an endpoint. I'll create /api/metrika/leads
            const res = await fetch("/api/metrika/leads");
            const data = await res.json();
            if (data.leads) {
                setLeads(data.leads);
                setTotal(data.leads.length);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredLeads = leads.filter(lead => {
        const matchesGoal = filterGoal === "all" || lead["Цель"] === filterGoal;
        const matchesSearch = search === "" ||
            (lead["Кампания"] && lead["Кампания"].toLowerCase().includes(search.toLowerCase())) ||
            (lead["Цель"] && lead["Цель"].toLowerCase().includes(search.toLowerCase()));
        return matchesGoal && matchesSearch;
    });

    const uniqueGoals = Array.from(new Set(leads.map(l => l["Цель"]))).filter(Boolean);

    const exportToExcel = () => {
        // Implement simple CSV export
        const headers = ["Дата", "Время", "Кампания", "Цель"];
        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + filteredLeads.map(row => {
                return headers.map(header => `"${row[header] || ""}"`).join(",");
            }).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "metrika_leads.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-fadeIn max-w-7xl mx-auto p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Лиды из Метрики</h1>
                    <p className="text-muted-foreground mt-1">
                        Просмотр всех лидов, загруженных из Яндекс.Метрики
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={exportToExcel} className="gap-2">
                        <Download className="h-4 w-4" />
                        Экспорт в Excel
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <CardTitle className="text-lg">
                            Всего лидов: {filteredLeads.length}
                        </CardTitle>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Поиск по кампании или цели..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <Select value={filterGoal} onValueChange={setFilterGoal}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Фильтр по цели" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все цели</SelectItem>
                                    {uniqueGoals.map((g: any) => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted text-muted-foreground font-medium">
                                <tr>
                                    <th className="p-3 w-32">Дата</th>
                                    <th className="p-3 w-24">Время</th>
                                    <th className="p-3">Кампания</th>
                                    <th className="p-3">Цель</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                Загрузка данных...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                            Лиды не найдены
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLeads.map((lead, i) => (
                                        <tr key={i} className="border-t hover:bg-muted/50 transition-colors">
                                            <td className="p-3 font-medium text-muted-foreground">{lead["Дата"]}</td>
                                            <td className="p-3 text-muted-foreground">{lead["Время"]}</td>
                                            <td className="p-3 font-medium">{lead["Кампания"]}</td>
                                            <td className="p-3">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                    {lead["Цель"]}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
