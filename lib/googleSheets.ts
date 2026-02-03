import { google, sheets_v4 } from "googleapis";
import { COLUMN_NAMES, CURRENT_MONTH_SHEET } from "./constants";
export { CURRENT_MONTH_SHEET };

// Инициализация Google Sheets API
function getGoogleSheetsClient(): sheets_v4.Sheets {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = "1V9s3qmv1cEf-2BmCfGdkKHJfrCppXHHQxIQNz7vSl3c" || process.env.GOOGLE_SHEET_ID;

// Типы для данных
export interface SheetRow {
    [key: string]: string | number;
}

// Simple in-memory cache
const CACHE_TTL = 30 * 1000; // 30 seconds
const cache: Record<string, { timestamp: number; data: SheetRow[] }> = {};

/**
 * Получить все данные из указанного листа
 */
export async function getSheetData(sheetName: string = CURRENT_MONTH_SHEET): Promise<SheetRow[]> {
    const now = Date.now();

    // Return cached data if valid
    if (cache[sheetName] && (now - cache[sheetName].timestamp < CACHE_TTL)) {
        return cache[sheetName].data;
    }

    const sheets = getGoogleSheetsClient();

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!A:Z`,
            valueRenderOption: "FORMATTED_VALUE",
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return [];
        }

        // Первая строка - заголовки
        const headers = rows[0] as string[];

        // Преобразуем остальные строки в объекты
        const data: SheetRow[] = rows.slice(1).map((row, index) => {
            const obj: SheetRow = { rowIndex: index + 2 }; // +2 потому что 1-indexed и пропускаем заголовок
            headers.forEach((header, i) => {
                obj[header] = row[i] || "";
            });
            return obj;
        });

        // Update cache
        cache[sheetName] = { timestamp: now, data };

        return data;
    } catch (error) {
        console.error("Ошибка при получении данных из Google Sheets:", error);
        throw error;
    }
}

/**
 * Получить список всех листов в таблице
 */
export async function getSheetNames(): Promise<string[]> {
    const sheets = getGoogleSheetsClient();

    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        return response.data.sheets?.map((sheet) => sheet.properties?.title || "") || [];
    } catch (error) {
        console.error("Ошибка при получении списка листов:", error);
        throw error;
    }
}

/**
 * Обновить конкретные ячейки в строке
 */
export async function updateRow(
    sheetName: string,
    rowIndex: number,
    updates: Record<string, string>
): Promise<void> {
    const sheets = getGoogleSheetsClient();

    try {
        // Сначала получим заголовки чтобы найти нужные колонки
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!1:1`,
        });

        const headers = headerResponse.data.values?.[0] as string[];
        if (!headers) {
            throw new Error("Не удалось получить заголовки таблицы");
        }

        // Формируем массив обновлений
        const updateRequests: sheets_v4.Schema$ValueRange[] = [];

        for (const [field, value] of Object.entries(updates)) {
            const colIndex = headers.indexOf(field);
            if (colIndex === -1) {
                console.warn(`Колонка "${field}" не найдена`);
                continue;
            }

            // Преобразуем индекс колонки в букву (A, B, C, ...)
            const colLetter = String.fromCharCode(65 + colIndex);
            const range = `'${sheetName}'!${colLetter}${rowIndex}`;

            updateRequests.push({
                range,
                values: [[value]],
            });
        }

        if (updateRequests.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: "USER_ENTERED",
                    data: updateRequests,
                },
            });
            // Invalidate cache
            delete cache[sheetName];
        }
    } catch (error) {
        console.error("Ошибка при обновлении строки в Google Sheets:", error);
        throw error;
    }
}

/**
 * Удалить строку из листа
 */
export async function deleteRow(
    sheetName: string,
    rowIndex: number
): Promise<void> {
    const sheets = getGoogleSheetsClient();

    try {
        // Get sheet ID first
        const sheetInfo = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const sheet = sheetInfo.data.sheets?.find(
            s => s.properties?.title === sheetName
        );

        if (!sheet?.properties?.sheetId) {
            throw new Error(`Sheet "${sheetName}" not found`);
        }

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheet.properties.sheetId,
                            dimension: "ROWS",
                            startIndex: rowIndex - 1, // 0-indexed
                            endIndex: rowIndex // exclusive
                        }
                    }
                }]
            }
        });

        // Invalidate cache
        delete cache[sheetName];
    } catch (error) {
        console.error("Ошибка при удалении строки из Google Sheets:", error);
        throw error;
    }
}

/**
 * Обновить несколько строк одним запросом (Batch Update)
 */
export async function updateRowsBatch(
    sheetName: string,
    updates: Array<{ rowIndex: number; data: Record<string, string> }>
): Promise<void> {
    const sheets = getGoogleSheetsClient();

    try {
        // Сначала получим заголовки чтобы найти нужные колонки
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!1:1`,
        });

        const headers = headerResponse.data.values?.[0] as string[];
        if (!headers) {
            throw new Error("Не удалось получить заголовки таблицы");
        }

        // Формируем массив обновлений
        const updateRequests: sheets_v4.Schema$ValueRange[] = [];

        for (const update of updates) {
            for (const [field, value] of Object.entries(update.data)) {
                const colIndex = headers.indexOf(field);
                if (colIndex === -1) {
                    console.warn(`Колонка "${field}" не найдена`);
                    continue;
                }

                // Преобразуем индекс колонки в букву (A, B, C, ...)
                // Note: This simple logic works for A-Z. For AA+, need better logic if lots of cols. 
                // However, standard sheets usually fit in A-Z for leads. 
                // But let's support up to ZZ for safety if easy, or stick to simple charCode for now as per existing updateRow.
                // Existing updateRow uses String.fromCharCode(65 + colIndex). This breaks at index 26.
                // Should we improve it? The user has "Сумма продажи" which might be far right.
                // Let's copy existing logic for consistency, but maybe improve if columns > 26.
                // Given "Сумма продажи" is usually H/I/J, it is fine.

                let colLetter = "";
                if (colIndex < 26) {
                    colLetter = String.fromCharCode(65 + colIndex);
                } else {
                    const first = Math.floor(colIndex / 26) - 1;
                    const second = colIndex % 26;
                    colLetter = String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
                }

                const range = `'${sheetName}'!${colLetter}${update.rowIndex}`;

                updateRequests.push({
                    range,
                    values: [[value]],
                });
            }
        }

        if (updateRequests.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: "USER_ENTERED",
                    data: updateRequests,
                },
            });
            // Invalidate cache
            delete cache[sheetName];
        }
    } catch (error) {
        console.error("Ошибка при пакетном обновлении строк в Google Sheets:", error);
        throw error;
    }
}

/**
 * Добавить новые строки в конец листа
 */
export async function appendRows(
    sheetName: string,
    rows: SheetRow[]
): Promise<number> {
    const sheets = getGoogleSheetsClient();

    try {
        // Получим заголовки
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!1:1`,
        });

        const headers = headerResponse.data.values?.[0] as string[];
        if (!headers) {
            throw new Error("Не удалось получить заголовки таблицы");
        }

        // Преобразуем объекты в массивы значений согласно порядку заголовков
        const values = rows.map((row) => {
            return headers.map((header) => row[header] || "");
        });

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!A:A`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values,
            },
        });

        // Invalidate cache
        delete cache[sheetName];

        return response.data.updates?.updatedRows || 0;
    } catch (error) {
        console.error("Ошибка при добавлении строк в Google Sheets:", error);
        throw error;
    }
}

/**
 * Получить уникальные значения кампаний
 */
export async function getUniqueCampaigns(sheetName: string = CURRENT_MONTH_SHEET): Promise<string[]> {
    const data = await getSheetData(sheetName);
    const campaigns = new Set<string>();

    data.forEach((row) => {
        const campaign = row[COLUMN_NAMES.CAMPAIGN] as string;
        if (campaign) {
            campaigns.add(campaign);
        }
    });

    return Array.from(campaigns).sort();
}

/**
 * Получить данные о бюджетах (если доступны)
 */
export async function getBudgetData(): Promise<Record<string, number> | null> {
    const sheets = getGoogleSheetsClient();

    try {
        // Проверим существование листа "Яндекс-Директ" или "Эффективность"
        const sheetNames = await getSheetNames();
        const budgetSheetName = sheetNames.find(
            (name) => name.includes("Яндекс") || name.includes("Эффективность") || name.includes("Бюджет")
        );

        if (!budgetSheetName) {
            return null;
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${budgetSheetName}'!A:Z`,
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            return null;
        }

        const budgets: Record<string, number> = {};
        const headers = rows[0];

        // Ищем колонки с названием кампании и расходами
        rows.slice(1).forEach((row) => {
            // Предполагаем простую структуру: кампания, расход
            const campaign = row[0] as string;
            const spend = parseFloat(String(row[1]).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
            if (campaign && spend > 0) {
                budgets[campaign] = (budgets[campaign] || 0) + spend;
            }
        });

        return Object.keys(budgets).length > 0 ? budgets : null;
    } catch (error) {
        console.error("Ошибка при получении данных о бюджетах:", error);
        return null;
    }
}

/**
 * METRIKA INTEGRATION FUNCTIONS
 */

/**
 * Проверить какие visitId уже существуют в таблице (для дедупликации)
 * Column E is index 4
 */
export async function checkVisitIdsExist(sheetName: string, visitIds: string[]): Promise<Set<string>> {
    const sheets = getGoogleSheetsClient();
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!E:E`,
        });

        const rows = response.data.values;
        const existingIds = new Set<string>();

        if (rows && rows.length > 0) {
            rows.forEach(row => {
                if (row[0]) existingIds.add(String(row[0]));
            });
        }

        return new Set(visitIds.filter(id => existingIds.has(id)));
    } catch (error) {
        console.error("Ошибка проверки visitId:", error);
        return new Set();
    }
}

export interface CampaignRule {
    name: string;
    target_status?: string; // e.g. "Целевой", "Нецелевой"
    qualification_status?: string; // e.g. "Квалифицирован", "Брак"
    amount?: number;
}

export interface MetrikaSettings {
    auto_sync_enabled: boolean;
    sync_time: string;
    last_sync_date: string;
    last_sync_result: string;
    initial_sync_completed: boolean;
    goals: Record<string, boolean>;
    allowed_utm_sources: string[];
    campaign_rules: Record<string, CampaignRule>;
    direct_client_logins?: string[];
    // Array structure allows multiple directNames per UTM
    expenses_mapping?: Array<{ id: string; utmName: string; directName: string; displayName: string }>;
}

/**
 * Получить настройки Метрики из листа MetrikaSettings
 */
export async function getMetrikaSettings(): Promise<MetrikaSettings> {
    const data = await getSheetData("MetrikaSettings");
    const settings: MetrikaSettings = {
        auto_sync_enabled: true,
        sync_time: "09:00",
        last_sync_date: "",
        last_sync_result: "",
        initial_sync_completed: false,
        goals: {},
        allowed_utm_sources: [],
        campaign_rules: {},
        direct_client_logins: [],
        expenses_mapping: []
    };

    data.forEach(row => {
        const key = String(row["setting_key"] || "");
        const value = String(row["setting_value"] || "");

        if (key === "auto_sync_enabled") settings.auto_sync_enabled = value === "true";
        if (key === "sync_time") settings.sync_time = value;
        if (key === "last_sync_date") settings.last_sync_date = value;
        if (key === "last_sync_result") settings.last_sync_result = value;
        if (key === "initial_sync_completed") settings.initial_sync_completed = value === "true";
        if (key === "allowed_utm_sources") {
            settings.allowed_utm_sources = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
        }
        if (key === "direct_client_logins") {
            settings.direct_client_logins = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
        }

        // Goal settings format: goal_123456
        if (key.startsWith("goal_")) {
            const goalId = key.replace("goal_", "");
            settings.goals[goalId] = value === "true";
        }

        // Campaign rules format: rule_campaign_12345 (Storage: JSON)
        if (key.startsWith("rule_campaign_")) {
            const campId = key.replace("rule_campaign_", "");
            try {
                settings.campaign_rules[campId] = JSON.parse(value);
            } catch (e) {
                console.warn(`Failed to parse rule for ${campId}`, e);
            }
        }
        // Fallback for legacy simple mapping mappings (map_campaign_12345)
        else if (key.startsWith("map_campaign_")) {
            const campId = key.replace("map_campaign_", "");
            if (!settings.campaign_rules[campId]) {
                settings.campaign_rules[campId] = { name: value };
            }
        }
        // New array-based expenses mapping format: expense_item_{id} -> JSON
        else if (key.startsWith("expense_item_")) {
            const id = key.replace("expense_item_", "");
            if (!settings.expenses_mapping) settings.expenses_mapping = [];
            try {
                const parsed = JSON.parse(value);
                settings.expenses_mapping.push({ id, ...parsed });
            } catch {
                console.warn(`Failed to parse expense item ${id}`);
            }
        }
        // Legacy format migration: expense_mapping_utmname -> JSON({directName, displayName})
        else if (key.startsWith("expense_mapping_")) {
            const utmName = key.replace("expense_mapping_", "");
            if (!settings.expenses_mapping) settings.expenses_mapping = [];
            try {
                const parsed = JSON.parse(value);
                // Migrate to array format with generated ID
                settings.expenses_mapping.push({
                    id: `legacy_${utmName}`,
                    utmName,
                    directName: parsed.directName || value,
                    displayName: parsed.displayName || parsed.directName || value
                });
            } catch {
                // Legacy string-only format
                settings.expenses_mapping.push({
                    id: `legacy_${utmName}`,
                    utmName,
                    directName: value,
                    displayName: value
                });
            }
        }
    });

    return settings;
}

/**
 * Сохранить настройки Метрики
 */
export async function updateMetrikaSettings(settings: Partial<MetrikaSettings>): Promise<void> {
    const keyRowMap = new Map<string, number>();
    const data = await getSheetData("MetrikaSettings");

    // Build map of existing keys to row numbers
    const sheets = getGoogleSheetsClient();
    const rangeRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'MetrikaSettings'!A:A",
    });

    const rows = rangeRes.data.values || [];
    rows.forEach((row, index) => {
        if (row[0]) keyRowMap.set(row[0], index + 1);
    });

    const updates: Record<string, string> = {};

    if (settings.auto_sync_enabled !== undefined) updates["auto_sync_enabled"] = String(settings.auto_sync_enabled);
    if (settings.sync_time !== undefined) updates["sync_time"] = settings.sync_time;
    if (settings.last_sync_date !== undefined) updates["last_sync_date"] = settings.last_sync_date;
    if (settings.last_sync_result !== undefined) updates["last_sync_result"] = settings.last_sync_result;
    if (settings.initial_sync_completed !== undefined) updates["initial_sync_completed"] = String(settings.initial_sync_completed);
    if (settings.allowed_utm_sources !== undefined) updates["allowed_utm_sources"] = settings.allowed_utm_sources.join(',');
    if (settings.direct_client_logins !== undefined) updates["direct_client_logins"] = settings.direct_client_logins.join(',');

    if (settings.goals) {
        Object.entries(settings.goals).forEach(([id, enabled]) => {
            updates[`goal_${id}`] = String(enabled);
        });
    }

    if (settings.campaign_rules) {
        Object.entries(settings.campaign_rules).forEach(([id, rule]) => {
            updates[`rule_campaign_${id}`] = JSON.stringify(rule);
            // We might want to clear old map_campaign_ keys if we are migrating, 
            // but for now we just write new ones. 
            // The get function prefers rules, so it's fine.
        });
    }

    if (settings.expenses_mapping) {
        settings.expenses_mapping.forEach((item) => {
            updates[`expense_item_${item.id}`] = JSON.stringify({
                utmName: item.utmName,
                directName: item.directName,
                displayName: item.displayName
            });
        });
    }

    // Process updates
    for (const [key, value] of Object.entries(updates)) {
        if (keyRowMap.has(key)) {
            // Update existing row
            await updateRow("MetrikaSettings", keyRowMap.get(key)!, { setting_value: value });
        } else {
            // Append new row
            await appendRows("MetrikaSettings", [{ setting_key: key, setting_value: value }]);
        }
    }

    // Delete expense entries ONLY if we are updating expenses_mapping
    if (settings.expenses_mapping) {
        const existingExpenseKeys = Array.from(keyRowMap.keys()).filter(
            k => k.startsWith("expense_item_") || k.startsWith("expense_mapping_")
        );

        const newExpenseKeys = new Set(
            settings.expenses_mapping.map(item => `expense_item_${item.id}`)
        );

        // Find rows to delete (in reverse order to avoid index shifting)
        const rowsToDelete: number[] = [];
        for (const existingKey of existingExpenseKeys) {
            if (!newExpenseKeys.has(existingKey)) {
                rowsToDelete.push(keyRowMap.get(existingKey)!);
            }
        }

        // Delete rows in reverse order (highest row first)
        rowsToDelete.sort((a, b) => b - a);
        for (const rowNum of rowsToDelete) {
            await deleteRow("MetrikaSettings", rowNum);
        }
    }
}

/**
 * Удалить строки за указанный период (включительно)
 * Использует read -> filter -> write метод.
 */
export async function deleteRowsByDateRange(
    sheetName: string,
    dateFrom: string, // YYYY-MM-DD
    dateTo: string    // YYYY-MM-DD
): Promise<number> {
    const sheetData = await getSheetData(sheetName);
    const headers = sheetData[0]; // Preserve headers

    if (!headers) return 0;

    const fromTime = new Date(dateFrom).getTime();
    const toTime = new Date(dateTo).getTime();

    // Set toTime to end of day to be inclusive if it's just a date
    // But usually input is YYYY-MM-DD. Let's compare dates as strings or timestamps.
    // Metrika dates are YYYY-MM-DD.

    const rowsToKeep: Record<string, any>[] = [headers];
    let deletedCount = 0;

    // Start from index 1 (skip headers)
    for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        const dateStr = row[COLUMN_NAMES.DATE] as string;

        if (!dateStr) {
            rowsToKeep.push(row);
            continue;
        }

        const rowDate = new Date(dateStr).getTime();

        // Check if in range
        if (rowDate >= fromTime && rowDate <= toTime) {
            deletedCount++;
        } else {
            rowsToKeep.push(row);
        }
    }

    if (deletedCount > 0) {
        // Clear the sheet first
        await clearSheetContent(sheetName);

        // Write back kept rows
        // We need to convert Record<string, any> back to array of arrays for update?
        // No, appendRows takes SheetRow[].
        // But clearSheetContent clears everything.
        // We probably need a way to overwrite the sheet efficiently.
        // Or just clear and append.

        // We can use the existing appendRows but that appends.
        // We need to write from A1.

        const sheets = getGoogleSheetsClient();
        const startRow = 1;

        // Convert rowsToKeep to values array
        // We need to ensure order matches headers.
        // Wait, getSheetData returns Record<string, any>.
        // We need to map it back to values based on headers.

        // Helper to map object to array based on headers
        // Assuming headers are keys.
        // Actually getSheetData uses COLUMN_NAMES values as keys?
        // Let's check getSheetData implementation.
        // It maps based on header row.

        const headerKeys = Object.keys(COLUMN_NAMES).map(k => COLUMN_NAMES[k as keyof typeof COLUMN_NAMES]);
        // Actually we should just read raw values for this operation to be safe and format-agnostic.
        // But getSheetData is what we have publicly.

        // Alternative: Read raw values directly here.
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
        });

        const allValues = response.data.values || [];
        if (allValues.length === 0) return 0;

        const headerRow = allValues[0];
        const dateColIndex = headerRow.findIndex(h => h === COLUMN_NAMES.DATE);

        if (dateColIndex === -1) {
            console.error("Date column not found during clean");
            return 0;
        }

        const filteredValues = [headerRow];
        let delCount = 0;

        for (let i = 1; i < allValues.length; i++) {
            const row = allValues[i];
            const dateVal = row[dateColIndex]; // string YYYY-MM-DD

            // Simple string comparison for YYYY-MM-DD works (ISO format)
            if (dateVal >= dateFrom && dateVal <= dateTo) {
                delCount++;
            } else {
                filteredValues.push(row);
            }
        }

        if (delCount > 0) {
            // Clear sheet
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:Z`,
            });

            // Write back
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A1`,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    values: filteredValues
                }
            });
        }
        return delCount;
    }

    return 0;
}


// Helper to create "MetrikaSettings" and monthly sheet if needed
export async function ensureMetrikaSheetExists(targetSheetName: string) {
    const sheetNames = await getSheetNames();
    const sheets = getGoogleSheetsClient();

    // 1. Ensure MetrikaSettings exists
    if (!sheetNames.includes("MetrikaSettings")) {
        await createSheet("MetrikaSettings", ["setting_key", "setting_value"]);
        // Initialize default settings
        await appendRows("MetrikaSettings", [
            { setting_key: "auto_sync_enabled", setting_value: "true" },
            { setting_key: "sync_time", setting_value: "09:00" },
            { setting_key: "initial_sync_completed", setting_value: "false" }
        ]);
    } else {
        // Check if headers exist, if not add them
        const headerRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'MetrikaSettings'!A1:B1`
        });
        if (!headerRes.data.values || headerRes.data.values.length === 0) {
            console.log("Empty MetrikaSettings sheet found, adding headers...");
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `'MetrikaSettings'!A1`,
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [["setting_key", "setting_value"]] }
            });
        }
    }

    // 2. Ensure target month sheet exists (e.g. "Лиды")
    const leadHeaders = [
        "Дата", "Время", "Кампания", "Цель", "metrika_visit_id",
        "Целевой", "Квалификация", "Сумма продажи"
    ];

    if (!sheetNames.includes(targetSheetName)) {
        await createSheet(targetSheetName, leadHeaders);
    } else {
        // Check if headers exist, if not add them
        const headerRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${targetSheetName}'!1:1`
        });
        if (!headerRes.data.values || headerRes.data.values.length === 0) {
            console.log(`Empty ${targetSheetName} sheet found, adding headers...`);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${targetSheetName}'!A1`,
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [leadHeaders] }
            });
        }
    }
}

/**
 * Создать новый лист с заголовками
 */
export async function createSheet(title: string, headers: string[]): Promise<void> {
    const sheets = getGoogleSheetsClient();

    try {
        const existingSheets = await getSheetNames();
        if (existingSheets.includes(title)) {
            return;
        }

        // Create sheet
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: title,
                                gridProperties: {
                                    frozenRowCount: 1
                                }
                            }
                        }
                    }
                ]
            }
        });

        // Add headers
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${title}'!A1`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [headers]
            }
        });


    } catch (error) {
        console.error(`Error creating sheet ${title}:`, error);
        throw error;
    }
}

/**
 * Очистить содержимое листа (оставляя заголовки)
 */
export async function clearSheetContent(sheetName: string): Promise<void> {
    const sheets = getGoogleSheetsClient();

    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!A2:Z`,
        });
    } catch (error) {
        console.error(`Ошибка при очистке листа ${sheetName}:`, error);
        throw error;
    }
}

// Helper to parse date from sheet (handles YYYY-MM-DD and DD.MM.YYYY)
function parseSheetDate(dateStr: string): number | null {
    if (!dateStr) return null;
    const str = String(dateStr).trim();

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return new Date(str).getTime();
    }
    // DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}/.test(str)) {
        const [day, month, year] = str.split('.');
        return new Date(`${year}-${month}-${day}`).getTime();
    }
    // Fallback
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * БЕЗОПАСНОЕ удаление строк за указанный период (включительно)
 * Использует точечное удаление (DeleteDimension) без полной перезаписи таблицы
 */
export async function deleteRowsByDateRangeSafe(
    sheetName: string,
    dateFrom: string, // YYYY-MM-DD
    dateTo: string    // YYYY-MM-DD
): Promise<number> {
    const sheets = getGoogleSheetsClient();

    // 1. Получаем SheetId (нужен для удаления строк)
    const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetProps = sheetInfo.data.sheets?.find(s => s.properties?.title === sheetName)?.properties;

    if (!sheetProps?.sheetId) {
        console.error(`Sheet "${sheetName}" not found`);
        return 0;
    }
    const sheetId = sheetProps.sheetId;

    // 2. Считываем данные
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`,
        valueRenderOption: "FORMATTED_VALUE",
    });

    const allValues = response.data.values || [];
    if (allValues.length === 0) return 0;

    // 3. Ищем колонку с датой
    const headerRow = allValues[0];
    const dateColIndex = headerRow.findIndex(h => {
        const hStr = String(h).toLowerCase().trim();
        return ["дата", "date"].includes(hStr);
    });

    if (dateColIndex === -1) {
        console.error("Date column not found during clean");
        return 0;
    }

    // 4. Собираем индексы для удаления
    const rowsToDelete: number[] = [];

    // normalize helper (YYYY-MM-DD comparison)
    const toIso = (ts: number) => {
        const d = new Date(ts);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    for (let i = 1; i < allValues.length; i++) {
        const row = allValues[i];
        const dateStr = row[dateColIndex];
        const ts = parseSheetDate(dateStr);

        if (ts !== null) {
            const rowIso = toIso(ts);
            if (rowIso >= dateFrom && rowIso <= dateTo) {
                rowsToDelete.push(i);
            }
        }
    }

    if (rowsToDelete.length === 0) return 0;

    // 5. Группируем в диапазоны и удаляем (от большего индекса к меньшему)
    rowsToDelete.sort((a, b) => b - a);

    const requests: sheets_v4.Schema$Request[] = [];
    let rangeEnd = rowsToDelete[0];
    let rangeStart = rowsToDelete[0];

    for (let i = 1; i < rowsToDelete.length; i++) {
        if (rowsToDelete[i] === rangeStart - 1) {
            rangeStart = rowsToDelete[i];
        } else {
            requests.push({
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: "ROWS",
                        startIndex: rangeStart,
                        endIndex: rangeEnd + 1
                    }
                }
            });
            rangeEnd = rowsToDelete[i];
            rangeStart = rowsToDelete[i];
        }
    }
    requests.push({
        deleteDimension: {
            range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: rangeStart,
                endIndex: rangeEnd + 1
            }
        }
    });

    // 6. Выполняем удаление
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests }
    });

    // Invalidate cache
    delete cache[sheetName];

    return rowsToDelete.length;
}
