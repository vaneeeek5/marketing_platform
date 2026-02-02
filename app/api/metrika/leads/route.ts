import { NextResponse } from "next/server";
import { getSheetData, getSheetNames } from "@/lib/googleSheets";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const targetSheet = "Лиды"; // Currently single sheet architecture

        const data = await getSheetData(targetSheet);

        // Filter empty rows and ensure date exists
        const leads = data.filter(row => row["Дата"]);

        // Sort by Date desc (assuming DD.MM.YYYY format or ISO)
        // If format is DD.MM.YYYY, string sort might be wrong, but let's keep it simple for now or parse.
        // The original code did simple string comparison.
        leads.sort((a, b) => {
            // Helper to parse DD.MM.YYYY to comparable context if needed, 
            // but for now keeping existent logic or improving if safe.
            // Let's stick to string sort since it was there, but ideally we should parse.
            const dateA = String(a["Дата"] || "");
            const dateB = String(b["Дата"] || "");
            if (!dateA) return 1;
            if (!dateB) return -1;

            // Try to parse DD.MM.YYYY
            const partsA = dateA.split('.');
            const partsB = dateB.split('.');
            if (partsA.length === 3 && partsB.length === 3) {
                const dA = new Date(`${partsA[2]}-${partsA[1]}-${partsA[0]}`);
                const dB = new Date(`${partsB[2]}-${partsB[1]}-${partsB[0]}`);
                return dB.getTime() - dA.getTime();
            }

            return dateA > dateB ? -1 : 1;
        });

        return NextResponse.json({ leads, sheetName: targetSheet });

    } catch (error) {
        console.error("Error fetching leads:", error);
        return NextResponse.json(
            { error: "Failed to fetch leads" },
            { status: 500 }
        );
    }
}
