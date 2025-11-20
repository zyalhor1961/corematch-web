'use client';

/**
 * Admin: Graph Workflows List
 *
 * Displays all workflow graphs with filtering and quick actions
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Graph {
  id: string;
  name: string;
  description: string | null;
  graph_type: string;
  status: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  graph_nodes: { count: number }[];
  graph_edges: { count: number }[];
  graph_configs: { count: number }[];
  graph_executions: { count: number }[];
}

export default function AdminGraphsPage() {
  const router = useRouter();
  const [graphs, setGraphs] = useState<Graph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    type: '',
    status: '',
  });

  useEffect(() => {
    fetchGraphs();
  }, [filter]);

  const fetchGraphs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filter.type) params.append('type', filter.type);
      if (filter.status) params.append('status', filter.status);

      const response = await fetch(`/api/admin/graphs?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch graphs');
      }

      setGraphs(data.graphs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (graph: Graph) => {
    if (!confirm(`Are you sure you want to delete "${graph.name}"? This will also delete all nodes, edges, and executions.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/graphs/${graph.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete graph');
      }

      // Refresh list
      fetchGraphs();
    } catch (err: any) {
      alert(`Error deleting graph: ${err.message}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Workflow Graphs</h1>
          <p className="text-gray-600 mt-2">
            Manage graph orchestration workflows
          </p>
        </div>
        <Link
          href="/admin/graphs/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Create Graph
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Types</option>
              <option value="cv_analysis">CV Analysis</option>
              <option value="document_processing">Document Processing</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilter({ type: '', status: '' })}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading graphs...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {/* Graphs List */}
      {!loading && !error && graphs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">No graphs found. Create your first workflow!</p>
        </div>
      )}

      {!loading && !error && graphs.length > 0 && (
        <div className="grid gap-4">
          {graphs.map((graph) => (
            <div
              key={graph.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold">{graph.name}</h2>
                    {graph.is_default && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        DEFAULT
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        graph.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : graph.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {graph.status.toUpperCase()}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                      {graph.graph_type}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-4">
                    {graph.description || 'No description'}
                  </p>

                  <div className="flex gap-6 text-sm text-gray-500">
                    <span>
                      📍 {graph.graph_nodes[0]?.count || 0} nodes
                    </span>
                    <span>
                      🔗 {graph.graph_edges[0]?.count || 0} edges
                    </span>
                    <span>
                      ⚙️ {graph.graph_configs[0]?.count || 0} configs
                    </span>
                    <span>
                      🚀 {graph.graph_executions[0]?.count || 0} executions
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/admin/graphs/${graph.id}/test`}
                    className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ▶ Test
                  </Link>
                  <Link
                    href={`/admin/graphs/${graph.id}`}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(graph)}
                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                Created: {new Date(graph.created_at).toLocaleString()} • Updated:{' '}
                {new Date(graph.updated_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
