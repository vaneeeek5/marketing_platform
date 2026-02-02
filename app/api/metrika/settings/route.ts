import { NextRequest, NextResponse } from "next/server";
import { getMetrikaSettings, updateMetrikaSettings } from "@/lib/googleSheets";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const settings = await getMetrikaSettings();
        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error fetching settings:", error);
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // Remove derived/readonly fields if necessary, or just pass payload
        // updateMetrikaSettings handles Partial<MetrikaSettings>
        await updateMetrikaSettings(body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating settings:", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
