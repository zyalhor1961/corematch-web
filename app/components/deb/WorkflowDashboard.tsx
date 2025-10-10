'use client';

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { Clock, CheckCircle, AlertTriangle, Users, TrendingUp, FileText, Zap, Package, Activity } from 'lucide-react';

export interface QueueItem {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'review' | 'completed' | 'error';
  assignee?: string;
  uploadedAt: Date;
  priority: 'high' | 'medium' | 'low';
  confidence?: number;
}

interface WorkflowDashboardProps {
  queue: QueueItem[];
  analytics: {
    totalProcessed: number;
    avgProcessingTime: number;
    accuracyRate: number;
    throughputToday: number;
  };
  onItemClick?: (item: QueueItem) => void;
  isDarkMode?: boolean;
}

const COLORS = {
  pending: '#94a3b8',
  processing: '#3b82f6',
  review: '#f59e0b',
  completed: '#10b981',
  error: '#ef4444',
};

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#94a3b8',
};

export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({
  queue,
  analytics,
  onItemClick,
  isDarkMode = false
}) => {
  // Status distribution
  const statusData = useMemo(() => {
    const statusCounts = queue.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: COLORS[status as keyof typeof COLORS],
    }));
  }, [queue]);

  // Priority distribution
  const priorityData = useMemo(() => [
    {
      name: 'High',
      count: queue.filter(q => q.priority === 'high').length,
      color: PRIORITY_COLORS.high
    },
    {
      name: 'Medium',
      count: queue.filter(q => q.priority === 'medium').length,
      color: PRIORITY_COLORS.medium
    },
    {
      name: 'Low',
      count: queue.filter(q => q.priority === 'low').length,
      color: PRIORITY_COLORS.low
    },
  ], [queue]);

  // Hourly throughput (mock data for demo)
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8);
    return hours.map(hour => ({
      hour: `${hour}:00`,
      processed: Math.floor(Math.random() * 20) + 5,
      pending: Math.floor(Math.random() * 15) + 2,
    }));
  }, []);

  return (
    <div className={`min-h-screen p-6 transition-all ${isDarkMode ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className={`text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${isDarkMode ? 'from-blue-400 via-purple-400 to-pink-400' : 'from-blue-600 via-purple-600 to-pink-600'}`}>
              Workflow Dashboard
            </h1>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Real-time document processing overview • Live analytics • Team performance
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          {
            label: 'Total Processed',
            value: analytics.totalProcessed.toLocaleString(),
            icon: CheckCircle,
            color: 'green',
            gradient: 'from-green-500 to-emerald-600',
            trend: '+12%'
          },
          {
            label: 'Avg Time',
            value: `${analytics.avgProcessingTime.toFixed(1)}m`,
            icon: Clock,
            color: 'blue',
            gradient: 'from-blue-500 to-cyan-600',
            trend: '-8%'
          },
          {
            label: 'Accuracy Rate',
            value: `${analytics.accuracyRate.toFixed(1)}%`,
            icon: TrendingUp,
            color: 'purple',
            gradient: 'from-purple-500 to-pink-600',
            trend: '+2%'
          },
          {
            label: 'Today\'s Throughput',
            value: analytics.throughputToday.toLocaleString(),
            icon: Zap,
            color: 'orange',
            gradient: 'from-orange-500 to-red-600',
            trend: '+25%'
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all border group ${
              isDarkMode ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
            } backdrop-blur-sm`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br from-${kpi.color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{kpi.label}</span>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${kpi.gradient} shadow-lg`}>
                  <kpi.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {kpi.value}
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold ${kpi.trend.startsWith('+') ? 'text-green-600' : 'text-blue-600'}`}>
                <TrendingUp className="w-3 h-3" />
                <span>{kpi.trend} vs yesterday</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Status Distribution Pie */}
        <div className={`rounded-2xl p-6 shadow-xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} backdrop-blur-sm`}>
          <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Status Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Breakdown Bar */}
        <div className={`rounded-2xl p-6 shadow-xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} backdrop-blur-sm`}>
          <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Priority Breakdown</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={priorityData}>
              <XAxis dataKey="name" stroke={isDarkMode ? '#94a3b8' : '#64748b'} />
              <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                {priorityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hourly Throughput Line Chart */}
      <div className={`rounded-2xl p-6 shadow-xl border mb-8 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} backdrop-blur-sm`}>
        <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Hourly Throughput</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
            <XAxis dataKey="hour" stroke={isDarkMode ? '#94a3b8' : '#64748b'} />
            <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="processed" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Processed" />
            <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name="Pending" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Queue Table */}
      <div className={`rounded-2xl shadow-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} backdrop-blur-sm`}>
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">Processing Queue</h3>
              <p className="text-sm text-blue-100 mt-1">{queue.length} documents in queue • Click to open</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <span className="text-2xl font-bold">{queue.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Document
                </th>
                <th className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Status
                </th>
                <th className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Priority
                </th>
                <th className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Confidence
                </th>
                <th className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Assignee
                </th>
                <th className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Uploaded
                </th>
                <th className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <FileText className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                    <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>No documents in queue</p>
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onItemClick?.(item)}
                    className={`transition-all cursor-pointer ${
                      isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className={`px-6 py-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <span className="font-medium">{item.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-lg ${
                          item.status === 'completed'
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                            : item.status === 'error'
                              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                              : item.status === 'review'
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                                : item.status === 'processing'
                                  ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white'
                                  : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white'
                        }`}
                      >
                        {item.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                        {item.status === 'error' && <AlertTriangle className="w-3 h-3" />}
                        {item.status === 'processing' && <Clock className="w-3 h-3 animate-spin" />}
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.priority === 'high'
                            ? 'bg-red-100 text-red-800'
                            : item.priority === 'medium'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {item.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.confidence !== undefined ? (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            item.confidence >= 0.95
                              ? 'bg-green-100 text-green-800'
                              : item.confidence >= 0.80
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {Math.round(item.confidence * 100)}%
                        </span>
                      ) : (
                        <span className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {item.assignee ? (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {item.assignee}
                        </div>
                      ) : (
                        'Unassigned'
                      )}
                    </td>
                    <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {item.uploadedAt.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick?.(item);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg text-xs font-medium transition-all shadow-lg hover:shadow-xl"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
