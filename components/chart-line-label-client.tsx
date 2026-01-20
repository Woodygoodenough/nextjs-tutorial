"use client"

import { TrendingDown, TrendingUp } from "lucide-react"
import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type ChartRow = { day: string; avg: number; vocab: number }

const chartConfig = {
  avg: {
    label: "Avg progress",
    color: "hsl(var(--chart-1))",
  },
  vocab: {
    label: "Vocab count",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ChartLineLabelClient({ data }: { data: Array<ChartRow> }) {
  const first = data[0]?.avg
  const last = data[data.length - 1]?.avg
  const delta = typeof first === "number" && typeof last === "number" ? last - first : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mastery Progress</CardTitle>
        <CardDescription>Last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              top: 20,
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => String(value).slice(5)} // MM-DD
              interval={0}
              minTickGap={0}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              domain={([min, max]) => {
                const lo = typeof min === "number" ? min : 0
                const hi = typeof max === "number" ? max : 100
                const pad = Math.max(1, Math.round((hi - lo) * 0.1))
                return [Math.max(0, lo - pad), Math.min(100, hi + pad)]
              }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              domain={([min, max]) => {
                const lo = typeof min === "number" ? min : 0
                const hi = typeof max === "number" ? max : 0
                const pad = Math.max(10, Math.round((hi - lo) * 0.1))
                return [lo - pad, hi + pad]
              }}
              tickFormatter={(v) => String(v)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Line
              dataKey="avg"
              type="natural"
              yAxisId="left"
              stroke="var(--color-avg)"
              strokeWidth={2}
              dot={{
                fill: "var(--color-avg)",
              }}
              activeDot={{
                r: 6,
              }}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
              />
            </Line>
            <Line
              dataKey="vocab"
              type="natural"
              yAxisId="right"
              stroke="var(--color-vocab)"
              strokeWidth={2}
              dot={{
                fill: "var(--color-vocab)",
              }}
              activeDot={{
                r: 6,
              }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          {delta === null ? (
            "No progress data yet"
          ) : delta >= 0 ? (
            <>
              Up {delta.toFixed(1)} % over 7 days <TrendingUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Down {Math.abs(delta).toFixed(1)} pp over 7 days{" "}
              <TrendingDown className="h-4 w-4" />
            </>
          )}
        </div>
        <div className="text-muted-foreground leading-none">
          Showing average progress for the last 7 days
        </div>
      </CardFooter>
    </Card>
  )
}

