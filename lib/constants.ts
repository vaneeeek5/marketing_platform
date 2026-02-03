// Название текущего месяца листа в Google Sheets
export const CURRENT_MONTH_SHEET = "Лиды";

// Маппинг названий колонок из Google Sheets
export const COLUMN_NAMES = {
    NUMBER: "№",
    CAMPAIGN: "Кампания",
    DATE: "Дата",
    TIME: "Время",
    QUALIFICATION: "Квалификация",
    COMMENT: "Комментарий",
    SALES: "ПРОДАЖИ",
} as const;

// Статусы лидов
export const LEAD_STATUSES = {
    NEDOZVON: "недозвон",
    SPAM: "СПАМ",
    TSELEVOY: "целевой",
    KVAL: "квал",
    PRODAZHA: "продажа",
} as const;

// Цвета статусов для UI
export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "недозвон": { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", border: "border-gray-300" },
    "СПАМ": { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", border: "border-red-300" },
    "целевой": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-300" },
    "квал": { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", border: "border-green-300" },
    "продажа": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300" },
};

// Названия кампаний
export const CAMPAIGN_NAMES = ["РСЯ", "МК", "МК3", "Поиск", "Ретаргет"] as const;

// Пороговые значения для рекомендаций
export const THRESHOLDS = {
    HIGH_CPL: 3000, // руб
    LOW_TARGET_PERCENT: 15, // %
};

// Навигация сайдбара
export const NAV_ITEMS = [
    { href: "/", label: "Главная", icon: "LayoutDashboard" },
    { href: "/leads", label: "Лиды", icon: "Users" },
    { href: "/reports", label: "Отчёты", icon: "FileText" },
    { href: "/expenses", label: "Расходы", icon: "Wallet" },
    { href: "/settings", label: "Настройки", icon: "Settings" },
] as const;
