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
// Форматирование времени
export function formatTime(time: string | number): string {
    if (!time) return "";

    // Если пришло "4:53:" или дробное число (Excel serial time)
    if (typeof time === 'number') {
        // Конвертируем Excel serial time в HH:MM:SS
        const totalSeconds = Math.round(time * 24 * 60 * 60);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // Если строка "4:53:" - дополняем секундами (или просто парсим)
    if (typeof time === 'string') {
        // Очистка от лишних символов если нужно, но пока просто сплит
        const parts = time.split(':');
        // Если уже HH:MM:SS, просто вернем
        // Если HH:MM, дополним
        const h = parts[0]?.padStart(2, '0') || '00';
        const m = parts[1]?.padStart(2, '0') || '00';
        const s = parts[2]?.padStart(2, '0') || '00';
        return `${h}:${m}:${s}`;
    }

    return "00:00:00";
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

// Парсинг даты из строки формата YYYY-MM-DD, DD.MM.YYYY или Excel Serial
export function parseDate(dateStr: string | number): Date | null {
    if (!dateStr) return null;

    // Excel Serial Date (e.g. 45326)
    // 25569 is offset between Excel (1900-01-01) and Unix (1970-01-01) in days
    // 86400 * 1000 is milliseconds per day
    // Excel leap year bug 1900 is ignored usually
    const num = Number(dateStr);
    if (!isNaN(num) && num > 20000 && !String(dateStr).includes("-") && !String(dateStr).includes(".")) {
        const utc_days = Math.floor(num - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        return date_info;
    }

    const str = String(dateStr);

    // Попробуем YYYY-MM-DD
    if (str.includes("-")) {
        const date = new Date(str);
        if (!isNaN(date.getTime())) return date;
    }

    // Попробуем DD.MM.YYYY
    if (str.includes(".")) {
        const parts = str.split(".");
        // Check parts length
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            return new Date(year, month - 1, day);
        }
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
