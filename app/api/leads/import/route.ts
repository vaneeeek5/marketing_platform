export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { COLUMN_NAMES } from "@/lib/constants";
import * as XLSX from "xlsx";

// POST /api/leads/import - импорт из Excel
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "Файл не предоставлен" },
                { status: 400 }
            );
        }

        const project = await prisma.project.findFirst();
        if (!project) {
            return NextResponse.json({ error: "Проект в БД не найден" }, { status: 400 });
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

        // Преобразуем строки в объекты для БД
        const recordsToCreate = rows
            .filter((row) => row.some((cell) => cell && cell.trim())) // Фильтруем пустые строки
            .map((row) => {
                const obj: Record<string, string> = {};
                headers.forEach((header, index) => {
                    const mappedColumn = columnMapping[header] || header;
                    obj[mappedColumn] = row[index] || "";
                });
                
                let dateObj = new Date(`${obj[COLUMN_NAMES.DATE]}T${obj[COLUMN_NAMES.TIME] || "00:00:00"}`);
                if (isNaN(dateObj.getTime())) { dateObj = new Date(); }

                return {
                    projectId: project.id,
                    date: dateObj,
                    campaign: obj[COLUMN_NAMES.CAMPAIGN] || "",
                    qualification: obj[COLUMN_NAMES.QUALIFICATION] || "",
                    comment: obj[COLUMN_NAMES.COMMENT] || ""
                };
            });

        if (recordsToCreate.length === 0) {
            return NextResponse.json(
                { error: "Нет данных для импорта" },
                { status: 400 }
            );
        }

        // Добавляем строки в БД
        const result = await prisma.lead.createMany({
            data: recordsToCreate,
            skipDuplicates: true
        });

        return NextResponse.json({
            success: true,
            message: `Успешно импортировано ${result.count} строк`,
            importedCount: result.count,
        });
    } catch (error) {
        console.error("Ошибка при импорте:", error);
        return NextResponse.json(
            { error: "Не удалось импортировать файл" },
            { status: 500 }
        );
    }
}
