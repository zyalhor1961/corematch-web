'use client';

import { Button } from '@/app/components/ui/button';
import { X, Star, AlertTriangle, CheckCircle } from 'lucide-react';

interface AnalysisData {
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  summary: string;
}

interface AnalysisModalProps {
  candidateName: string;
  analysis: AnalysisData;
  onClose: () => void;
}

export default function AnalysisModal({ candidateName, analysis, onClose }: AnalysisModalProps) {
  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation.toLowerCase()) {
      case 'recommandé':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'à considérer':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'non recommandé':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Analyse IA - {candidateName}</h3>
            <p className="text-sm text-gray-500">Évaluation automatique du profil</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Score */}
          <div className="flex items-center justify-center mb-6">
            <div className="text-center">
              <div className={`text-4xl font-bold ${getScoreColor(analysis.score)}`}>
                {analysis.score}/100
              </div>
              <div className="text-sm text-gray-500 mt-1">Score d'adéquation</div>
            </div>
          </div>

          {/* Recommendation */}
          <div className={`p-4 rounded-lg border mb-6 ${getRecommendationColor(analysis.recommendation)}`}>
            <div className="flex items-center space-x-2">
              {analysis.recommendation.toLowerCase() === 'recommandé' && <CheckCircle className="w-5 h-5" />}
              {analysis.recommendation.toLowerCase() === 'à considérer' && <AlertTriangle className="w-5 h-5" />}
              {analysis.recommendation.toLowerCase() === 'non recommandé' && <X className="w-5 h-5" />}
              <div className="font-semibold">Recommandation: {analysis.recommendation}</div>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Résumé de l'évaluation</h4>
            <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Strengths */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Star className="w-5 h-5 text-green-600 mr-2" />
              Points forts
            </h4>
            <ul className="space-y-2">
              {analysis.strengths.map((strength, index) => (
                <li key={index} className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span className="text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
              Points d'amélioration
            </h4>
            <ul className="space-y-2">
              {analysis.weaknesses.map((weakness, index) => (
                <li key={index} className="flex items-start">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span className="text-gray-700">{weakness}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <Button onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}