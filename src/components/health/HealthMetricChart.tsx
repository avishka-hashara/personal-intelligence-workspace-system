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
              stopOpacity={0.3}
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
          tick={{ fontSize: 9, fill: "#94a3b8" }}
          interval={3}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 9, fill: "#94a3b8" }}
          domain={["dataMin - 1", "dataMax + 1"]}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const dataPoint = payload[0].payload as HealthChartDataPoint;
              return (
                <div className="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-xs shadow-lg">
                  <div className="text-[10px] text-slate-400">
                    {dataPoint.label}
                  </div>
                  <div className="font-bold">
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
            r: 2.5,
            fill: stroke,
            strokeWidth: 1,
            stroke: "#fff",
          }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default HealthMetricChart;
