import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/analyze-invoice
 * 
 * Proxy endpoint to trigger Python Brain service for invoice analysis
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate request
        if (!body.invoice_id || typeof body.amount !== 'number') {
            return NextResponse.json(
                { error: 'Invalid request. Required: invoice_id (string), amount (number)' },
                { status: 400 }
            );
        }

        // Forward to Python service
        // Note: When using Docker, use "http://python_service:8000"
        // For local dev without Docker networking, use "http://127.0.0.1:8000"
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

        const response = await fetch(`${pythonServiceUrl}/analyze-invoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                invoice_id: body.invoice_id,
                amount: body.amount,
            }),
        });

        if (!response.ok) {
            throw new Error(`Brain service failed: ${response.statusText}`);
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            data,
        });

    } catch (error) {
        console.error('[Brain API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reach the Neural Core.'
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/brain/analyze-invoice
 * 
 * Health check for Python Brain service
 */
export async function GET() {
    try {
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
        const response = await fetch(`${pythonServiceUrl}/health`);

        if (!response.ok) {
            throw new Error('Python service is not healthy');
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            brain_status: data,
        });

    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: 'Python Brain service is unavailable'
            },
            { status: 503 }
        );
    }
}
