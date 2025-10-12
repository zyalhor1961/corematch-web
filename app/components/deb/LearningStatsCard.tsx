'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, Database, CheckCircle, Brain } from 'lucide-react';

interface LearningStats {
  totalArticles: number;
  userValidatedCount: number;
  aiSuggestedCount: number;
  avgConfidence: number;
  totalValidations: number;
}

interface LearningStatsCardProps {
  orgId: string;
}

export function LearningStatsCard({ orgId }: LearningStatsCardProps) {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(`/api/deb/reference/stats?orgId=${orgId}`);
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [orgId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const hitRate = stats.totalArticles > 0
    ? ((stats.userValidatedCount / stats.totalArticles) * 100).toFixed(0)
    : '0';

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Auto-Learning Statistics
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Reference database performance metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
        {/* Total Articles */}
        <StatItem
          icon={Database}
          label="Total Articles"
          value={stats.totalArticles.toString()}
          color="text-blue-600"
        />

        {/* User Validated */}
        <StatItem
          icon={CheckCircle}
          label="User Validated"
          value={stats.userValidatedCount.toString()}
          color="text-green-600"
        />

        {/* AI Suggested */}
        <StatItem
          icon={Brain}
          label="AI Suggested"
          value={stats.aiSuggestedCount.toString()}
          color="text-purple-600"
        />

        {/* Avg Confidence */}
        <StatItem
          icon={TrendingUp}
          label="Avg Confidence"
          value={`${(stats.avgConfidence * 100).toFixed(0)}%`}
          color="text-orange-600"
        />
      </div>

      {/* Hit Rate Indicator */}
      <div className="px-6 pb-6">
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Reference DB Hit Rate
            </span>
            <span className="text-2xl font-bold text-green-600">
              {hitRate}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
              style={{ width: `${hitRate}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {stats.totalValidations} total validations recorded
          </p>
        </div>
      </div>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
  color
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}
