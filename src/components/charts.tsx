"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Chart layer for the console.
 *
 * Colours come from --c1..--c8 in globals.css, assigned in fixed slot order and never
 * cycled — a series keeps its hue when the set is filtered. SVG resolves the custom
 * properties per theme, so light and dark each get their own validated steps without
 * any JS.
 *
 * Every chart ships a tooltip; anything with two or more series ships a legend, so
 * identity is never carried by colour alone.
 */

export const SERIES = [
  "var(--c1)",
  "var(--c2)",
  "var(--c3)",
  "var(--c4)",
  "var(--c5)",
  "var(--c6)",
  "var(--c7)",
  "var(--c8)",
];

const GRID = "var(--chart-grid)";
const AXIS = "var(--chart-axis)";
const TEXT = "var(--chart-text)";

const axisProps = {
  stroke: AXIS,
  tick: { fill: TEXT, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: AXIS },
} as const;

/**
 * Compact the y-axis ticks. A fixed narrow axis clips long labels from the left, which
 * turns 3,600 into "600" - a silently wrong number rather than an obviously broken one.
 */
function tickFormat(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(v);
}

const yAxisProps = {
  ...axisProps,
  width: 46,
  tickFormatter: tickFormat,
} as const;

/**
 * Value formatting is passed as a token, not a callback: these charts are client
 * components rendered from server components, and a function prop cannot cross that
 * boundary.
 */
export type ValueFormat = "int" | "money" | "compact";

const FORMATTERS: Record<ValueFormat, (v: number) => string> = {
  int: (v) => v.toLocaleString("en-AU"),
  money: (v) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(v),
  compact: (v) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString("en-AU"),
};

function fmt(v: number, f?: ValueFormat) {
  return f ? FORMATTERS[f](v) : v.toLocaleString("en-AU");
}

function TipBox({
  active,
  payload,
  label,
  valueFormat,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  valueFormat?: ValueFormat;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="surface-2 border rounded-md px-2.5 py-2 shadow-sm text-[12px]">
      {label !== undefined && (
        <div className="font-medium mb-1 text-[11.5px]">{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 whitespace-nowrap">
          <span
            className="h-2 w-2 rounded-[2px] shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-2">{p.name}</span>
          <span className="ml-auto tabular font-medium">
            {typeof p.value === "number" ? fmt(p.value, valueFormat) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const legendProps = {
  wrapperStyle: { fontSize: 11.5, color: TEXT, paddingTop: 6 },
  iconType: "square" as const,
  iconSize: 8,
};

export function ChartFrame({
  height = 200,
  children,
}: {
  height?: number;
  children: React.ReactElement;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------- stacked area */

export function StackedArea({
  data,
  keys,
  xKey,
  height = 220,
  valueFormat,
}: {
  data: Record<string, string | number>[];
  keys: string[];
  xKey: string;
  height?: number;
  valueFormat?: ValueFormat;
}) {
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <defs>
          {keys.map((k, i) => (
            <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[i % 8]} stopOpacity={0.5} />
              <stop offset="100%" stopColor={SERIES[i % 8]} stopOpacity={0.08} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={GRID} strokeWidth={0.8} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          content={<TipBox valueFormat={valueFormat} />}
          cursor={{ stroke: AXIS, strokeWidth: 1 }}
        />
        {keys.length > 1 && <Legend {...legendProps} />}
        {keys.map((k, i) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            stackId="1"
            stroke={SERIES[i % 8]}
            strokeWidth={2}
            fill={`url(#grad-${k})`}
          />
        ))}
      </AreaChart>
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------- lines */

export function MultiLine({
  data,
  keys,
  xKey,
  height = 220,
  valueFormat,
}: {
  data: Record<string, string | number>[];
  keys: string[];
  xKey: string;
  height?: number;
  valueFormat?: ValueFormat;
}) {
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} strokeWidth={0.8} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          content={<TipBox valueFormat={valueFormat} />}
          cursor={{ stroke: AXIS, strokeWidth: 1 }}
        />
        {keys.length > 1 && <Legend {...legendProps} />}
        {keys.map((k, i) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            stroke={SERIES[i % 8]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

/* --------------------------------------------------------------------- bars */

export function Bars({
  data,
  keys,
  xKey,
  height = 220,
  stacked = false,
  valueFormat,
  colorOffset = 0,
}: {
  data: Record<string, string | number>[];
  keys: string[];
  xKey: string;
  height?: number;
  stacked?: boolean;
  valueFormat?: ValueFormat;
  colorOffset?: number;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} strokeWidth={0.8} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          content={<TipBox valueFormat={valueFormat} />}
          cursor={{ fill: GRID, fillOpacity: 0.5 }}
        />
        {keys.length > 1 && <Legend {...legendProps} />}
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId={stacked ? "1" : undefined}
            fill={SERIES[(i + colorOffset) % 8]}
            radius={stacked ? 0 : [3, 3, 0, 0]}
            maxBarSize={38}
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

/* -------------------------------------------------------- horizontal bars */

export function HBars({
  data,
  labelKey,
  valueKey,
  height = 220,
  valueFormat,
}: {
  data: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
  height?: number;
  valueFormat?: ValueFormat;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
      >
        <CartesianGrid stroke={GRID} strokeWidth={0.8} horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={tickFormat} />
        <YAxis
          type="category"
          dataKey={labelKey}
          {...axisProps}
          width={112}
          tick={{ fill: "var(--text-2)", fontSize: 11.5 }}
        />
        <Tooltip
          content={<TipBox valueFormat={valueFormat} />}
          cursor={{ fill: GRID, fillOpacity: 0.5 }}
        />
        <Bar dataKey={valueKey} radius={[0, 3, 3, 0]} maxBarSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % 8]} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------- donut */

export function Donut({
  data,
  height = 200,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  return (
    <div className="relative" style={{ height }}>
      <ChartFrame height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="var(--surface-2)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SERIES[i % 8]} />
            ))}
          </Pie>
          <Tooltip content={<TipBox />} />
          <Legend {...legendProps} />
        </PieChart>
      </ChartFrame>
      {centerValue && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ paddingBottom: 28 }}
        >
          <div className="text-[22px] font-semibold tabular leading-none">
            {centerValue}
          </div>
          {centerLabel && (
            <div className="text-3 text-[11px] mt-1">{centerLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- funnel */

export function Funnel({
  stages,
}: {
  stages: { label: string; value: number; note?: string }[];
}) {
  const max = Math.max(...stages.map((s) => s.value));
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[12.5px] font-medium">{s.label}</span>
            <span className="text-[12.5px] tabular">
              {s.value.toLocaleString()}
              {i > 0 && (
                <span className="text-3 ml-1.5 text-[11px]">
                  {Math.round((s.value / stages[i - 1].value) * 100)}%
                </span>
              )}
            </span>
          </div>
          <div className="h-5 rounded surface-3 overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${(s.value / max) * 100}%`,
                background: SERIES[i % 8],
              }}
            />
          </div>
          {s.note && <div className="text-3 text-[11px] mt-1">{s.note}</div>}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- sparkline */

export function Sparkline({
  data,
  dataKey,
  color = 0,
  height = 34,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  color?: number;
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[color % 8]} stopOpacity={0.45} />
            <stop offset="100%" stopColor={SERIES[color % 8]} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={SERIES[color % 8]}
          strokeWidth={1.6}
          fill={`url(#spark-${dataKey})`}
          dot={false}
        />
      </AreaChart>
    </ChartFrame>
  );
}
