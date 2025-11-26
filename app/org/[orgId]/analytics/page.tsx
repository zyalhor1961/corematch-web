'use client';

import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/ui/PageContainer';
import { SmartTable } from '@/components/BI/SmartTable';
import { supabase } from '@/lib/supabase/client';

// Mock data for immediate demonstration if DB is empty
const MOCK_DATA = [
    { invoice_id: 'INV-001', vendor_name: 'Amazon AWS', invoice_date: '2025-10-01', total_amount: 120.50, status: 'APPROVED' },
    { invoice_id: 'INV-002', vendor_name: 'Google Workspace', invoice_date: '2025-10-05', total_amount: 45.00, status: 'APPROVED' },
    { invoice_id: 'INV-003', vendor_name: 'Uber Ads', invoice_date: '2025-10-12', total_amount: 350.20, status: 'NEEDS_APPROVAL' },
    { invoice_id: 'INV-004', vendor_name: 'Station F', invoice_date: '2025-10-15', total_amount: 850.00, status: 'APPROVED' },
    { invoice_id: 'INV-005', vendor_name: 'Alan', invoice_date: '2025-10-20', total_amount: 1200.00, status: 'APPROVED' },
    { invoice_id: 'INV-006', vendor_name: 'Swile', invoice_date: '2025-10-25', total_amount: 230.00, status: 'APPROVED' },
    { invoice_id: 'INV-007', vendor_name: 'Apple Store', invoice_date: '2025-10-28', total_amount: 1499.00, status: 'NEEDS_APPROVAL' },
];

export default function AnalyticsPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            // Try to fetch real data
            const { data: invoices, error } = await supabase
                .from('invoices')
                .select('id, vendor_name, invoice_date, total_amount, status')
                .order('invoice_date', { ascending: false })
                .limit(50);

            if (error || !invoices || invoices.length === 0) {
                console.log("Using Mock Data for Analytics");
                setData(MOCK_DATA);
            } else {
                // Flatten/Format data for table
                const formatted = invoices.map(inv => ({
                    invoice_id: inv.id.slice(0, 8), // Shorten ID
                    vendor_name: inv.vendor_name || 'Unknown',
                    invoice_date: inv.invoice_date,
                    total_amount: inv.total_amount,
                    status: inv.status
                }));
                setData(formatted);
            }
            setLoading(false);
        };

        fetchData();
    }, []);

    return (
        <PageContainer title="Analytics & BI">
            <div className="space-y-8">
                {/* Intro */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
                        <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Total Spend</div>
                        <div className="text-2xl text-white font-mono">
                            {data.reduce((acc, curr) => acc + (curr.total_amount || 0), 0).toFixed(2)} €
                        </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
                        <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Invoices</div>
                        <div className="text-2xl text-white font-mono">{data.length}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
                        <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Vendors</div>
                        <div className="text-2xl text-white font-mono">
                            {new Set(data.map(d => d.vendor_name)).size}
                        </div>
                    </div>
                </div>

                {/* Smart Table */}
                <div>
                    <SmartTable
                        title="Detailed Spend Report"
                        data={data}
                        columns={['vendor_name', 'invoice_date', 'total_amount', 'status', 'invoice_id']}
                    />
                </div>
            </div>
        </PageContainer>
    );
}
