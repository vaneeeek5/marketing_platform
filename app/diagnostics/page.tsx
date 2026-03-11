"use client";

import { useState, useEffect } from "react";

interface DiagCheck {
    name: string;
    status: "ok" | "error" | "warning";
    message: string;
    detail?: string;
}

interface DiagResult {
    overall: "ok" | "error" | "warning";
    timestamp: string;
    durationMs: number;
    checks: DiagCheck[];
}

const statusConfig = {
    ok: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", icon: "✓", label: "OK" },
    error: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", icon: "✗", label: "ОШИБКА" },
    warning: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", icon: "⚠", label: "ВНИМАНИЕ" },
};

export default function DiagnosticsPage() {
    const [result, setResult] = useState<DiagResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastRun, setLastRun] = useState<string | null>(null);

    const runDiagnostics = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch("/api/diagnostics");
            const data = await res.json();
            setResult(data);
            setLastRun(new Date().toLocaleTimeString("ru-RU"));
        } catch (e) {
            setResult({
                overall: "error",
                timestamp: new Date().toISOString(),
                durationMs: 0,
                checks: [{
                    name: "Ошибка запроса",
                    status: "error",
                    message: "Не удалось получить ответ от сервера",
                    detail: String(e),
                }],
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runDiagnostics();
    }, []);

    const overallCfg = result ? statusConfig[result.overall] : null;

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white">🔍 Диагностика системы</h1>
                        <p className="text-gray-400 mt-1 text-sm">
                            Проверка подключений и переменных окружения
                        </p>
                    </div>
                    <button
                        onClick={runDiagnostics}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                    >
                        {loading ? (
                            <>
                                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Проверяю...
                            </>
                        ) : (
                            <>
                                <span>↺</span>
                                Запустить снова
                            </>
                        )}
                    </button>
                </div>

                {/* Overall status */}
                {result && overallCfg && (
                    <div className={`rounded-xl border p-5 mb-6 ${overallCfg.bg} ${overallCfg.border}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className={`text-3xl ${overallCfg.text}`}>{overallCfg.icon}</span>
                                <div>
                                    <div className={`text-lg font-semibold ${overallCfg.text}`}>
                                        {result.overall === "ok" && "Все системы работают нормально"}
                                        {result.overall === "warning" && "Есть предупреждения"}
                                        {result.overall === "error" && "Обнаружены критические ошибки"}
                                    </div>
                                    <div className="text-gray-400 text-sm mt-0.5">
                                        Проверка заняла {result.durationMs}ms · {lastRun && `В ${lastRun}`}
                                    </div>
                                </div>
                            </div>
                            <span className={`text-xs font-mono px-3 py-1 rounded-full border ${overallCfg.bg} ${overallCfg.border} ${overallCfg.text}`}>
                                {overallCfg.label}
                            </span>
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="space-y-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded bg-gray-700" />
                                    <div className="w-48 h-4 rounded bg-gray-700" />
                                    <div className="ml-auto w-24 h-4 rounded bg-gray-700" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Checks list */}
                {!loading && result && (
                    <div className="space-y-3">
                        {result.checks.map((check, i) => {
                            const cfg = statusConfig[check.status];
                            return (
                                <div
                                    key={i}
                                    className={`rounded-xl border p-4 transition-all ${cfg.bg} ${cfg.border}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <span className={`text-lg flex-shrink-0 mt-0.5 ${cfg.text}`}>
                                                {cfg.icon}
                                            </span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-white text-sm">
                                                        {check.name}
                                                    </span>
                                                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                                                        {cfg.label}
                                                    </span>
                                                </div>
                                                <p className={`text-sm mt-1 ${cfg.text}`}>{check.message}</p>
                                                {check.detail && (
                                                    <details className="mt-2">
                                                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 select-none">
                                                            Подробности
                                                        </summary>
                                                        <pre className="mt-2 text-xs text-gray-400 bg-black/30 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all font-mono max-h-48">
                                                            {check.detail}
                                                        </pre>
                                                    </details>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Tips */}
                {result && result.overall === "error" && (
                    <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                        <h3 className="text-blue-400 font-medium text-sm mb-2">💡 Частые причины ошибок</h3>
                        <ul className="space-y-1.5 text-gray-400 text-sm">
                            <li>• <span className="text-white">ERR_OSSL_UNSUPPORTED</span> — приватный ключ не читается. Проверьте формат ключа в Secret Manager</li>
                            <li>• <span className="text-white">403 / Permission denied</span> — сервисный аккаунт не добавлен в Google Таблицу как Редактор</li>
                            <li>• <span className="text-white">Пустой GOOGLE_PRIVATE_KEY</span> — секрет не смонтирован в Cloud Run (проверьте версию)</li>
                            <li>• <span className="text-white">invalid_grant</span> — ключ от другого проекта или аккаунта</li>
                        </ul>
                    </div>
                )}

                {/* Raw JSON */}
                {result && (
                    <div className="mt-6">
                        <details className="rounded-xl border border-gray-800">
                            <summary className="px-4 py-3 text-sm text-gray-400 cursor-pointer hover:text-gray-300 select-none">
                                Raw JSON ответа
                            </summary>
                            <pre className="px-4 pb-4 text-xs text-gray-500 font-mono overflow-auto whitespace-pre-wrap">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
}
