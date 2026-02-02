"use client";

import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
    status: string;
    className?: string;
}

const statusVariantMap: Record<string, "nedozvon" | "spam" | "tselevoy" | "kval" | "prodazha" | "obichniy" | "zakryto" | "outline"> = {
    "недозвон": "nedozvon",
    "СПАМ": "spam",
    "спам": "spam",
    "целевой": "tselevoy",
    "квал": "kval",
    "продажа": "prodazha",
    "дубль": "spam",
    "не было в такое время лида": "spam",
    "обычный": "obichniy",
    "закрыто": "zakryto",
};

const statusLabels: Record<string, string> = {
    "недозвон": "Недозвон",
    "СПАМ": "СПАМ",
    "спам": "СПАМ",
    "целевой": "Целевой",
    "квал": "Квал",
    "продажа": "Продажа",
    "дубль": "Дубль",
    "не было в такое время лида": "Не было в такое время лида",
    "обычный": "Обычный",
    "закрыто": "Закрыто",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const normalizedStatus = status?.toLowerCase().trim() || "";

    // Find matching variant
    let variant: "nedozvon" | "spam" | "tselevoy" | "kval" | "prodazha" | "obichniy" | "zakryto" | "outline" = "outline";
    let label = status || "—";

    for (const [key, value] of Object.entries(statusVariantMap)) {
        if (normalizedStatus.includes(key.toLowerCase())) {
            variant = value;
            label = statusLabels[key] || status;
            break;
        }
    }

    return (
        <Badge variant={variant} className={cn("font-medium", className)}>
            {label}
        </Badge>
    );
}
