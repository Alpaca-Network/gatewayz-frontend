import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { generateChartData } from '@/lib/data';

export default function ActivityTab({ modelName }: { modelName: string }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Recent Activity Of {modelName}</h2>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Total usage per day on Gatewayz</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={generateChartData([], 'throughput').slice(0,90)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(label) => format(new Date(label), 'MMM d')}
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                                    tick={{ fontSize: 12 }}
                                />
                                <Tooltip
                                    formatter={(value: any) => [`${(value / 1000000).toFixed(2)}M`, "Usage"]}
                                    labelFormatter={(label) => format(new Date(label), "PPP")}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                    }}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    name="Prompt Tokens"
                                    stroke="#3b82f6"
                                    fill="#3b82f6"
                                    fillOpacity={0.6}
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value2"
                                    name="Completion Tokens"
                                    stroke="#9ca3af"
                                    fill="#9ca3af"
                                    fillOpacity={0.3}
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}