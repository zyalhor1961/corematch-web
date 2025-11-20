'use client';

/**
 * Admin: Graph Editor
 *
 * Edit graph metadata, nodes, edges, and configuration
 * Phase 1: JSON editor (simple and functional)
 * Future: React Flow visual editor
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface GraphData {
  graph: any;
  nodes: any[];
  edges: any[];
  active_config: any;
  recent_executions: any[];
}

export default function AdminGraphEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const graphId = resolvedParams.id;
  const router = useRouter();

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    fetchGraph();
  }, [graphId]);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/graphs/${graphId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch graph');
      }

      setData(result);
      setName(result.graph.name);
      setDescription(result.graph.description || '');
      setStatus(result.graph.status);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/graphs/${graphId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          status,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update graph');
      }

      alert('Graph updated successfully!');
      fetchGraph();
    } catch (err: any) {
      alert(`Error updating graph: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading graph...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error || 'Graph not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/admin/graphs" className="text-blue-600 hover:underline mb-2 block">
            ← Back to Graphs
          </Link>
          <h1 className="text-3xl font-bold">{data.graph.name}</h1>
          <p className="text-gray-600 mt-2">Graph ID: {graphId}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/graphs/${graphId}/test`}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            ▶ Test Graph
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-4">
          <button className="px-4 py-2 border-b-2 border-blue-600 font-medium">
            Overview
          </button>
          <button className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Nodes ({data.nodes.length})
          </button>
          <button className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Edges ({data.edges.length})
          </button>
          <button className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Configuration
          </button>
          <button className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Executions ({data.recent_executions.length})
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      <div className="grid gap-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <span className="text-sm text-gray-600">Type:</span>
                <p className="font-medium">{data.graph.graph_type}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Default:</span>
                <p className="font-medium">{data.graph.is_default ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Created:</span>
                <p className="font-medium text-sm">
                  {new Date(data.graph.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Nodes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Nodes ({data.nodes.length})</h2>

          <div className="space-y-2">
            {data.nodes.map((node) => (
              <div
                key={node.id}
                className="border border-gray-200 rounded p-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">{node.node_name}</div>
                  <div className="text-sm text-gray-600">
                    Key: {node.node_key} • Type: {node.node_type} • Handler: {node.handler_function}
                  </div>
                </div>
                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                  {node.node_type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Edges */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Edges ({data.edges.length})</h2>

          <div className="space-y-2">
            {data.edges.map((edge) => (
              <div
                key={edge.id}
                className="border border-gray-200 rounded p-3 flex justify-between items-center"
              >
                <div className="text-sm">
                  {edge.label || `${edge.source_node_id} → ${edge.target_node_id}`}
                </div>
                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                  {edge.condition_type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Config */}
        {data.active_config && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              Active Configuration (v{data.active_config.version_number})
            </h2>

            <pre className="bg-gray-50 rounded p-4 overflow-x-auto text-sm">
              {JSON.stringify(data.active_config.config_json, null, 2)}
            </pre>
          </div>
        )}

        {/* Recent Executions */}
        {data.recent_executions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              Recent Executions ({data.recent_executions.length})
            </h2>

            <div className="space-y-2">
              {data.recent_executions.map((exec) => (
                <div
                  key={exec.id}
                  className="border border-gray-200 rounded p-3 flex justify-between items-center"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {new Date(exec.started_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600">
                      Mode: {exec.execution_mode} • Cost: ${exec.cost_usd?.toFixed(4) || 'N/A'} •
                      Quality: {exec.quality_score ? (exec.quality_score * 100).toFixed(1) + '%' : 'N/A'}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      exec.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : exec.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {exec.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
