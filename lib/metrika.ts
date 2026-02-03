// lib/metrika.ts - Yandex Metrika Logs API client

const METRIKA_API_BASE = 'https://api-metrika.yandex.net/management/v1';

/**
 * Normalize campaign name for comparison:
 * - Lowercase
 * - Trim
 * - Replace dashes (em/en) with standard hyphen
 * - Collapse spaces
 */
function normalizeCampaignName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[\u2013\u2014]/g, "-") // Replace Em/En dash with hyphen
        .replace(/\s+/g, " ")
        .trim();
}

export interface MetrikaLead {
    date: string;
    time: string;
    campaign: string;
    goalName: string;
    visitId: string;
}

export interface MetrikaGoal {
    id: number;
    name: string;
    type: string;
}

/**
 * Получить лиды из Яндекс Метрики через Logs API
 * Workflow:
 * 1. POST - создать запрос на выгрузку логов
 * 2. Poll - ждать пока status=processed
 * 3. GET - скачать данные
 */
export async function fetchLeads(
    dateFrom: string,
    dateTo: string,
    goalIds: number[] = [],
    goalNamesMap: Record<number, string> = {},
    allowedSources: string[] = [],
    campaignMap: Record<string, string> = {}
): Promise<MetrikaLead[]> {
    const token = process.env.YANDEX_METRIKA_TOKEN;
    const counterId = process.env.YANDEX_COUNTER_ID;

    if (!token || !counterId) {
        throw new Error('Missing YANDEX_METRIKA_TOKEN or YANDEX_COUNTER_ID in environment');
    }

    try {
        // Step 1: Create log request
        // Using 'ym:s:goalsID' to get array of goal IDs reached in the visit
        const createResponse = await fetch(
            `${METRIKA_API_BASE}/counter/${counterId}/logrequests`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'date1': dateFrom,
                    'date2': dateTo,
                    'fields': 'ym:s:date,ym:s:dateTime,ym:s:clientID,ym:s:lastSignificantUTMCampaign,ym:s:lastSignificantTrafficSource,ym:s:goalsID,ym:s:lastSignificantUTMSource',
                    'source': 'visits',
                }),
            }
        );

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Ошибка создания запроса: ${createResponse.status} - ${errorText}`);
        }

        const createData = await createResponse.json();
        const requestId = createData.log_request?.request_id;

        if (!requestId) {
            throw new Error('Не получен request_id от Метрики');
        }

        console.log(`Создан запрос логов: ${requestId}`);

        // Step 2: Poll status every 5 seconds (reduced from 10 to speed up)
        let status = 'created';
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes max

        while (status !== 'processed' && attempts < maxAttempts) {
            await sleep(5000);

            const statusResponse = await fetch(
                `${METRIKA_API_BASE}/counter/${counterId}/logrequest/${requestId}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                }
            );

            if (!statusResponse.ok) {
                // If 404, might mean creation pending or wrong ID? 
                // But documentation says logrequest/{requestId}
                throw new Error(`Ошибка проверки статуса: ${statusResponse.statusText}`);
            }

            const statusData = await statusResponse.json();
            status = statusData.log_request?.status;
            attempts++;

            console.log(`Статус запроса: ${status} (попытка ${attempts})`);

            if (status === 'processing_failed' || status === 'canceled') {
                throw new Error(`Запрос завершился с ошибкой: ${status}`);
            }
        }

        if (status !== 'processed') {
            throw new Error('Превышено время ожидания обработки запроса');
        }

        // Step 3: Download data
        const downloadResponse = await fetch(
            `${METRIKA_API_BASE}/counter/${counterId}/logrequest/${requestId}/part/0/download`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            }
        );

        if (!downloadResponse.ok) {
            throw new Error(`Ошибка скачивания данных: ${downloadResponse.statusText}`);
        }

        const tsvData = await downloadResponse.text();
        return parseTsvData(tsvData, goalIds, goalNamesMap, allowedSources, campaignMap);

    } catch (error) {
        console.error('Ошибка Metrika API:', error);
        throw error;
    }
}

function parseTsvData(
    tsv: string,
    goalIds: number[] = [],
    goalNamesMap: Record<number, string> = {},
    allowedSources: string[] = [],
    campaignMap: Record<string, string> = {}
): MetrikaLead[] {
    const lines = tsv.trim().split('\n');
    const leads: MetrikaLead[] = [];

    // Create normalized map for case-insensitive/robust lookup
    const normalizedMap = new Map<string, string>();
    Object.entries(campaignMap).forEach(([key, value]) => {
        normalizedMap.set(normalizeCampaignName(key), value);
    });

    // Skip header row (first line)
    // Header row example: ym:s:date  ym:s:dateTime  ym:s:clientID  ym:s:lastSignificantUTMCampaign  ym:s:lastSignificantTrafficSource  ym:s:goalsID ym:s:lastSignificantUTMSource
    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split('\t');
        if (columns.length >= 7) {
            const [date, datetime, clientID, utmCampaign, lastSource, goalsStr, utmSource] = columns;

            // Filter by source if allowedSources is not empty
            // Check against UTMSource OR lastTrafficSource (logic: if we have utm filter, we probably mean UTM source)
            // But user said "po kakim UTM source", so we check utmSource first.
            const sourceToCheck = utmSource || lastSource || "";
            if (allowedSources.length > 0 && !allowedSources.includes(sourceToCheck)) {
                continue; // Skip this row
            }

            // Extract time from datetime (format: "2026-01-15 14:32:45")
            const timePart = datetime?.split(' ')[1] || '00:00:00';

            // Map campaign name if mapping exists
            let campaign = utmCampaign || lastSource || 'Прямые заходы';

            // Normalized Lookup Logic
            const normCampaign = normalizeCampaignName(campaign);
            const mappedExact = normalizedMap.get(normCampaign);

            if (mappedExact) {
                campaign = mappedExact;
            } else if (utmCampaign) {
                // Try looking up JUST the UTM campaign if strictly that is mapped
                const normUtm = normalizeCampaignName(utmCampaign);
                const mappedUtm = normalizedMap.get(normUtm);
                if (mappedUtm) {
                    campaign = mappedUtm;
                }
            }

            // Parse goalsID field which is like "[111,222]" or "[]"
            const visitedGoals = [...new Set(
                goalsStr.replace(/[\[\]]/g, '')
                    .split(',')
                    .map(s => parseInt(s.trim(), 10))
                    .filter(n => !isNaN(n))
            )];

            // Create lead for each reached goal that matches our filter
            visitedGoals.forEach(goalId => {
                if (goalIds.length === 0 || goalIds.includes(goalId)) {
                    leads.push({
                        date: date,
                        time: timePart,
                        campaign: campaign,
                        goalName: goalNamesMap[goalId] || `Цель ${goalId}`,
                        visitId: clientID,
                    });
                }
            });
        }
    }

    return leads;
}


/**
 * Получить список целей счетчика
 */
export async function getGoals(): Promise<MetrikaGoal[]> {
    const token = process.env.YANDEX_METRIKA_TOKEN;
    const counterId = process.env.YANDEX_COUNTER_ID;

    if (!token || !counterId) {
        throw new Error('Missing YANDEX_METRIKA_TOKEN or YANDEX_COUNTER_ID in environment');
    }

    try {
        const response = await fetch(
            `${METRIKA_API_BASE}/counter/${counterId}/goals`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Ошибка получения целей: ${response.statusText}`);
        }

        const data = await response.json();
        return (data.goals || []).map((g: any) => ({
            id: g.id,
            name: g.name,
            type: g.type,
        }));
    } catch (error) {
        console.error('Ошибка получения целей Metrika:', error);
        throw error;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface ExpenseData {
    campaign: string;
    spend: number;
    visits: number;
    cpc: number;
}

/**
 * Получить расходы и визиты по кампаниям через API Статистики
 * https://api-metrika.yandex.net/stat/v1/data
 */
export async function fetchExpenses(
    dateFrom: string,
    dateTo: string,
    campaignMap: Record<string, string> = {},
    directClientLogins: string[] = []
): Promise<{ expenses: ExpenseData[], total: { spend: number; visits: number }, hasDirectAccess: boolean }> {
    const token = process.env.YANDEX_METRIKA_TOKEN;
    const counterId = process.env.YANDEX_COUNTER_ID;

    if (!token || !counterId) {
        throw new Error('Missing Metrika config');
    }

    // Prepare Normalized Map
    const normalizedMap = new Map<string, string>();
    Object.entries(campaignMap).forEach(([key, value]) => {
        normalizedMap.set(normalizeCampaignName(key), value);
    });

    /**
     * Helper to get mapped name recursively (chaining)
     * e.g. UTM "mk-1" -> Direct "MK 1" -> Display "Marketing 1"
     */
    const getMappedName = (rawName: string): string => {
        if (!rawName) return "";
        const norm = normalizeCampaignName(rawName);
        const mapped = normalizedMap.get(norm);

        if (mapped) {
            // Check if the mapped value itself maps to something else
            // This handles the UTM -> Direct -> Display chain
            const normMapped = normalizeCampaignName(mapped);
            // Avoid infinite loops if mapped value is same as key
            if (normMapped !== norm) {
                const doubleMapped = normalizedMap.get(normMapped);
                if (doubleMapped) return doubleMapped;
            }
            return mapped;
        }
        return rawName;
    };

    // 1. Fetch Visits (Session Data)
    const visitsParams = new URLSearchParams({
        'ids': counterId,
        'metrics': 'ym:s:visits',
        'dimensions': 'ym:s:UTMCampaign',
        'date1': dateFrom,
        'date2': dateTo,
        'limit': '1000',
        'accuracy': 'full',
    });

    // 2. Fetch Direct Costs (Ad Data) - ONLY if logins provided
    const costsParams = new URLSearchParams({
        'ids': counterId,
        'metrics': 'ym:ad:RUBAdCost,ym:ad:USDAdCost,ym:ad:EURAdCost,ym:ad:BYNAdCost,ym:ad:KZTAdCost',
        'dimensions': 'ym:ad:directOrder',
        'date1': dateFrom,
        'date2': dateTo,
        'limit': '1000',
        'accuracy': 'full',
    });

    if (directClientLogins.length > 0) {
        costsParams.append('direct_client_logins', directClientLogins.join(','));
    }

    let visitsData: any[] = [];
    let costsData: any[] = [];

    try {
        // Parallel fetch if logins exist
        const promises = [
            fetch(`https://api-metrika.yandex.net/stat/v1/data?${visitsParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(async r => {
                if (!r.ok) throw new Error(`Visits Fetch Error ${r.status}`);
                return r.json();
            })
        ];

        if (directClientLogins.length > 0) {
            promises.push(
                fetch(`https://api-metrika.yandex.net/stat/v1/data?${costsParams}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(async r => {
                    if (!r.ok) {
                        // Log but don't fail everything if costs fail. 
                        // This prevents 500 error if Direct API is finicky.
                        console.warn(`Costs Fetch Error ${r.status}:`, await r.text());
                        return { data: [] };
                    }
                    return r.json();
                })
            );
        }

        const results = await Promise.all(promises);
        const [visitsResult, costsResult] = results;

        if (visitsResult && visitsResult.data) visitsData = visitsResult.data;
        if (directClientLogins.length > 0 && results[1] && results[1].data) {
            costsData = results[1].data;
        }

    } catch (e: any) {
        console.error("Metrika Fetch Error:", e);
        throw e;
    }

    // Merging Logic (Name-based matching with display name support)
    const expenseMap = new Map<string, ExpenseData>(); // Key: Display Name

    // 1. Process Costs (Direct Data is the "Source of Truth" for Spend)
    if (costsData) {
        costsData.forEach((row: any) => {
            const rawName = row.dimensions?.[0]?.name || "Direct Campaign";
            // Normalization applied here
            const displayName = getMappedName(rawName);
            const key = displayName.trim();

            // Sum Spend
            let spend = 0;
            if (row.metrics && Array.isArray(row.metrics)) {
                spend = row.metrics.reduce((acc: number, val: number) => acc + (val || 0), 0);
            }

            if (!expenseMap.has(key)) {
                expenseMap.set(key, {
                    campaign: displayName,
                    spend: spend,
                    visits: 0,
                    cpc: 0
                });
            } else {
                const existing = expenseMap.get(key)!;
                existing.spend += spend;
            }
        });
    }

    // 2. Process Visits (Merge by mapped name)
    if (visitsData) {
        visitsData.forEach((row: any) => {
            const utmName = row.dimensions?.[0]?.name || "Не определена";
            // Normalization applied here
            const displayName = getMappedName(utmName);
            const key = displayName.trim();
            const visits = row.metrics?.[0] || 0;

            if (expenseMap.has(key)) {
                // Merge into existing Cost entry
                const entry = expenseMap.get(key)!;
                entry.visits += visits;
            } else {
                // Create new Visits-only entry
                expenseMap.set(key, {
                    campaign: displayName,
                    spend: 0,
                    visits: visits,
                    cpc: 0
                });
            }
        });
    }

    // Calculate totals
    const expenses: ExpenseData[] = [];
    let totalSpend = 0;
    let totalVisits = 0;

    expenseMap.forEach((val) => {
        if (val.visits > 0 || val.spend > 0) {
            val.cpc = val.visits > 0 ? val.spend / val.visits : 0;
            expenses.push(val);
            totalSpend += val.spend;
            totalVisits += val.visits;
        }
    });

    return {
        expenses: expenses.sort((a, b) => b.spend - a.spend),
        total: {
            spend: totalSpend,
            visits: totalVisits
        },
        hasDirectAccess: directClientLogins.length > 0
    };
}
