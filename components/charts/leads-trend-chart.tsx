"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { TrendData } from "@/types";

interface LeadsTrendChartProps {
    data: TrendData[];
}

export function LeadsTrendChart({ data }: LeadsTrendChartProps) {
    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                        dataKey="week"
                        className="text-xs fill-muted-foreground"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                        className="text-xs fill-muted-foreground"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="leads"
                        name="Всего лидов"
                        stroke="hsl(221.2 83.2% 53.3%)"
                        strokeWidth={2}
                        dot={{ fill: "hsl(221.2 83.2% 53.3%)", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="targetLeads"
                        name="Целевые"
                        stroke="hsl(142.1 76.2% 36.3%)"
                        strokeWidth={2}
                        dot={{ fill: "hsl(142.1 76.2% 36.3%)", strokeWidth: 2 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="sales"
                        name="Продажи"
                        stroke="hsl(45.4 93.4% 47.5%)"
                        strokeWidth={2}
                        dot={{ fill: "hsl(45.4 93.4% 47.5%)", strokeWidth: 2 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
