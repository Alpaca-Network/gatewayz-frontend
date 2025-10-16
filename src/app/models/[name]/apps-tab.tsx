import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AppsTab({ modelName }: { modelName: string }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Top Apps Using {modelName}</h2>
                <div className="flex items-center gap-4">
                    <select className="border rounded px-3 py-2 text-sm">
                        <option>Top This Year</option>
                        <option>Top This Month</option>
                        <option>Top This Week</option>
                    </select>
                    <select className="border rounded px-3 py-2 text-sm">
                        <option>Sort By: All</option>
                        <option>Sort By: Tokens</option>
                        <option>Sort By: Growth</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1,2,3,4,5,6,7,8].map((i) => (
                    <Card key={i} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border">
                                        <img src="/Google_Logo-black.svg" alt="Google" className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">Google</h3>
                                        <span className="text-xs text-muted-foreground">#{i}</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                Autonomous Coding Agent That Is...
                            </p>
                            <div className="space-y-2">
                                <div>
                                    <span className="text-2xl font-bold">21.7B</span>
                                    <p className="text-xs text-muted-foreground">Tokens Generated</p>
                                </div>
                                <div className="text-green-600 font-semibold text-sm">
                                    +13.06%
                                    <span className="text-xs text-muted-foreground ml-1">Weekly Growth</span>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="w-full mt-4">
                                View App →
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="text-center mt-8">
                <Button variant="outline">Load More</Button>
            </div>
        </div>
    );
}