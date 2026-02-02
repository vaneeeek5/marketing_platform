// Тип лида из Google Sheets
export interface Lead {
    rowIndex: number;
    metrika_visit_id?: string;
    number: string;
    campaign: string;
    date: string;
    time: string;
    qualification: string;
    comment: string;
    sales: string;
    // Дополнительные поля для флагов кампаний
    [key: string]: string | number;
}

// Данные для обновления лида
export interface LeadUpdate {
    sheetName: string;
    rowIndex: number;
    field: "qualification" | "comment";
    value: string;
}

// KPI метрики
export interface KPIMetrics {
    totalLeads: number;
    targetLeads: number;
    qualifiedLeads: number;
    sales: number;
    targetPercent: number;
    qualifiedPercent: number;
    conversionRate: number;
    // Финансовые метрики (если доступны данные бюджета)
    totalSpend?: number;
    cpl?: number;
    cpo?: number;
}

// Данные для графика трендов
export interface TrendData {
    week: string;
    leads: number;
    targetLeads: number;
    sales: number;
}

// Агрегированные данные по кампании
export interface CampaignStats {
    name: string;
    totalLeads: number;
    targetLeads: number;
    qualifiedLeads: number;
    sales: number;
    targetPercent: number;
    qualifiedPercent: number;
    conversionRate: number;
    spend?: number;
    cpl?: number;
}

// Рекомендация
export interface Recommendation {
    type: "warning" | "info" | "success";
    title: string;
    description: string;
    campaign?: string;
}

// Фильтры для списка лидов
export interface LeadFilters {
    campaign?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
}

// Ответ API для лидов
export interface LeadsResponse {
    leads: Lead[];
    total: number;
    sheetName: string;
}

// Ответ API для аналитики
export interface AnalyticsResponse {
    kpi: KPIMetrics;
    trends: TrendData[];
    recommendations: Recommendation[];
    campaignStats: CampaignStats[];
    metrikaStats?: {
        total: number;
        byGoal: Record<string, number>;
    };
}

// Бюджетные данные
export interface BudgetData {
    campaign: string;
    spend: number;
    period: string;
}
