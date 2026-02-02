import { Recommendation } from "@/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle, Lightbulb } from "lucide-react";

interface RecommendationsWidgetProps {
    recommendations: Recommendation[];
}

const typeConfig = {
    warning: {
        icon: AlertTriangle,
        bg: "bg-amber-50 dark:bg-amber-900/20",
        border: "border-amber-200 dark:border-amber-800",
        iconColor: "text-amber-600 dark:text-amber-400",
    },
    info: {
        icon: Info,
        bg: "bg-blue-50 dark:bg-blue-900/20",
        border: "border-blue-200 dark:border-blue-800",
        iconColor: "text-blue-600 dark:text-blue-400",
    },
    success: {
        icon: CheckCircle,
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        border: "border-emerald-200 dark:border-emerald-800",
        iconColor: "text-emerald-600 dark:text-emerald-400",
    },
};

export function RecommendationsWidget({
    recommendations,
}: RecommendationsWidgetProps) {
    if (recommendations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/20 p-4 mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold">Всё отлично!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Рекомендаций по оптимизации нет
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold">Рекомендации</h3>
            </div>

            {recommendations.map((rec, index) => {
                const config = typeConfig[rec.type];
                const Icon = config.icon;

                return (
                    <div
                        key={index}
                        className={cn(
                            "flex gap-3 rounded-lg border p-4 transition-all hover:shadow-sm",
                            config.bg,
                            config.border
                        )}
                    >
                        <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.iconColor)} />
                        <div className="space-y-1">
                            <p className="font-medium text-sm">{rec.title}</p>
                            <p className="text-sm text-muted-foreground">{rec.description}</p>
                            {rec.campaign && (
                                <span className="inline-block mt-2 text-xs font-medium bg-black/5 dark:bg-white/10 rounded px-2 py-1">
                                    Кампания: {rec.campaign}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
