import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/brain/crm/searches/[orgId]
 *
 * Fetch all lead searches for an organization.
 * Falls back to direct Supabase if Python service unavailable.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;

        // Try Python service first if configured
        if (pythonServiceUrl) {
            try {
                const response = await fetch(`${pythonServiceUrl}/crm/searches/${orgId}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (response.ok) {
                    const data = await response.json();
                    return NextResponse.json(data);
                }
            } catch (pythonError) {
                console.warn('[Searches API] Python service unavailable, using Supabase fallback');
            }
        }

        // Fallback: Direct Supabase query
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data, error } = await supabase
            .from('lead_searches')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Searches API] Supabase error:', error);
            // Return empty array if table doesn't exist yet
            if (error.code === '42P01') {
                return NextResponse.json([]);
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);

    } catch (error) {
        console.error('[Searches API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
