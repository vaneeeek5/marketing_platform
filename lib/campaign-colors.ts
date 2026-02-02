export const CAMPAIGN_COLORS: Record<string, string> = {
    "Поиск": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "РСЯ": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "Ретаргет": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "Мастера": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "Прямые заходы": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    "default": "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
};

export function getCampaignColor(campaignName: string): string {
    const name = campaignName?.toLowerCase() || "";

    if (name.includes("поиск")) return CAMPAIGN_COLORS["Поиск"];
    if (name.includes("рся") || name.includes("network")) return CAMPAIGN_COLORS["РСЯ"];
    if (name.includes("ретаргет") || name.includes("retarget")) return CAMPAIGN_COLORS["Ретаргет"];
    if (name.includes("мастер") || name.includes("master")) return CAMPAIGN_COLORS["Мастера"];
    if (name.includes("прямые")) return CAMPAIGN_COLORS["Прямые заходы"];

    return CAMPAIGN_COLORS["default"];
}
