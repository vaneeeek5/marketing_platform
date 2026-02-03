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
        try {
            const settings = await getMetrikaSettings();
            if (settings.campaign_rules) {
                Object.entries(settings.campaign_rules).forEach(([id, rule]) => {
                    if (rule.name) legacyCampaignMap[id] = rule.name;
                });
            }
        } catch (settingsError) {
            console.warn("Failed to load settings for expenses:", settingsError);
            // Continue without mapping if settings fail
        }

        const data = await fetchExpenses(startDate, endDate, legacyCampaignMap);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Expenses API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
