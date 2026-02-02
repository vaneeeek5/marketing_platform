import { NextResponse } from "next/server";
import { getGoals } from "@/lib/metrika";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const goals = await getGoals();
        return NextResponse.json({ goals });
    } catch (error) {
        console.error("Error fetching goals:", error);
        return NextResponse.json(
            { error: "Failed to fetch goals from Metrika" },
            { status: 500 }
        );
    }
}
