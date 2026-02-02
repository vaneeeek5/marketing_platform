import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Форматирование даты
export function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

// Форматирование времени
export function formatTime(timeStr: string): string {
    if (!timeStr) return "";
    return timeStr.slice(0, 5); // HH:MM
}

// Форматирование числа с разделителями
export function formatNumber(num: number): string {
    return new Intl.NumberFormat("ru-RU").format(num);
}

// Форматирование валюты
export function formatCurrency(num: number): string {
    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(num);
}

// Форматирование процентов
export function formatPercent(num: number): string {
    return new Intl.NumberFormat("ru-RU", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(num / 100);
}

// Получение номера недели
export function getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Парсинг даты из строки формата YYYY-MM-DD или DD.MM.YYYY
export function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Попробуем YYYY-MM-DD
    if (dateStr.includes("-")) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) return date;
    }

    // Попробуем DD.MM.YYYY
    if (dateStr.includes(".")) {
        const [day, month, year] = dateStr.split(".").map(Number);
        return new Date(year, month - 1, day);
    }

    return null;
}

// Проверка является ли значение целевым лидом
export function isTargetLead(qualification: string): boolean {
    const q = qualification?.toLowerCase() || "";
    return q.includes("целевой") || q.includes("target");
}

// Проверка является ли значение квалифицированным лидом
export function isQualifiedLead(qualification: string): boolean {
    const q = qualification?.toLowerCase() || "";
    return q.includes("квал") || q.includes("qual");
}

// Проверка является ли значение продажей
export function isSale(salesValue: string | number): boolean {
    if (typeof salesValue === "number") return salesValue > 0;
    return salesValue === "1" || salesValue?.toLowerCase() === "да" || salesValue?.toLowerCase() === "yes";
}
