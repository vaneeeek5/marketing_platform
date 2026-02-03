// lib/metrika.ts - Yandex Metrika Logs API client

const METRIKA_API_BASE = 'https://api-metrika.yandex.net/management/v1';

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
                    'fields': 'ym:s:date,ym:s:dateTime,ym:s:clientID,ym:s:UTMCampaign,ym:s:lastTrafficSource,ym:s:goalsID,ym:s:UTMSource',
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

    // Skip header row (first line)
    // Header row example: ym:s:date  ym:s:dateTime  ym:s:clientID  ym:s:UTMCampaign  ym:s:lastTrafficSource  ym:s:goalsID ym:s:UTMSource
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
            // Try to map exactly the utmCampaign value or the campaign ID if it's there
            // The user said: "{90018159} а мне нужно чтобы она называлась поиск"
            // So we check keys against the raw value.
            // Often utmCampaign might be an ID or a string.
            // We check exact match for mapping.
            if (campaignMap[campaign]) {
                campaign = campaignMap[campaign];
            } else if (utmCampaign && campaignMap[utmCampaign]) {
                campaign = campaignMap[utmCampaign];
            }


            // Parse goalsID field which is like "[111,222]" or "[]"
            const visitedGoals = goalsStr.replace(/[\[\]]/g, '')
                .split(',')
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n));

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
    dateTo: string
): Promise<{ expenses: ExpenseData[], total: { spend: number; visits: number } }> {
    const token = process.env.YANDEX_METRIKA_TOKEN;
    const counterId = process.env.YANDEX_COUNTER_ID;

    if (!token || !counterId) {
        throw new Error('Missing Metrika config');
    }

    try {
        const params = new URLSearchParams({
            'ids': counterId,
            'metrics': 'ym:s:sumAdCosts,ym:s:visits',
            'dimensions': 'ym:s:UTMCampaign',
            'date1': dateFrom,
            'date2': dateTo,
            'limit': '1000',
            'accuracy': 'full',
            'proposed_accuracy': 'false'
        });

        let data;

        try {
            const response = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                // If 400 (likely invalid metric sumAdCosts), try fallback
                if (response.status === 400) {
                    console.warn("Metrika 400 Error (likely missing ad costs). Retrying with visits only.");
                    params.set('metrics', 'ym:s:visits');
                    const responseFallback = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${params}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!responseFallback.ok) {
                        throw new Error(`Metrika Fallback Error: ${responseFallback.status}`);
                    }
                    data = await responseFallback.json();
                } else {
                    throw new Error(`Metrika Stat API error: ${response.status}`);
                }
            } else {
                data = await response.json();
            }

        } catch (fetchErr) {
            throw fetchErr;
        }

        const expenses: ExpenseData[] = [];
        let totalSpend = 0;
        let totalVisits = 0;


        if (data && data.data && Array.isArray(data.data)) {
            data.data.forEach((row: any) => {
                const campaignNameRaw = row.dimensions?.[0]?.name || "Не определена";

                let spend = 0;
                let visits = 0;

                // Handle both behaviors: 2 metrics (spend, visits) or 1 metric (visits only)
                if (row.metrics.length >= 2) {
                    spend = row.metrics[0] || 0;
                    visits = row.metrics[1] || 0;
                } else if (row.metrics.length === 1) {
                    visits = row.metrics[0] || 0;
                }

                if (spend > 0 || visits > 0) {
                    expenses.push({
                        campaign: campaignNameRaw,
                        spend,
                        visits,
                        cpc: visits > 0 ? spend / visits : 0
                    });

                    totalSpend += spend;
                    totalVisits += visits;
                }
            });
        }

        return {
            expenses,
            total: {
                spend: totalSpend,
                visits: totalVisits
            }
        };

    } catch (err) {
        console.error('Fetch Expenses Error:', err);
        throw err;
    }
}
