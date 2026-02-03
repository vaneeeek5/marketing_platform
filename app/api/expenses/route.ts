import { NextResponse } from "next/server";
import { fetchExpenses } from "@/lib/metrika";
import { getMetrikaSettings } from "@/lib/googleSheets";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: "startDate and endDate are required" },
                { status: 400 }
            );
        }

        let legacyCampaignMap: Record<string, string> = {};
        let directClientLogins: string[] = [];
        const campaignDictionary = new Set<string>();

        try {
            const settings = await getMetrikaSettings();
            // Add campaign_rules mapping (ID -> Name)
            if (settings.campaign_rules) {
                Object.entries(settings.campaign_rules).forEach(([id, rule]) => {
                    if (rule.name) {
                        legacyCampaignMap[id] = rule.name;
                        campaignDictionary.add(rule.name);
                    }
                });
            }
            // Add expenses_mapping (Array format: each item has utmName, directName, displayName)
            if (settings.expenses_mapping && Array.isArray(settings.expenses_mapping)) {
                settings.expenses_mapping.forEach((item) => {
                    // Determine the final target name
                    const targetName = item.displayName || item.directName || item.utmName;

                    if (!targetName) return;

                    campaignDictionary.add(targetName);

                    if (item.utmName) {
                        legacyCampaignMap[item.utmName] = targetName;
                    }
                    if (item.directName) {
                        legacyCampaignMap[item.directName] = targetName;
                    }
                });
            }
            if (settings.direct_client_logins) {
                directClientLogins = settings.direct_client_logins;
            }
        } catch (settingsError) {
            console.warn("Failed to load settings for expenses:", settingsError);
        }

        const data = await fetchExpenses(startDate, endDate, legacyCampaignMap, directClientLogins);

        return NextResponse.json({
            ...data,
            campaignDictionary: Array.from(campaignDictionary).sort()
        });
    } catch (error: any) {
        console.error("Expenses API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
