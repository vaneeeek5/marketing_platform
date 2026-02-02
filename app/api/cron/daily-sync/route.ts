import { NextResponse } from "next/server";
import { getMetrikaSettings } from "@/lib/googleSheets";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const settings = await getMetrikaSettings();

        if (!settings.auto_sync_enabled) {
            return NextResponse.json({ message: "Auto-sync disabled" });
        }

        // Calculate "yesterday"
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

        // Determine active goals
        const goalIds = Object.entries(settings.goals)
            .filter(([_, enabled]) => enabled)
            .map(([id]) => parseInt(id, 10));

        // Call sync logic (reuse the internal logic or call the endpoint?)
        // Better to call the logic directly to avoid self-request overhead/issues

        // We need to import the POST logic or extract it. 
        // For simplicity let's do a fetch to our own API 
        // OR better: extract the core logic to a lib function?
        // Given the constraints, I will do a fetch to absolute URL if I knew the host, 
        // but I don't know the host reliably in all envs.
        // So I will just copy the logic or import it if I refactored.
        // To be safe and quick, I'll just look at how I implemented POST.
        // I implemented it in route.ts.

        // Let's just do a fetch to the sync route using localhost
        // But authentication might be an issue if we had it.
        // We don't have auth on /api/sync/metrika yet.

        const port = process.env.PORT || 3000;
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : `http://localhost:${port}`;

        const response = await fetch(`${baseUrl}/api/sync/metrika`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dateFrom: dateStr,
                dateTo: dateStr,
                goalIds: goalIds,
                manual: false
            })
        });

        const result = await response.json();

        return NextResponse.json({
            success: true,
            date: dateStr,
            result
        });

    } catch (error) {
        console.error("Cron sync error:", error);
        return NextResponse.json(
            { error: "Cron job failed" },
            { status: 500 }
        );
    }
}
