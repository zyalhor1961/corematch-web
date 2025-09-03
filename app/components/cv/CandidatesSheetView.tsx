'use client';

import { useState, useMemo } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  Filter, 
  Download, 
  FileSpreadsheet,
  X,
  Search,
  Eye
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import * as XLSX from 'xlsx';

interface Candidate {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  score?: number;
  recommendation?: string;
  summary?: string;
  shortlisted: boolean;
}

interface CandidatesSheetViewProps {
  candidates: Candidate[];
  projectName: string;
  onViewCandidate?: (candidate: Candidate) => void;
  onClose: () => void;
}

export default function CandidatesSheetView({ 
  candidates, 
  projectName,
  onViewCandidate,
  onClose 
}: CandidatesSheetViewProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Process candidates to extract analysis data
  const processedCandidates = useMemo(() => {
    return candidates.map(candidate => {
      const notes = candidate.notes || '';
      const scoreMatch = notes.match(/Score: (\d+)\/100/);
      const recommendationMatch = notes.match(/Recommandation: ([^\n]+)/);
      const summaryMatch = notes.match(/Résumé: ([^\n]+)/);
      const shortlistMatch = notes.match(/Statut: (SÉLECTIONNÉ|NON RETENU)/);
      
      return {
        ...candidate,
        score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
        recommendation: recommendationMatch?.[1] || '-',
        summary: summaryMatch?.[1] || '-',
        shortlisted: shortlistMatch?.[1] === 'SÉLECTIONNÉ',
        displayName: candidate.first_name || 'Candidat',
        uploadDate: new Date(candidate.created_at).toLocaleDateString('fr-FR'),
        analysisStatus: candidate.status === 'analyzed' ? 'Analysé' : 
                       candidate.status === 'processing' ? 'En cours' : 'En attente'
      };
    });
  }, [candidates]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = processedCandidates;

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(candidate => 
        Object.values(candidate).some(value => 
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter(candidate => {
          const candidateValue = (candidate as any)[key];
          return candidateValue?.toString().toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = (a as any)[sortColumn];
        const bVal = (b as any)[sortColumn];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = aVal.toString().toLowerCase();
        const bStr = bVal.toString().toLowerCase();
        
        if (sortDirection === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        } else {
          return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
        }
      });
    }

    return filtered;
  }, [processedCandidates, filters, sortColumn, sortDirection, searchTerm]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }));
  };

  const exportToExcel = (onlyFiltered: boolean = false) => {
    const dataToExport = onlyFiltered ? filteredAndSortedData : processedCandidates;
    
    const exportData = dataToExport.map(candidate => ({
      'Nom': candidate.displayName,
      'Email': candidate.email || '',
      'Téléphone': candidate.phone || '',
      'Date Upload': candidate.uploadDate,
      'Statut': candidate.analysisStatus,
      'Score': candidate.score,
      'Recommandation': candidate.recommendation,
      'Résumé': candidate.summary,
      'Shortlist': candidate.shortlisted ? 'OUI' : 'NON'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidats');
    
    // Auto-size columns
    const maxWidth = 50;
    const cols = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.min(maxWidth, Math.max(key.length, ...exportData.map(row => 
        (row[key as keyof typeof row] || '').toString().length
      )))
    }));
    worksheet['!cols'] = cols;

    XLSX.writeFile(workbook, `${projectName}-${onlyFiltered ? 'filtered' : 'all'}-${Date.now()}.xlsx`);
  };

  const exportToCSV = (onlyFiltered: boolean = false) => {
    const dataToExport = onlyFiltered ? filteredAndSortedData : processedCandidates;
    
    const headers = ['Nom', 'Email', 'Téléphone', 'Date Upload', 'Statut', 'Score', 'Recommandation', 'Résumé', 'Shortlist'];
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(candidate => [
        candidate.displayName,
        candidate.email || '',
        candidate.phone || '',
        candidate.uploadDate,
        candidate.analysisStatus,
        candidate.score,
        candidate.recommendation,
        candidate.summary,
        candidate.shortlisted ? 'OUI' : 'NON'
      ].map(value => {
        const strValue = value.toString();
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}-${onlyFiltered ? 'filtered' : 'all'}-${Date.now()}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const columns = [
    { key: 'displayName', label: 'Nom', width: 'w-40' },
    { key: 'email', label: 'Email', width: 'w-48' },
    { key: 'phone', label: 'Tél', width: 'w-32' },
    { key: 'uploadDate', label: 'Date', width: 'w-28' },
    { key: 'analysisStatus', label: 'Statut', width: 'w-28' },
    { key: 'score', label: 'Score', width: 'w-20' },
    { key: 'recommendation', label: 'Recommandation', width: 'w-32' },
    { key: 'shortlisted', label: 'Shortlist', width: 'w-24' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900">Vue tableur - {projectName}</h2>
            <span className="text-sm text-gray-500">
              {filteredAndSortedData.length} / {processedCandidates.length} candidats
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Toggle Filters */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-blue-50' : ''}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Export filtered */}
            {filteredAndSortedData.length < processedCandidates.length && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(true)}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export filtré CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToExcel(true)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export filtré Excel
                </Button>
              </>
            )}

            {/* Export all */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(false)}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export tout CSV
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => exportToExcel(false)}
            >
              <Download className="w-4 h-4 mr-2" />
              Export tout Excel
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                {columns.map(column => (
                  <th
                    key={column.key}
                    className={`px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-r ${column.width}`}
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer hover:bg-gray-200 -mx-4 px-4 py-2"
                      onClick={() => handleSort(column.key)}
                    >
                      <span>{column.label}</span>
                      <div className="flex flex-col">
                        <ChevronUp 
                          className={`w-3 h-3 ${sortColumn === column.key && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                        />
                        <ChevronDown 
                          className={`w-3 h-3 -mt-1 ${sortColumn === column.key && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                        />
                      </div>
                    </div>
                    {showFilters && (
                      <input
                        type="text"
                        placeholder="Filtrer..."
                        value={filters[column.key] || ''}
                        onChange={(e) => handleFilterChange(column.key, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </th>
                ))}
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredAndSortedData.map((candidate, index) => (
                <tr 
                  key={candidate.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                >
                  <td className="px-4 py-2 text-sm text-gray-900 border-r border-b">{candidate.displayName}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 border-r border-b">{candidate.email || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 border-r border-b">{candidate.phone || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 border-r border-b">{candidate.uploadDate}</td>
                  <td className="px-4 py-2 text-sm border-r border-b">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      candidate.analysisStatus === 'Analysé' ? 'bg-green-100 text-green-800' :
                      candidate.analysisStatus === 'En cours' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {candidate.analysisStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm border-r border-b">
                    <span className={`font-semibold ${
                      candidate.score >= 80 ? 'text-green-600' :
                      candidate.score >= 60 ? 'text-yellow-600' :
                      candidate.score >= 40 ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {candidate.score}/100
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 border-r border-b">{candidate.recommendation}</td>
                  <td className="px-4 py-2 text-sm border-r border-b">
                    {candidate.shortlisted ? (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">OUI</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">NON</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm border-b">
                    {onViewCandidate && (
                      <button
                        onClick={() => onViewCandidate(candidate)}
                        className="p-1 hover:bg-blue-100 rounded text-blue-600"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAndSortedData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucun candidat trouvé avec ces critères de recherche</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}