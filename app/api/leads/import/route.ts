import { NextRequest, NextResponse } from "next/server";
import { appendRows } from "@/lib/googleSheets";
import { CURRENT_MONTH_SHEET, COLUMN_NAMES } from "@/lib/constants";
import * as XLSX from "xlsx";

// POST /api/leads/import - импорт из Excel
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const sheetName = (formData.get("sheetName") as string) || CURRENT_MONTH_SHEET;

        if (!file) {
            return NextResponse.json(
                { error: "Файл не предоставлен" },
                { status: 400 }
            );
        }

        // Читаем файл
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });

        // Берём первый лист
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Преобразуем в JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
        }) as string[][];

        if (jsonData.length < 2) {
            return NextResponse.json(
                { error: "Файл пустой или содержит только заголовки" },
                { status: 400 }
            );
        }

        // Первая строка - заголовки
        const headers = jsonData[0];
        const rows = jsonData.slice(1);

        // Маппинг заголовков Excel на наши колонки
        const columnMapping: Record<string, string> = {
            "№": COLUMN_NAMES.NUMBER,
            "Номер": COLUMN_NAMES.NUMBER,
            "Кампания": COLUMN_NAMES.CAMPAIGN,
            "Campaign": COLUMN_NAMES.CAMPAIGN,
            "Дата": COLUMN_NAMES.DATE,
            "Date": COLUMN_NAMES.DATE,
            "Время": COLUMN_NAMES.TIME,
            "Time": COLUMN_NAMES.TIME,
            "Квалификация": COLUMN_NAMES.QUALIFICATION,
            "Статус": COLUMN_NAMES.QUALIFICATION,
            "Status": COLUMN_NAMES.QUALIFICATION,
            "Комментарий": COLUMN_NAMES.COMMENT,
            "Comment": COLUMN_NAMES.COMMENT,
        };

        // Преобразуем строки в объекты
        const processedRows = rows
            .filter((row) => row.some((cell) => cell && cell.trim())) // Фильтруем пустые строки
            .map((row) => {
                const obj: Record<string, string> = {};
                headers.forEach((header, index) => {
                    const mappedColumn = columnMapping[header] || header;
                    obj[mappedColumn] = row[index] || "";
                });
                return obj;
            });

        if (processedRows.length === 0) {
            return NextResponse.json(
                { error: "Нет данных для импорта" },
                { status: 400 }
            );
        }

        // Добавляем строки в Google Sheets
        const addedCount = await appendRows(sheetName, processedRows);

        return NextResponse.json({
            success: true,
            message: `Успешно импортировано ${addedCount} строк`,
            importedCount: addedCount,
        });
    } catch (error) {
        console.error("Ошибка при импорте:", error);
        return NextResponse.json(
            { error: "Не удалось импортировать файл" },
            { status: 500 }
        );
    }
}
