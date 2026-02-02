import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    variant?: "default" | "success" | "warning" | "danger" | "info";
    className?: string;
}

const variantStyles = {
    default: {
        bg: "bg-gradient-to-br from-slate-500/10 to-slate-600/10",
        icon: "bg-slate-500/20 text-slate-600 dark:text-slate-400",
        border: "border-slate-200 dark:border-slate-700",
    },
    success: {
        bg: "bg-gradient-to-br from-emerald-500/10 to-green-600/10",
        icon: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-200 dark:border-emerald-800",
    },
    warning: {
        bg: "bg-gradient-to-br from-amber-500/10 to-orange-600/10",
        icon: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800",
    },
    danger: {
        bg: "bg-gradient-to-br from-red-500/10 to-rose-600/10",
        icon: "bg-red-500/20 text-red-600 dark:text-red-400",
        border: "border-red-200 dark:border-red-800",
    },
    info: {
        bg: "bg-gradient-to-br from-blue-500/10 to-indigo-600/10",
        icon: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-800",
    },
};

export function KPICard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    variant = "default",
    className,
}: KPICardProps) {
    const styles = variantStyles[variant];

    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
                styles.bg,
                styles.border,
                className
            )}
        >
            {/* Background decoration */}
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/5 to-transparent" />

            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold tracking-tight">{value}</p>
                        {trend && (
                            <span
                                className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                    trend.isPositive
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}
                            >
                                {trend.isPositive ? "+" : ""}
                                {trend.value}%
                            </span>
                        )}
                    </div>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                    )}
                </div>

                <div className={cn("rounded-xl p-3", styles.icon)}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    );
}
