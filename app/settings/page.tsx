"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Database, FileSpreadsheet, Save, CheckCircle, Calendar, Palette } from "lucide-react";
import { resetCampaignColors } from "@/lib/campaign-colors";

export default function SettingsPage() {
    const [sheetId, setSheetId] = useState("1HUpmF9aG3UD9blHHsIhWQ8NPnPTeW36USgkrRVSh5Tg");
    const [targetSheet] = useState("Лиды");
    const [saved, setSaved] = useState(false);

    const handleResetColors = () => {
        if (confirm("Вы уверены? Это сбросит все настройки цветов кампаний (вернутся цвета по умолчанию).")) {
            resetCampaignColors();
            window.location.reload();
        }
    };

    useEffect(() => {
        // No fetching needed
    }, []);

    const handleSave = () => {
        // localStorage.setItem("currentSheet", currentSheet); // Removed
        localStorage.setItem("sheetId", sheetId);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);

        // Trigger reload of data on other pages
        window.dispatchEvent(new Event("settingsUpdated"));
    };

    return (
        <div className="space-y-6 animate-fadeIn max-w-3xl">
            {/* Page header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Настройки</h1>
                <p className="text-muted-foreground mt-1">
                    Конфигурация подключения к Google Sheets
                </p>
            </div>

            {/* Connection Status */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Статус подключения
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-medium">Подключено к Google Sheets</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                        Используется сервисный аккаунт для авторизации
                    </p>
                </CardContent>
            </Card>

            {/* Sheet Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Настройки таблицы
                    </CardTitle>
                    <CardDescription>
                        Параметры подключения к Google Spreadsheet
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Sheet ID */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">ID таблицы Google Sheets</label>
                        <Input
                            value={sheetId}
                            onChange={(e) => setSheetId(e.target.value)}
                            placeholder="1HUpmF9aG3UD9blHHsIhWQ8NPnPTeW36USgkrRVSh5Tg"
                        />
                        <p className="text-xs text-muted-foreground">
                            Можно найти в URL таблицы: docs.google.com/spreadsheets/d/
                            <span className="font-mono text-primary">[ID]</span>/edit
                        </p>
                    </div>

                    {/* Save Button */}
                    <Button onClick={handleSave} className="gap-2">
                        {saved ? (
                            <>
                                <CheckCircle className="h-4 w-4" />
                                Сохранено
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Сохранить
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Sheet Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Целевой лист
                    </CardTitle>
                    <CardDescription>
                        Все данные сохраняются в этот лист
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-3 bg-muted rounded-md font-mono text-sm">
                        Лиды
                    </div>
                </CardContent>
            </Card>

            {/* Appearance Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        Внешний вид
                    </CardTitle>
                    <CardDescription>
                        Настройки отображения интерфейса и цветов
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Цвета кампаний</label>
                        <p className="text-xs text-muted-foreground mb-2">
                            Если вы изменяли цвета кампаний вручную, можно сбросить их к заводским настройкам.
                        </p>
                        <Button onClick={handleResetColors} variant="outline" className="w-full sm:w-auto self-start">
                            <Palette className="mr-2 h-4 w-4" />
                            Сбросить цвета кампаний
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Metrika Sync Section */}
            <MetrikaSyncSection />

            {/* Archive Import */}
            <ArchiveSection />
        </div >
    );
}

function MetrikaSyncSection() {
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [goals, setGoals] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>({
        auto_sync_enabled: true,
        sync_time: "09:00",
        goals: {}
    });
    const [lastResult, setLastResult] = useState("");

    // Manual sync state
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [showManual, setShowManual] = useState(false);
    const [targetSheet, setTargetSheet] = useState("");
    const [utmText, setUtmText] = useState("");
    const [directLoginsText, setDirectLoginsText] = useState("");

    useEffect(() => {
        loadData();
        // Set default dates (yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        setDateFrom(yStr);
        setDateTo(yStr);
    }, []);

    // Init utmText when settings load
    useEffect(() => {
        if (settings.allowed_utm_sources) {
            setUtmText(settings.allowed_utm_sources.join(', '));
        }
        if (settings.direct_client_logins) {
            setDirectLoginsText(settings.direct_client_logins.join(', '));
        }
    }, [settings.allowed_utm_sources, settings.direct_client_logins]);

    // Init targetSheet
    useEffect(() => {
        setTargetSheet("Лиды");
    }, []);

    const [saved, setSaved] = useState(false);
    const [cleaning, setCleaning] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [goalsRes, settingsRes] = await Promise.all([
                fetch("/api/metrika/goals"),
                // We use the sync endpoint or a dedicated one. 
                // Let's create a dedicated settings endpoints or just use what we have.
                // Actually, I haven't created GET /api/metrika/settings yet in this turn.
                // But I should. Let's assume it exists or I'll create it.
                // For now, I'll mock it or just rely on defaults if it fails.
                // Wait, I can't mock it if I want it to work.
                // I'll create the endpoint in the next step.
                fetch("/api/metrika/settings").catch(() => null)
            ]);

            const goalsData = await goalsRes.json();
            if (goalsData.goals) {
                setGoals(goalsData.goals);
            }

            if (settingsRes && settingsRes.ok) {
                const settingsData = await settingsRes.json();
                setSettings(settingsData);
            } else {
                // Initialize defaults if no settings found
                const initialGoals = { ...settings.goals };
                if (goalsData.goals) {
                    goalsData.goals.forEach((g: any) => {
                        if (initialGoals[g.id] === undefined) initialGoals[g.id] = true;
                    });
                }
                setSettings((prev: any) => ({ ...prev, goals: initialGoals }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setLoading(true);
        try {
            await fetch("/api/metrika/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings)
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const goalIds = goals
                .filter(g => settings.goals[g.id])
                .map(g => g.id);

            const res = await fetch("/api/sync/metrika", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dateFrom,
                    dateTo,
                    goalIds,
                    monthSheetName: targetSheet,
                    manual: true
                })
            });

            const data = await res.json();
            if (data.success) {
                setLastResult(`Добавлено: ${data.added}, Пропущено: ${data.skipped}`);
            } else {
                setLastResult(`Ошибка: ${data.error || "Неизвестная ошибка"}`);
            }
        } catch (e) {
            setLastResult("Ошибка сети");
        } finally {
            setSyncing(false);
        }
    };

    const handleClean = async () => {
        if (!confirm(`Вы уверены, что хотите очистить данные в листе "${targetSheet}"? Это удалит все строки кроме заголовков.`)) return;

        setCleaning(true);
        try {
            const res = await fetch("/api/sync/metrika", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "clean",
                    monthSheetName: targetSheet
                })
            });
            const data = await res.json();
            if (data.success) {
                setLastResult(`Лист ${targetSheet} очищен`);
            } else {
                setLastResult(`Ошибка очистки: ${data.error}`);
            }
        } catch (e) {
            setLastResult("Ошибка сети при очистке");
        } finally {
            setCleaning(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Синхронизация с Метрикой
                </CardTitle>
                <CardDescription>
                    Настройка выгрузки целей из Яндекс.Метрики
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                    <div className="space-y-0.5">
                        <label className="text-sm font-medium">Counter ID</label>
                        <div className="text-2xl font-bold font-mono">93215285</div>
                    </div>
                    <div className="space-y-0.5 text-right">
                        <label className="text-sm font-medium">Последняя синхронизация</label>
                        <div className="text-sm text-muted-foreground">{lastResult || "Нет данных"}</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Цели для выгрузки</h3>
                        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                            Обновить список
                        </Button>
                    </div>

                    <div className="border rounded-md max-h-60 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted sticky top-0">
                                <tr className="text-left">
                                    <th className="p-2 w-10"></th>
                                    <th className="p-2">Название цели</th>
                                    <th className="p-2 text-right">ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {goals.map(goal => (
                                    <tr key={goal.id} className="border-t hover:bg-muted/50">
                                        <td className="p-2">
                                            <input
                                                type="checkbox"
                                                checked={settings.goals[goal.id] || false}
                                                onChange={(e) => {
                                                    setSettings({
                                                        ...settings,
                                                        goals: { ...settings.goals, [goal.id]: e.target.checked }
                                                    });
                                                }}
                                                className="rounded border-gray-300"
                                            />
                                        </td>
                                        <td className="p-2 font-medium">{goal.name}</td>
                                        <td className="p-2 text-right font-mono text-xs text-muted-foreground">{goal.id}</td>
                                    </tr>
                                ))}
                                {goals.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={3} className="p-4 text-center text-muted-foreground">
                                            Цели не найдены
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                    <h3 className="font-semibold">Дополнительные настройки фильтрации</h3>

                    {/* Direct Client Logins */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Логины Яндекс.Директ (через запятую)</label>
                        <Input
                            className="bg-background"
                            placeholder="my-login, agency-login"
                            value={directLoginsText}
                            onChange={(e) => setDirectLoginsText(e.target.value)}
                            onBlur={() => {
                                const logins = directLoginsText.split(',').map(s => s.trim()).filter(Boolean);
                                setSettings({ ...settings, direct_client_logins: logins });
                            }}
                        />
                        <p className="text-xs text-muted-foreground">
                            Обязательно для получения расходов. Если счетчик привязан к нескольким логинам, перечислите их.
                        </p>
                    </div>

                    {/* UTM Source Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Фильтр по UTM Source (через запятую)</label>
                        <textarea
                            className="w-full min-h-[80px] p-2 text-sm border rounded-md bg-background"
                            placeholder="Например: yandex, google, vk. Оставьте пустым, чтобы выгружать всё."
                            value={utmText}
                            onChange={(e) => setUtmText(e.target.value)}
                            onBlur={() => {
                                const sources = utmText.split(',').map(s => s.trim()).filter(Boolean);
                                setSettings({ ...settings, allowed_utm_sources: sources });
                            }}
                        />
                        <p className="text-xs text-muted-foreground">
                            Если указано, будут выгружены только визиты с указанными источниками.
                        </p>
                    </div>

                    {/* Campaign Mapping & Rules */}
                    <div className="space-y-4">
                        <label className="text-sm font-medium">Правила для кампаний (Маппинг, Целевой, Сумма)</label>
                        <div className="border rounded-md p-4 space-y-4 bg-muted/10">
                            {Object.entries(settings.campaign_rules || {}).map(([id, rule]) => (
                                <div key={id} className="flex flex-col gap-2 p-3 bg-background rounded border shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <div className="bg-muted px-2 py-1 rounded text-xs font-mono" title={id}>{id}</div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive"
                                            onClick={() => {
                                                const newRules = { ...settings.campaign_rules };
                                                delete newRules[id];
                                                setSettings({ ...settings, campaign_rules: newRules });
                                            }}
                                        >
                                            <div className="h-4 w-4">×</div>
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-muted-foreground font-bold">Название</label>
                                            <Input
                                                value={(rule as any).name}
                                                onChange={(e) => {
                                                    const newRules = {
                                                        ...settings.campaign_rules,
                                                        [id]: { ...(rule as any), name: e.target.value }
                                                    };
                                                    setSettings({ ...settings, campaign_rules: newRules });
                                                }}
                                                className="h-8 text-sm"
                                                placeholder="Название кампании"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-muted-foreground font-bold">Сумма продажи</label>
                                            <Input
                                                type="number"
                                                value={(rule as any).amount || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                                    const newRules = {
                                                        ...settings.campaign_rules,
                                                        [id]: { ...(rule as any), amount: val }
                                                    };
                                                    setSettings({ ...settings, campaign_rules: newRules });
                                                }}
                                                className="h-8 text-sm"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-muted-foreground font-bold">Статус "Целевой"</label>
                                            <Input
                                                value={(rule as any).target_status || ''}
                                                onChange={(e) => {
                                                    const newRules = {
                                                        ...settings.campaign_rules,
                                                        [id]: { ...(rule as any), target_status: e.target.value }
                                                    };
                                                    setSettings({ ...settings, campaign_rules: newRules });
                                                }}
                                                className="h-8 text-sm"
                                                placeholder="Например: Целевой / Нецелевой"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-muted-foreground font-bold">Статус "Квалификация"</label>
                                            <Input
                                                value={(rule as any).qualification_status || ''}
                                                onChange={(e) => {
                                                    const newRules = {
                                                        ...settings.campaign_rules,
                                                        [id]: { ...(rule as any), qualification_status: e.target.value }
                                                    };
                                                    setSettings({ ...settings, campaign_rules: newRules });
                                                }}
                                                className="h-8 text-sm"
                                                placeholder="Например: Квал / Брак"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="bg-muted p-3 rounded space-y-3">
                                <label className="text-xs font-semibold">Добавить новое правило</label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="ID кампании (напр. 90018159)"
                                        className="h-8 text-xs font-mono"
                                        id="new-camp-id"
                                    />
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            const idInput = document.getElementById('new-camp-id') as HTMLInputElement;
                                            if (idInput.value) {
                                                setSettings({
                                                    ...settings,
                                                    campaign_rules: {
                                                        ...(settings.campaign_rules || {}),
                                                        [idInput.value]: { name: `Campaign ${idInput.value}` }
                                                    }
                                                });
                                                idInput.value = '';
                                            }
                                        }}
                                    >
                                        Добавить
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={saveSettings} disabled={loading}>
                            {saved ? (
                                <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Сохранено
                                </>
                            ) : (
                                "Сохранить настройки"
                            )}
                        </Button>
                    </div>
                </div>

                <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Ручная синхронизация</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowManual(!showManual)}
                        >
                            {showManual ? "Скрыть" : "Раскрыть"}
                        </Button>
                    </div>

                    {showManual && (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-muted-foreground">Целевой лист</label>
                                <Select value={"Лиды"} disabled>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Лиды" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Лиды">Лиды</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase font-bold text-muted-foreground">От</label>
                                    <Input
                                        type="date"
                                        value={dateFrom}
                                        onChange={e => setDateFrom(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase font-bold text-muted-foreground">До</label>
                                    <Input
                                        type="date"
                                        value={dateTo}
                                        onChange={e => setDateTo(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded text-xs text-amber-700 dark:text-amber-400">
                                Внимание: дубликаты (по visit_id) будут пропущены автоматически.
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={handleSync} disabled={syncing || cleaning} className="flex-1">
                                    {syncing ? (
                                        <>
                                            <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Синхронизация...
                                        </>
                                    ) : (
                                        "Выгрузить за период"
                                    )}
                                </Button>
                                <Button onClick={handleClean} disabled={cleaning || syncing} variant="destructive">
                                    {cleaning ? "Очистка..." : "Очистить период"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function ArchiveSection() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState("");

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/leads/merge-archive", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setResult(`Успешно обновлено: ${data.updated} строк`);
            } else {
                setResult(`Ошибка: ${data.error}`);
            }
        } catch (e) {
            setResult("Ошибка загрузки");
        } finally {
            setUploading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    Импорт архива
                </CardTitle>
                <CardDescription>
                    Загрузка Excel файла для обновления статусов старых лидов (сверка по Дата+Время)
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                </div>
                <div className="flex items-center gap-4">
                    <Button onClick={handleUpload} disabled={!file || uploading}>
                        {uploading ? "Загрузка..." : "Загрузить и обновить"}
                    </Button>
                    {result && <span className="text-sm text-muted-foreground">{result}</span>}
                </div>
            </CardContent>
        </Card>
    );
}
