"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartConfig {
    type: "bar" | "line" | "pie";
    data: Record<string, unknown>[];
    xKey?: string;
    yKey?: string;
    title?: string;
}

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F"];

export function ChartRenderer({ config }: { config: ChartConfig }) {
    console.log("ChartRenderer received config:", config);

    if (!config || !config.data) {
        console.log("ChartRenderer: No valid config or data");
        return null;
    }

    // Default keys for common chart data structures
    const xKey = config.xKey || "name";
    const yKey = config.yKey || "value";

    // Normalize data: convert object format {key: value} to array format [{name, value}]
    let chartData: Record<string, unknown>[];

    if (Array.isArray(config.data)) {
        chartData = config.data;
    } else if (typeof config.data === 'object') {
        // Convert {Male: 51, Female: 44} to [{name: "Male", value: 51}, ...]
        console.log("ChartRenderer: Converting object to array format");
        chartData = Object.entries(config.data).map(([key, val]) => ({
            [xKey]: key,
            [yKey]: val
        }));
    } else {
        console.log("ChartRenderer: Invalid data format", typeof config.data);
        return null;
    }

    if (chartData.length === 0) {
        console.log("ChartRenderer: Empty data array");
        return null;
    }

    const renderChart = () => {
        switch (config.type) {
            case "bar":
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={xKey} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey={yKey} fill="#8884d8" name={yKey} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            case "line":
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={xKey} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey={yKey}
                                stroke="#8884d8"
                                activeDot={{ r: 8 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                );
            case "pie":
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }: { name?: string; percent?: number }) =>
                                    `${name ?? 'Unknown'}: ${((percent ?? 0) * 100).toFixed(0)}%`
                                }
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey={yKey}
                                nameKey={xKey}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                );
            default:
                return <div>Unsupported chart type</div>;
        }
    };

    return (
        <Card className="w-full mt-4 bg-card/50">
            <CardHeader>
                <CardTitle className="text-sm font-medium">
                    {config.title || "Visualization"}
                </CardTitle>
            </CardHeader>
            <CardContent>{renderChart()}</CardContent>
        </Card>
    );
}
