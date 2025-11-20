'use client';

/**
 * Admin: Graph Test Runner
 *
 * Execute graph workflows with real-time log streaming via Server-Sent Events
 */

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface LogEntry {
  type: 'log' | 'node' | 'status' | 'complete' | 'error';
  level?: 'info' | 'warn' | 'error' | 'debug';
  message?: string;
  data?: any;
  timestamp?: string;
  node?: string;
  status?: string;
  duration?: number;
  result?: any;
  report?: any;
  error?: string;
}

export default function AdminGraphTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const graphId = resolvedParams.id;

  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Test input
  const [cvText, setCvText] = useState('');
  const [jobSpec, setJobSpec] = useState('{}');
  const [executionMode, setExecutionMode] = useState('balanced');

  useEffect(() => {
    fetchGraph();
  }, [graphId]);

  useEffect(() => {
    // Auto-scroll logs to bottom
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchGraph = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/graphs/${graphId}`);
      const data = await response.json();

      if (response.ok) {
        setGraph(data.graph);
      }
    } catch (err) {
      console.error('Error fetching graph:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!cvText || !jobSpec) {
      alert('Please provide CV text and job specification');
      return;
    }

    let parsedJobSpec;
    try {
      parsedJobSpec = JSON.parse(jobSpec);
    } catch (err) {
      alert('Invalid JSON in job specification');
      return;
    }

    setRunning(true);
    setLogs([]);
    setResult(null);
    setReport(null);

    try {
      const response = await fetch(`/api/admin/graphs/${graphId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            cvText,
            jobSpec: parsedJobSpec,
            projectId: 'test-project',
            candidateId: 'test-candidate',
          },
          execution_mode: executionMode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Execution failed');
      }

      // Read Server-Sent Events stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));

            setLogs((prev) => [...prev, data]);

            if (data.type === 'complete') {
              setResult(data.result);
              setReport(data.report);
              setRunning(false);
            } else if (data.type === 'error') {
              setRunning(false);
            }
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          type: 'error',
          level: 'error',
          message: `Execution error: ${err.message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
      setRunning(false);
    }
  };

  const handleLoadSample = () => {
    setCvText(`JOHN DOE
Senior Full-Stack Developer

EXPERIENCE:
- Tech Corp (2020-2024): Led development of React applications for 4 years
- Startup Inc (2018-2020): Built Node.js microservices

SKILLS:
- Languages: JavaScript, TypeScript, Python
- Frameworks: React, Next.js, Node.js, Express
- Databases: PostgreSQL, MongoDB
- Cloud: AWS, Azure`);

    setJobSpec(JSON.stringify({
      title: 'Senior Full-Stack Developer',
      skills_required: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
      nice_to_have: ['Next.js', 'AWS'],
      experience_required: 'At least 3 years of experience with React and Node.js',
    }, null, 2));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/admin/graphs/${graphId}`} className="text-blue-600 hover:underline mb-2 block">
          ← Back to Graph
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Test Runner: {graph?.name}</h1>
        <p className="text-gray-600 mt-2">Execute graph with test data and monitor in real-time</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Test Input</h2>
              <button
                onClick={handleLoadSample}
                className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
              >
                Load Sample Data
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CV Text
                </label>
                <textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  rows={10}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm text-gray-900 bg-white"
                  placeholder="Paste CV text here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Specification (JSON)
                </label>
                <textarea
                  value={jobSpec}
                  onChange={(e) => setJobSpec(e.target.value)}
                  rows={8}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm text-gray-900 bg-white"
                  placeholder='{"title": "Developer", "skills_required": [...], ...}'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Execution Mode
                </label>
                <select
                  value={executionMode}
                  onChange={(e) => setExecutionMode(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                >
                  <option value="balanced">Balanced (Quality + Cost)</option>
                  <option value="cost_optimized">Cost Optimized (Cheapest)</option>
                  <option value="quality_optimized">Quality Optimized (Best)</option>
                  <option value="premium">Premium (All Providers)</option>
                </select>
              </div>

              <button
                onClick={handleExecute}
                disabled={running || !cvText || !jobSpec}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 font-medium"
              >
                {running ? '⏳ Executing...' : '▶ Execute Graph'}
              </button>
            </div>
          </div>

          {/* Result Summary */}
          {result && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Result</h2>

              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-600">Recommendation:</span>
                  <p className="text-lg font-bold text-green-600">
                    {result.final_decision?.recommendation}
                  </p>
                </div>

                <div>
                  <span className="text-sm text-gray-600">Score:</span>
                  <p className="text-lg font-bold">
                    {result.final_decision?.overall_score_0_to_100}/100
                  </p>
                </div>

                {report && (
                  <>
                    <div className="pt-4 border-t">
                      <span className="text-sm text-gray-600">Cost:</span>
                      <p className="font-medium">
                        ${report.cost_metrics.total_cost_usd.toFixed(4)}
                      </p>
                    </div>

                    <div>
                      <span className="text-sm text-gray-600">Quality:</span>
                      <p className="font-medium">
                        {report.quality_assessment.quality_level} (
                        {(report.quality_assessment.confidence_score.overall * 100).toFixed(1)}%
                        confidence)
                      </p>
                    </div>

                    <div>
                      <span className="text-sm text-gray-600">Duration:</span>
                      <p className="font-medium">
                        {report.performance_metrics.total_duration_ms}ms
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Logs Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Execution Logs</h2>

          <div className="bg-gray-900 text-gray-100 rounded-md p-4 h-[600px] overflow-y-auto font-mono text-xs">
            {logs.length === 0 && (
              <div className="text-gray-500">Waiting for execution...</div>
            )}

            {logs.map((log, index) => (
              <div
                key={index}
                className={`mb-1 ${
                  log.level === 'error'
                    ? 'text-red-400'
                    : log.level === 'warn'
                    ? 'text-yellow-400'
                    : log.level === 'info'
                    ? 'text-green-400'
                    : 'text-gray-400'
                }`}
              >
                {log.type === 'log' && (
                  <span>
                    [{new Date(log.timestamp!).toLocaleTimeString()}] [{log.level?.toUpperCase()}]{' '}
                    {log.message}
                    {log.data && <span className="text-gray-500"> {JSON.stringify(log.data)}</span>}
                  </span>
                )}

                {log.type === 'status' && (
                  <span className="text-blue-400">
                    [STATUS] {log.status}
                  </span>
                )}

                {log.type === 'complete' && (
                  <span className="text-green-400 font-bold">
                    ✅ EXECUTION COMPLETED
                  </span>
                )}

                {log.type === 'error' && (
                  <span className="text-red-400 font-bold">
                    ❌ ERROR: {log.error || log.message}
                  </span>
                )}
              </div>
            ))}

            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
