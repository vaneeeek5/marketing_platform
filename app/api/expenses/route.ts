
import { NextResponse } from "next/server";
import { fetchExpenses } from "@/lib/metrika";

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

        const data = await fetchExpenses(startDate, endDate);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Expenses API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
