import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

type AgentStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

export const useInvoiceAgent = (invoiceId: string) => {
    const [status, setStatus] = useState<AgentStatus>('idle');
    const [result, setResult] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    // 1. Listen to Supabase Realtime for this specific Invoice
    useEffect(() => {
        if (!invoiceId) return;

        const channel = supabase
            .channel(`job-${invoiceId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'jobs',
                    filter: `invoice_id=eq.${invoiceId}`,
                },
                (payload: any) => {
                    const newJob = payload.new;
                    console.log('⚡ Realtime Update:', newJob);

                    setStatus(newJob.status);
                    if (newJob.result) setResult(newJob.result);
                    if (newJob.logs) setLogs(newJob.logs);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [invoiceId]);

    // 2. Function to Trigger the Agent
    const analyzeInvoice = async (amount: number) => {
        setStatus('pending');
        setLogs(['Transmission started...', 'Connecting to Agent Core...']);

        try {
            const res = await fetch('/api/brain/analyze-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: invoiceId, amount }),
            });

            if (!res.ok) throw new Error('Agent connection failed');

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Analysis failed');
            }

            // The Supabase subscription will handle the UI updates!
            console.log('✅ Agent triggered:', data);

        } catch (error) {
            console.error('❌ Agent Error:', error);
            setStatus('failed');
            setLogs((prev) => [...prev, '❌ Connection Lost.']);
        }
    };

    return { status, result, logs, analyzeInvoice };
};
