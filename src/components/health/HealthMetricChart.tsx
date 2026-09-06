"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export interface HealthChartDataPoint {
  date: string;
  label: string;
  value: number | null;
}

interface HealthMetricChartProps {
  data: HealthChartDataPoint[];
  metricId: string;
  metricUnit: string;
  stroke: string;
}

export function HealthMetricChart({
  data,
  metricId,
  metricUnit,
  stroke,
}: HealthMetricChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
      >
        <defs>
          <linearGradient
            id={`grad-${metricId}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor={stroke}
              stopOpacity={0.25}
            />
            <stop
              offset="95%"
              stopColor={stroke}
              stopOpacity={0.0}
            />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 9, fill: "#71717a" }}
          interval={3}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 9, fill: "#71717a" }}
          domain={["dataMin - 1", "dataMax + 1"]}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const dataPoint = payload[0].payload as HealthChartDataPoint;
              return (
                <div className="bg-zinc-950/90 dark:bg-zinc-900/95 text-white px-3 py-1.5 rounded-xl text-xs backdrop-blur-md border border-zinc-800/80 shadow-float">
                  <div className="text-[10px] text-zinc-400 font-medium">
                    {dataPoint.label}
                  </div>
                  <div className="font-semibold font-mono tabular-nums mt-0.5">
                    {dataPoint.value !== null
                      ? `${dataPoint.value} ${metricUnit}`
                      : "No entry"}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#grad-${metricId})`}
          connectNulls
          dot={{
            r: 2,
            fill: stroke,
            strokeWidth: 1.5,
            stroke: "#ffffff",
          }}
          activeDot={{ r: 4.5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default HealthMetricChart;
