'use client';

import React from 'react';
import {
    Area,
    AreaChart,
    ResponsiveContainer,
} from 'recharts';

interface DashboardChartsProps {
    revenueData: any[];
    cashFlowData: any[];
}

export default function DashboardCharts({ revenueData, cashFlowData }: DashboardChartsProps) {
    return (
        <>
            <div className="h-16 w-full opacity-50">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenue)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            {/* We can export multiple components or just one. For now, let's keep it simple. 
          Actually, the dashboard uses two different charts in different cards. 
          I should probably export them separately or just handle the dynamic import in the page.
      */}
        </>
    );
}

export function RevenueChart({ data }: { data: any[] }) {
    return (
        <div className="h-16 w-full opacity-50">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenue)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function CashFlowChart({ data }: { data: any[] }) {
    return (
        <div className="h-16 w-full opacity-50">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#colorCash)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
