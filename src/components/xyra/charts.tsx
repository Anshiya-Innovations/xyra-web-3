// ApexCharts wrappers in TailAdmin's chart style (Outfit font, brand #465fff,
// no toolbar) - replace xyra-react's recharts donut/line/bar charts.
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";

const BRAND = "#465fff";
const AXIS_LABEL = { style: { fontSize: "12px", colors: "#6B7280" } };

const base: ApexOptions = {
  chart: { fontFamily: "Outfit, sans-serif", toolbar: { show: false } },
  dataLabels: { enabled: false },
  legend: { show: false },
  grid: { borderColor: "#E5E7EB", xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
};

export function DonutChart({
  labels,
  series,
  colors,
  height = 260,
}: {
  labels: string[];
  series: number[];
  colors: string[];
  height?: number;
}) {
  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "donut" },
    labels,
    colors,
    stroke: { width: 0 },
    legend: { show: true, position: "bottom", fontFamily: "Outfit", labels: { colors: "#6B7280" } },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: { show: true, label: "Total", color: "#6B7280", fontSize: "13px" },
            value: { color: "#1D2939", fontSize: "22px", fontWeight: 600 },
          },
        },
      },
    },
  };
  return <Chart options={options} series={series} type="donut" height={height} />;
}

export function LineChart({
  categories,
  data,
  name,
  height = 260,
}: {
  categories: string[];
  data: number[];
  name: string;
  height?: number;
}) {
  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "area" },
    colors: [BRAND],
    stroke: { curve: "smooth", width: 2 },
    fill: { type: "gradient", gradient: { opacityFrom: 0.45, opacityTo: 0 } },
    markers: { size: 3, strokeWidth: 0, hover: { size: 5 } },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: AXIS_LABEL },
    yaxis: { labels: { ...AXIS_LABEL, formatter: (v: number) => String(Math.round(v)) } },
  };
  return <Chart options={options} series={[{ name, data }]} type="area" height={height} />;
}

export function BarChart({
  categories,
  data,
  name,
  height = 260,
  colors,
  horizontal = false,
}: {
  categories: string[];
  data: number[];
  name: string;
  height?: number;
  colors?: string[];
  horizontal?: boolean;
}) {
  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "bar" },
    colors: colors ?? [BRAND],
    plotOptions: {
      bar: {
        horizontal,
        columnWidth: "40%",
        barHeight: "60%",
        borderRadius: 5,
        borderRadiusApplication: "end",
        distributed: !!colors,
      },
    },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: AXIS_LABEL },
    yaxis: { labels: { ...AXIS_LABEL, formatter: (v: number) => (horizontal ? String(v) : String(Math.round(v))) } },
  };
  return <Chart options={options} series={[{ name, data }]} type="bar" height={height} />;
}
