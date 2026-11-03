"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { useTheme } from "next-themes";
import type { EarningsQuarter } from "@/types/stock";

interface EarningsTrendChartProps {
  data: EarningsQuarter[];
}

export function EarningsTrendChart({ data }: EarningsTrendChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (!data || data.length === 0) {
    return null;
  }

  // Format data for Recharts
  const chartData = data.map((d) => ({
    period: d.period,
    Actual: d.actual !== null ? d.actual : undefined,
    Estimate: d.estimate !== null ? d.estimate : undefined,
    surprisePercent: d.surprisePercent,
  }));

  return (
    <div className="h-60 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "#f4f4f5"}
            vertical={false}
          />
          <XAxis
            dataKey="period"
            stroke={isDark ? "#71717a" : "#a1a1aa"}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: isDark ? "rgba(255, 255, 255, 0.1)" : "#e4e4e7" }}
          />
          <YAxis
            stroke={isDark ? "#71717a" : "#a1a1aa"}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `$${val}`}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: isDark ? "#18181b" : "#ffffff",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#e4e4e7",
              borderRadius: "0.5rem",
              fontSize: "12px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            formatter={(value: unknown, name: unknown) => [
              `$${typeof value === "number" ? value.toFixed(2) : value}`,
              name === "Actual" ? "Actual EPS" : "Estimate EPS",
            ]}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px", color: isDark ? "#a1a1aa" : "#71717a" }}
          />
          <Bar
            dataKey="Actual"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            dataKey="Estimate"
            fill={isDark ? "#3f3f46" : "#cbd5e1"}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
