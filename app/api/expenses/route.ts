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
        try {
            const settings = await getMetrikaSettings();
            // Add campaign_rules mapping (ID -> Name)
            if (settings.campaign_rules) {
                Object.entries(settings.campaign_rules).forEach(([id, rule]) => {
                    if (rule.name) legacyCampaignMap[id] = rule.name;
                });
            }
            // Add expenses_mapping (UTM -> Direct Name) for expenses merging
            // Also build display name map for renaming campaigns
            if (settings.expenses_mapping) {
                Object.entries(settings.expenses_mapping).forEach(([utmName, mapping]) => {
                    // Map UTM name to Direct name for matching
                    if (mapping.directName) legacyCampaignMap[utmName] = mapping.directName;
                    // Also map Direct name to display name for final display
                    if (mapping.displayName && mapping.directName) {
                        legacyCampaignMap[mapping.directName] = mapping.displayName;
                    }
                });
            }
            if (settings.direct_client_logins) {
                directClientLogins = settings.direct_client_logins;
            }
        } catch (settingsError) {
            console.warn("Failed to load settings for expenses:", settingsError);
            // Continue without mapping if settings fail
        }

        const data = await fetchExpenses(startDate, endDate, legacyCampaignMap, directClientLogins);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Expenses API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
