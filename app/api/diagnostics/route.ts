import { NextResponse } from "next/server";
import { google } from "googleapis";

interface DiagCheck {
    name: string;
    status: "ok" | "error" | "warning";
    message: string;
    detail?: string;
}

export async function GET() {
    const checks: DiagCheck[] = [];
    const startTime = Date.now();

    // 1. Check env vars
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const metrikaToken = process.env.YANDEX_METRIKA_TOKEN;
    const counterId = process.env.YANDEX_COUNTER_ID;
    const nodeOptions = process.env.NODE_OPTIONS;
    const nodeVersion = process.version;

    checks.push({
        name: "Node.js версия",
        status: "ok",
        message: `Node.js ${nodeVersion}`,
        detail: `NODE_OPTIONS: ${nodeOptions || "(не задан)"}`,
    });

    checks.push({
        name: "GOOGLE_SHEET_ID",
        status: sheetId ? "ok" : "error",
        message: sheetId ? `✓ задан: ${sheetId}` : "✗ не задан",
    });

    checks.push({
        name: "GOOGLE_CLIENT_EMAIL",
        status: clientEmail ? "ok" : "error",
        message: clientEmail ? `✓ ${clientEmail}` : "✗ не задан",
    });

    // Check private key format
    if (!privateKey) {
        checks.push({
            name: "GOOGLE_PRIVATE_KEY",
            status: "error",
            message: "✗ не задан",
        });
    } else {
        const keyDecoded = privateKey.replace(/\\n/g, "\n");
        const hasBegin = keyDecoded.includes("-----BEGIN");
        const hasEnd = keyDecoded.includes("-----END");
        const keyLength = keyDecoded.length;
        checks.push({
            name: "GOOGLE_PRIVATE_KEY",
            status: hasBegin && hasEnd ? "ok" : "error",
            message: hasBegin && hasEnd
                ? `✓ корректный формат (${keyLength} символов)`
                : "✗ некорректный формат (нет BEGIN/END маркеров)",
            detail: `Первые 40 символов: ${keyDecoded.substring(0, 40)}...`,
        });
    }

    checks.push({
        name: "YANDEX_METRIKA_TOKEN",
        status: metrikaToken ? "ok" : "warning",
        message: metrikaToken ? `✓ задан (${metrikaToken.substring(0, 10)}...)` : "⚠ не задан",
    });

    checks.push({
        name: "YANDEX_COUNTER_ID",
        status: counterId ? "ok" : "warning",
        message: counterId ? `✓ ${counterId}` : "⚠ не задан",
    });

    // 2. Test Google Auth
    let authOk = false;
    let authError = "";
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey?.replace(/\\n/g, "\n"),
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        const token = await auth.getAccessToken();
        authOk = !!token;
        checks.push({
            name: "Google Auth (получение токена)",
            status: "ok",
            message: "✓ токен получен успешно",
            detail: `Token type: Bearer, получен за ${Date.now() - startTime}ms`,
        });
    } catch (e: any) {
        authError = e?.message || String(e);
        checks.push({
            name: "Google Auth (получение токена)",
            status: "error",
            message: `✗ ошибка аутентификации`,
            detail: authError,
        });
    }

    // 3. Test Google Sheets access
    if (authOk && sheetId) {
        try {
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: clientEmail,
                    private_key: privateKey?.replace(/\\n/g, "\n"),
                },
                scopes: ["https://www.googleapis.com/auth/spreadsheets"],
            });
            const sheets = google.sheets({ version: "v4", auth });
            const t = Date.now();
            const resp = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
            const sheetNames = resp.data.sheets?.map(s => s.properties?.title).join(", ");
            checks.push({
                name: "Google Sheets доступ",
                status: "ok",
                message: `✓ таблица доступна (${Date.now() - t}ms)`,
                detail: `Листы: ${sheetNames}`,
            });
        } catch (e: any) {
            checks.push({
                name: "Google Sheets доступ",
                status: "error",
                message: "✗ нет доступа к таблице",
                detail: e?.message || String(e),
            });
        }
    } else if (!authOk) {
        checks.push({
            name: "Google Sheets доступ",
            status: "error",
            message: "✗ пропущено — ошибка аутентификации",
        });
    }

    // 4. Test Yandex Metrika
    if (metrikaToken && counterId) {
        try {
            const t = Date.now();
            const res = await fetch(`https://api-metrika.yandex.net/management/v1/counter/${counterId}`, {
                headers: { Authorization: `OAuth ${metrikaToken}` },
            });
            const data = await res.json();
            if (res.ok) {
                checks.push({
                    name: "Яндекс.Метрика доступ",
                    status: "ok",
                    message: `✓ счётчик доступен (${Date.now() - t}ms)`,
                    detail: `Счётчик: ${data.counter?.name || counterId}`,
                });
            } else {
                checks.push({
                    name: "Яндекс.Метрика доступ",
                    status: "error",
                    message: `✗ ошибка ${res.status}`,
                    detail: JSON.stringify(data),
                });
            }
        } catch (e: any) {
            checks.push({
                name: "Яндекс.Метрика доступ",
                status: "error",
                message: "✗ не удалось подключиться",
                detail: e?.message || String(e),
            });
        }
    }

    const hasErrors = checks.some(c => c.status === "error");
    const hasWarnings = checks.some(c => c.status === "warning");

    return NextResponse.json({
        overall: hasErrors ? "error" : hasWarnings ? "warning" : "ok",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        checks,
    });
}
