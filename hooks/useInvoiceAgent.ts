import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

type AgentStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

export const useInvoiceAgent = (invoiceId: string) => {
    const [status, setStatus] = useState<AgentStatus>('idle');
    const [result, setResult] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [steps, setSteps] = useState<any[]>([]);
    const [jobId, setJobId] = useState<string | null>(null);

    // Track if analysis is in progress to prevent duplicate calls
    const isAnalyzingRef = useRef(false);

    // 1. Listen to Supabase Realtime for this specific Invoice
    useEffect(() => {
        if (!invoiceId) return;

        // Fetch existing job status on mount
        const fetchExistingJob = async () => {
            const { data } = await supabase
                .table('jobs')
                .select('*')
                .eq('invoice_id', invoiceId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                setStatus(data.status);
                if (data.result) setResult(data.result);
                if (data.steps) setSteps(data.steps);
                if (data.id) setJobId(data.id);
            }
        };

        fetchExistingJob();

        const channel = supabase
            .channel(`job-${invoiceId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT and UPDATE
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
                    if (newJob.steps) setSteps(newJob.steps);
                    if (newJob.id) setJobId(newJob.id);

                    // Reset analyzing flag when completed or failed
                    if (newJob.status === 'completed' || newJob.status === 'failed') {
                        isAnalyzingRef.current = false;
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [invoiceId]);

    // 2. Function to Trigger the Agent (with duplicate prevention)
    const analyzeInvoice = useCallback(async (amount: number) => {
        // Prevent duplicate calls
        if (isAnalyzingRef.current) {
            console.log('⚠️ Analysis already in progress, skipping...');
            return;
        }

        // Prevent re-analysis if already processing
        if (status === 'pending' || status === 'processing') {
            console.log('⚠️ Analysis already in progress (status), skipping...');
            return;
        }

        isAnalyzingRef.current = true;
        setStatus('pending');
        setLogs(['Transmission started...', 'Connecting to Agent Core...']);
        setSteps([]);

        try {
            const res = await fetch('/api/brain/analyze-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: invoiceId, amount }),
            });

            if (!res.ok) throw new Error('Agent connection failed');

            const data = await res.json();

            // Check if the job was skipped (already in progress)
            if (data.skipped) {
                console.log('⚠️ Job skipped - already in progress on server');
                return;
            }

            if (!data.success && data.error) {
                throw new Error(data.error);
            }

            // The Supabase subscription will handle the UI updates!
            console.log('✅ Agent triggered:', data);

        } catch (error) {
            console.error('❌ Agent Error:', error);
            setStatus('failed');
            setLogs((prev) => [...prev, '❌ Connection Lost.']);
            isAnalyzingRef.current = false;
        }
    }, [invoiceId, status]);

    return { status, result, logs, steps, jobId, analyzeInvoice };
};
