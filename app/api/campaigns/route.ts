import { NextResponse } from "next/server";
import { getUniqueCampaigns } from "@/lib/googleSheets";
import { CURRENT_MONTH_SHEET } from "@/lib/constants";

// GET /api/campaigns - получить список кампаний
export async function GET() {
    try {
        const campaigns = await getUniqueCampaigns(CURRENT_MONTH_SHEET);

        return NextResponse.json({
            campaigns,
            total: campaigns.length,
        });
    } catch (error) {
        console.error("Ошибка при получении кампаний:", error);
        return NextResponse.json(
            { error: "Не удалось получить список кампаний" },
            { status: 500 }
        );
    }
}
