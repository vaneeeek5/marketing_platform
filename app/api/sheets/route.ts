import { NextResponse } from "next/server";
import { getSheetNames } from "@/lib/googleSheets";

export async function GET() {
    try {
        const sheetNames = await getSheetNames();

        // Filter month sheets (format: "Месяц YYYY" or just "Месяц" for 2024)
        const monthPattern = /^(Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь|Декабрь)(\s+\d{4})?$/;
        const monthSheets = sheetNames
            .filter(name => monthPattern.test(name))
            .sort((a, b) => {
                // Parse month and year for sorting
                const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

                const parseSheet = (s: string) => {
                    const match = s.match(/^(\S+)(?:\s+(\d{4}))?$/);
                    if (!match) return { month: 0, year: 2024 };
                    const monthName = match[1];
                    const year = match[2] ? parseInt(match[2]) : 2024; // Default to 2024 if no year
                    return { month: months.indexOf(monthName), year };
                };

                const pa = parseSheet(a);
                const pb = parseSheet(b);

                // Sort by year desc, then month desc (newest first)
                if (pa.year !== pb.year) return pb.year - pa.year;
                return pb.month - pa.month;
            });

        return NextResponse.json({
            sheets: sheetNames,
            monthSheets: monthSheets
        });
    } catch (error) {
        console.error("Ошибка при получении листов:", error);
        return NextResponse.json({
            sheets: [],
            monthSheets: [],
            error: "Не удалось получить список листов"
        }, { status: 500 });
    }
}
