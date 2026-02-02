export const DEFAULT_COLORS: Record<string, string> = {
    'рся': '#3b82f6',      // blue-500
    'мк': '#10b981',       // emerald-500
    'мк3': '#8b5cf6',      // violet-500
    'квиз': '#f59e0b',     // amber-500
    'мкквиз': '#ec4899',   // pink-500
    'поиск': '#06b6d4',    // cyan-500
    'ретаргет': '#ef4444', // red-500
};

// Fallback palette for unknown campaigns
const FALBACK_PALETTE = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
    '#8b5cf6', '#ec4899', '#6b7280'
];

export function getCampaignColor(campaign: string | any): string {
    const defaultColor = '#6b7280'; // gray-500
    const normalized = String(campaign || "").toLowerCase().trim();
    if (!normalized) return defaultColor;

    // 1. Check LocalStorage (Client-side only)
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('campaign-colors');
        if (stored) {
            try {
                const colors = JSON.parse(stored);
                if (colors[normalized]) return colors[normalized];
            } catch (e) {
                console.error('Error parsing campaign colors:', e);
            }
        }
    }

    // 2. Check Defaults
    if (DEFAULT_COLORS[normalized]) {
        return DEFAULT_COLORS[normalized];
    }

    // 3. Generate from Hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % FALBACK_PALETTE.length;
    return FALBACK_PALETTE[index];
}

export function setCampaignColor(campaign: string, color: string): void {
    if (typeof window === 'undefined') return;

    const normalized = String(campaign || "").toLowerCase().trim();
    if (!normalized) return;

    const stored = localStorage.getItem('campaign-colors');
    let colors: Record<string, string> = {};

    if (stored) {
        try {
            colors = JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing campaign colors:', e);
        }
    }

    colors[normalized] = color;
    localStorage.setItem('campaign-colors', JSON.stringify(colors));

    // Dispatch event for real-time updates across components
    window.dispatchEvent(new Event('campaign-colors-updated'));
}

export function resetCampaignColors(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('campaign-colors');
    window.dispatchEvent(new Event('campaign-colors-updated'));
}
