/**
 * Admin API: Graph Execution with Real-Time Streaming
 *
 * POST /api/admin/graphs/[id]/execute - Execute graph with SSE log streaming
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';
import { createMonitoringManager } from '@/lib/graph/monitoring';
import type { GraphState } from '@/lib/graph/types';

/**
 * POST /api/admin/graphs/[id]/execute
 * Execute workflow graph with real-time Server-Sent Events streaming
 *
 * Request body:
 * {
 *   input: { cvText: string, jobSpec: JobSpec, projectId?: string, candidateId?: string },
 *   execution_mode: 'balanced' | 'cost_optimized' | 'quality_optimized' | 'premium'
 * }
 *
 * Response: Server-Sent Events stream
 * - data: {"type":"log","level":"info","message":"..."}
 * - data: {"type":"node","node":"extract","status":"running"}
 * - data: {"type":"node","node":"extract","status":"completed","duration":1500}
 * - data: {"type":"complete","result":{...},"report":{...}}
 * - data: {"type":"error","error":"..."}
 */
export const POST = withAuth(async (request, session, context) => {
  try {
    const params = await context.params;
    const graphId = params.id;
    const body = await request.json();
    const { input, execution_mode = 'balanced' } = body;

    if (!input) {
      return NextResponse.json(
        { error: 'Missing required field: input' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseAdmin();

    // Fetch graph details
    const { data: graph, error: graphError } = await supabase
      .from('graphs')
      .select('*')
      .eq('id', graphId)
      .single();

    if (graphError || !graph) {
      return NextResponse.json(
        { error: 'Graph not found' },
        { status: 404 }
      );
    }

    // Fetch nodes and edges
    const { data: nodes } = await supabase
      .from('graph_nodes')
      .select('*')
      .eq('graph_id', graphId);

    const { data: edges } = await supabase
      .from('graph_edges')
      .select('*')
      .eq('graph_id', graphId);

    const { data: activeConfig } = await supabase
      .from('graph_configs')
      .select('*')
      .eq('graph_id', graphId)
      .eq('is_active', true)
      .single();

    // Create snapshots
    const configSnapshot = activeConfig?.config_json || {};
    const nodesSnapshot = nodes || [];
    const edgesSnapshot = edges || [];

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from('graph_executions')
      .insert({
        graph_id: graphId,
        config_id: activeConfig?.id || null,
        execution_mode,
        triggered_by: 'admin_test',
        triggered_by_user_id: session.user.id,
        input_data: input,
        config_snapshot: configSnapshot,
        nodes_snapshot: nodesSnapshot,
        edges_snapshot: edgesSnapshot,
        status: 'running',
      })
      .select()
      .single();

    if (execError || !execution) {
      console.error('[execute] Error creating execution record:', execError);
      return NextResponse.json(
        { error: 'Failed to create execution record', details: execError?.message },
        { status: 500 }
      );
    }

    const executionId = execution.id;

    // Create Server-Sent Events stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Helper to send SSE messages
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Logger that streams to client
        const logger = {
          info: (message: string, data?: any) => {
            console.log(`[execute:${executionId}] INFO:`, message, data || '');
            send({ type: 'log', level: 'info', message, data, timestamp: new Date().toISOString() });
          },
          warn: (message: string, data?: any) => {
            console.warn(`[execute:${executionId}] WARN:`, message, data || '');
            send({ type: 'log', level: 'warn', message, data, timestamp: new Date().toISOString() });
          },
          error: (message: string, data?: any) => {
            console.error(`[execute:${executionId}] ERROR:`, message, data || '');
            send({ type: 'log', level: 'error', message, data, timestamp: new Date().toISOString() });
          },
          debug: (message: string, data?: any) => {
            console.debug(`[execute:${executionId}] DEBUG:`, message, data || '');
            send({ type: 'log', level: 'debug', message, data, timestamp: new Date().toISOString() });
          },
        };

        try {
          logger.info(`Starting execution for graph: ${graph.name}`);
          logger.info(`Execution ID: ${executionId}`);
          logger.info(`Execution mode: ${execution_mode}`);

          // Create monitoring manager
          const monitor = createMonitoringManager({
            cost_optimization: {
              enabled: true,
              budget: configSnapshot.monitoring?.cost_optimization?.budget || {
                max_cost_usd: 0.10,
                warn_threshold_pct: 0.80,
                mode: 'flexible',
              },
              strategy: configSnapshot.monitoring?.cost_optimization?.strategy || {
                mode: execution_mode === 'cost_optimized' ? 'cost_optimized' : 'balanced',
                fallback_enabled: true,
              },
            },
            quality_assurance: {
              enabled: true,
              min_confidence: 0.65,
              strict_validation: false,
              auto_flag_low_quality: true,
            },
            performance: {
              enabled: true,
              max_duration_ms: 60000,
              alert_on_slow_node_ms: 10000,
            },
          });

          // Execute graph (use existing CV analysis for now)
          // TODO: Replace with generic graph executor once built
          send({ type: 'status', status: 'executing_graph' });

          logger.info('Loading graph executor...');

          // For now, use existing analyzeCVWithGraph (Phase 1 MVP)
          const { analyzeCVWithGraph } = await import('@/lib/cv-analysis');

          logger.info('Executing CV analysis graph...');

          const result = await analyzeCVWithGraph(
            input.cvText,
            input.jobSpec,
            {
              mode: execution_mode as any,
              projectId: input.projectId,
              candidateId: input.candidateId,
            }
          );

          logger.info('Graph execution completed');

          // Generate monitoring report
          logger.info('Generating monitoring report...');

          const report = monitor.generateReport(
            executionId,
            result.final_decision,
            result.providers_raw,
            result.consensus
          );

          logger.info(`Cost: $${report.cost_metrics.total_cost_usd.toFixed(4)}`);
          logger.info(`Quality: ${report.quality_assessment.quality_level} (${(report.quality_assessment.confidence_score.overall * 100).toFixed(1)}% confidence)`);

          // Update execution record
          await supabase
            .from('graph_executions')
            .update({
              status: 'completed',
              result_data: result,
              cost_usd: report.cost_metrics.total_cost_usd,
              quality_score: report.quality_assessment.confidence_score.overall,
              execution_time_ms: report.performance_metrics.total_duration_ms,
              nodes_executed: Object.keys(report.performance_metrics.node_durations).length,
              monitoring_report: report,
              completed_at: new Date().toISOString(),
            })
            .eq('id', executionId);

          logger.info('Execution record updated');

          // Send completion event
          send({
            type: 'complete',
            execution_id: executionId,
            result,
            report,
          });

          controller.close();
        } catch (error: any) {
          logger.error('Execution failed', { error: error.message, stack: error.stack });

          // Update execution record
          await supabase
            .from('graph_executions')
            .update({
              status: 'failed',
              error_message: error.message,
              error_details: { stack: error.stack },
              completed_at: new Date().toISOString(),
            })
            .eq('id', executionId);

          send({
            type: 'error',
            error: error.message,
            details: error.stack,
          });

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[execute] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});
