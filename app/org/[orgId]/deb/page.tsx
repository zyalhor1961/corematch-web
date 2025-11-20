'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTheme } from '@/app/components/ThemeProvider';
import { Button } from '@/app/components/ui/button';
import { EditableDataTable, TableRow } from '@/app/components/deb/EditableDataTable';
import {
  Upload,
  FileText,
  RefreshCw,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Play,
  Eye,
  Trash2,
  TrendingUp,
  Package,
  Globe,
  Sparkles,
  BarChart3,
  FileSpreadsheet,
  ChevronRight,
  Info,
  Zap,
  XCircle,
  Check,
  X
} from 'lucide-react';

interface DebDocument {
  id: string;
  doc_type: 'invoice' | 'delivery_note' | 'mixed';
  filename?: string;
  supplier_name?: string;
  supplier_vat?: string;
  supplier_country?: string;
  invoice_number?: string;
  invoice_date?: string;
  delivery_note_number?: string;
  status?: string;
}

interface DebBatch {
  id: string;
  org_id: string;
  source_filename: string;
  storage_object_path: string;
  status: string;
  total_documents: number;
  processed_documents: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  documents?: DebDocument[];
}

interface DebLine {
  id: string;
  document_id: string;
  line_no: number;
  description?: string;
  sku?: string;
  qty?: number;
  unit?: string;
  unit_price?: number;
  line_amount?: number;
  hs_code?: string;
  hs_confidence?: number;
  country_of_origin?: string;
  country_destination?: string;
  net_mass_kg?: number;
  weight_confidence?: number;
  shipping_allocated?: number;
  customs_value_line?: number;
  source_weight?: string;
  source_hs?: string;
  enrichment_notes?: string;
  last_reviewed_at?: string;
  documents?: DebDocument;
}

type LineEditableField =
  | 'country_of_origin'
  | 'country_destination'
  | 'hs_code'
  | 'hs_confidence'
  | 'qty'
  | 'unit'
  | 'net_mass_kg'
  | 'weight_confidence'
  | 'shipping_allocated'
  | 'customs_value_line'
  | 'enrichment_notes';

type PendingUpdates = Record<string, Partial<Record<LineEditableField, unknown>>>;

const NUMERIC_FIELDS: LineEditableField[] = [
  'qty',
  'hs_confidence',
  'net_mass_kg',
  'weight_confidence',
  'shipping_allocated',
  'customs_value_line'
];

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  uploaded: { color: 'bg-gradient-to-r from-blue-500 to-blue-600', label: 'Uploadé', icon: Upload },
  processing: { color: 'bg-gradient-to-r from-purple-500 to-purple-600', label: 'En cours', icon: Loader2 },
  needs_review: { color: 'bg-gradient-to-r from-amber-500 to-orange-600', label: 'À revoir', icon: AlertTriangle },
  ready: { color: 'bg-gradient-to-r from-emerald-500 to-green-600', label: 'Prêt', icon: CheckCircle },
  exported: { color: 'bg-gradient-to-r from-teal-500 to-cyan-600', label: 'Exporté', icon: Download },
  failed: { color: 'bg-gradient-to-r from-red-500 to-red-600', label: 'Échoué', icon: XCircle }
};

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
}

function formatCurrency(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(value);
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export default function DebAssistantPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const { isDarkMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [batches, setBatches] = useState<DebBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [lines, setLines] = useState<DebLine[]>([]);
  const [documentsById, setDocumentsById] = useState<Record<string, DebDocument>>({});
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdates>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingCell, setEditingCell] = useState<{ lineId: string; field: string } | null>(null);

  const loadBatches = useCallback(async () => {
    if (!orgId) return;
    setIsLoadingBatches(true);
    setError(null);
    try {
      const response = await fetch(`/api/deb/batches?orgId=${orgId}`);
      if (!response.ok) {
        throw new Error('Impossible de charger les lots DEB');
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Erreur inconnue');
      }
      setBatches(payload.data ?? []);
      if (!selectedBatchId && payload.data?.length) {
        setSelectedBatchId(payload.data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setIsLoadingBatches(false);
    }
  }, [orgId, selectedBatchId]);

  const loadLines = useCallback(async (batchId: string) => {
    setIsLoadingLines(true);
    setError(null);
    try {
      const response = await fetch(`/api/deb/batches/${batchId}/lines`);
      if (!response.ok) {
        throw new Error('Impossible de charger les lignes du lot');
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Erreur inconnue');
      }
      setLines(payload.data.lines ?? []);
      const docsMap: Record<string, DebDocument> = {};
      for (const doc of payload.data.documents ?? []) {
        docsMap[doc.id] = doc;
      }
      setDocumentsById(docsMap);
      setPendingUpdates({});
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement des lignes');
    } finally {
      setIsLoadingLines(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (selectedBatchId) {
      loadLines(selectedBatchId);
    } else {
      setLines([]);
      setPendingUpdates({});
    }
  }, [selectedBatchId, loadLines]);

  const handleFileSelect = async (file: File | null) => {
    if (!file || !orgId) return;
    if (!file.type.toLowerCase().includes('pdf')) {
      setError('Seuls les fichiers PDF sont acceptés');
      return;
    }
    const formData = new FormData();
    formData.append('orgId', orgId);
    formData.append('file', file);
    setIsUploading(true);
    setError(null);
    try {
      const response = await fetch('/api/deb/batches', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Échec de l'upload");
      }
      await loadBatches();
    } catch (err: any) {
      setError(err.message || "Échec de l'upload");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const debouncedLoadLines = useMemo(() => debounce(loadLines, 800), [loadLines]);

  const handleRefreshBatch = async () => {
    if (selectedBatchId) {
      loadLines(selectedBatchId);
    }
  };

  const handleLineChange = (lineId: string, field: LineEditableField, value: string) => {
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [field]: NUMERIC_FIELDS.includes(field)
                ? (value === '' ? undefined : Number(value))
                : value
            }
          : line
      )
    );
    setPendingUpdates((prev) => ({
      ...prev,
      [lineId]: {
        ...(prev[lineId] ?? {}),
        [field]: NUMERIC_FIELDS.includes(field)
          ? (value === '' ? null : Number(value))
          : value
      }
    }));
  };

  const handleSaveChanges = async () => {
    if (!selectedBatchId || Object.keys(pendingUpdates).length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const updates = Object.entries(pendingUpdates).map(([lineId, values]) => ({
        lineId,
        values
      }));
      const response = await fetch(`/api/deb/batches/${selectedBatchId}/lines`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Échec de la sauvegarde');
      }
      setPendingUpdates({});
      await loadLines(selectedBatchId);
    } catch (err: any) {
      setError(err.message || 'Échec de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!lines.length) return;
    const headers = [
      'Num facture',
      'Fournisseur',
      'Pays origine',
      'Pays destination',
      'Code SH',
      'Quantité',
      'Unité',
      'Poids (kg)',
      'Valeur fiscale (EUR)',
      'No BL'
    ];
    const rows = lines.map((line) => {
      const doc = line.documents || documentsById[line.document_id];
      const values = [
        doc?.invoice_number ?? '',
        doc?.supplier_name ?? '',
        line.country_of_origin ?? doc?.supplier_country ?? '',
        line.country_destination ?? '',
        line.hs_code ?? '',
        line.qty ?? '',
        line.unit ?? '',
        line.net_mass_kg ?? '',
        line.customs_value_line ?? '',
        doc?.delivery_note_number ?? ''
      ];
      return values
        .map((value) => {
          const str = value === null || value === undefined ? '' : String(value);
          return str.includes(';') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(';');
    });
    const csvContent = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deb-export-${selectedBatchId ?? 'corematch'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleProcessBatch = async () => {
    if (!selectedBatchId) return;
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch(`/api/deb/batches/${selectedBatchId}/process`, {
        method: 'POST',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Échec du traitement');
      }
      await loadBatches();
      await loadLines(selectedBatchId);
    } catch (err: any) {
      setError(err.message || 'Échec du traitement');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewPdf = async () => {
    if (!selectedBatch) return;
    try {
      const response = await fetch(
        `/api/deb/documents?batchId=${selectedBatch.id}`
      );
      if (!response.ok) throw new Error('Impossible de charger le PDF');
      const payload = await response.json();
      if (payload.success && payload.data && payload.data.length > 0) {
        const doc = payload.data[0];
        const urlResponse = await fetch(
          `/api/storage/signed-url?bucket=deb-docs&path=${encodeURIComponent(doc.storage_object_path)}`
        );
        if (urlResponse.ok) {
          const urlData = await urlResponse.json();
          if (urlData.signedUrl) {
            setPdfUrl(urlData.signedUrl);
            setShowPdfViewer(true);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de charger le PDF');
    }
  };

  const handleDeleteBatch = async (batchId: string, filename: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le lot "${filename}" ? Cette action supprimera tous les documents et lignes associés. Cette action est irréversible.`)) {
      return;
    }

    setDeletingBatchId(batchId);
    setError(null);

    try {
      const response = await fetch(`/api/deb/batches/${batchId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.userMessage || errorData.error?.message || errorData.message || 'La suppression a échoué.';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success) {
        setBatches(prev => prev.filter(b => b.id !== batchId));
        if (selectedBatchId === batchId) {
          setSelectedBatchId(null);
          setLines([]);
        }
      } else {
        throw new Error(data.error || 'Une erreur est survenue.');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error deleting batch:', err);
    } finally {
      setDeletingBatchId(null);
    }
  };

  const dirtyCount = Object.keys(pendingUpdates).length;
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) ?? null;

  // Analytics calculations
  const analytics = useMemo(() => {
    const totalLines = lines.length;
    const linesWithHSCode = lines.filter(l => l.hs_code).length;
    const linesWithOrigin = lines.filter(l => l.country_of_origin).length;
    const totalValue = lines.reduce((sum, l) => sum + (l.customs_value_line || 0), 0);
    const totalWeight = lines.reduce((sum, l) => sum + (l.net_mass_kg || 0), 0);
    const uniqueCountries = new Set(lines.map(l => l.country_of_origin).filter(Boolean)).size;

    return {
      totalLines,
      linesWithHSCode,
      linesWithOrigin,
      totalValue,
      totalWeight,
      uniqueCountries,
      completionRate: totalLines > 0 ? Math.round((linesWithHSCode / totalLines) * 100) : 0
    };
  }, [lines]);

  return (
    <div className={`min-h-screen transition-all duration-300 ${isDarkMode ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50'}`}>
      <div className="max-w-[1800px] mx-auto px-6 py-8 space-y-8">

        {/* Hero Header */}
        <header className="relative overflow-hidden">
          <div className={`absolute inset-0 ${isDarkMode ? 'bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10' : 'bg-gradient-to-r from-blue-100/50 via-purple-100/50 to-pink-100/50'} blur-3xl`}></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-blue-600 to-purple-700'} shadow-lg`}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className={`text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${isDarkMode ? 'from-blue-400 via-purple-400 to-pink-400' : 'from-blue-600 via-purple-600 to-pink-600'}`}>
                  DEB Assistant Pro
                </h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Automatisez vos déclarations douanières avec l'IA • Extraction intelligente • Export normalisé
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className={`relative overflow-hidden rounded-2xl border ${isDarkMode ? 'bg-red-950/50 border-red-500/30' : 'bg-red-50 border-red-200'} backdrop-blur-sm`}>
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent"></div>
            <div className="relative p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                <span className={`font-medium ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-red-900/50' : 'hover:bg-red-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Upload Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
              : isDarkMode
                ? 'border-slate-700 bg-slate-900/50'
                : 'border-slate-300 bg-white/80'
          } backdrop-blur-sm shadow-xl hover:shadow-2xl`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
          <div className="relative p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className={`p-5 rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-blue-600 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-purple-600'} shadow-lg`}>
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Uploadez vos documents
                  </h3>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Glissez-déposez vos factures et BL (PDF) ou cliquez pour sélectionner
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Zap className={`w-3.5 h-3.5 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Extraction IA automatique</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Globe className={`w-3.5 h-3.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Multi-langues</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  size="lg"
                  className={`${isDarkMode ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'} text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mr-2" />
                      Sélectionner un PDF
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadBatches}
                  disabled={isLoadingBatches}
                  size="lg"
                  className={`${isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'}`}
                >
                  <RefreshCw className={`h-5 w-5 ${isLoadingBatches ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Dashboard - Only show when batch is selected */}
        {selectedBatchId && lines.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Lignes totales', value: analytics.totalLines, icon: FileText, color: 'blue' },
              { label: 'Codes SH', value: `${analytics.linesWithHSCode}/${analytics.totalLines}`, icon: Package, color: 'purple' },
              { label: 'Valeur totale', value: formatCurrency(analytics.totalValue), icon: TrendingUp, color: 'emerald' },
              { label: 'Complétude', value: `${analytics.completionRate}%`, icon: BarChart3, color: 'pink' }
            ].map((stat, idx) => (
              <div
                key={idx}
                className={`relative overflow-hidden rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 group`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-${stat.color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                <div className="relative p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{stat.label}</span>
                    <div className={`p-2 rounded-xl bg-gradient-to-br from-${stat.color}-500 to-${stat.color}-600 shadow-lg`}>
                      <stat.icon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {stat.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Batches Grid */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Lots importés
              </h2>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {batches.length} lot{batches.length > 1 ? 's' : ''} • Sélectionnez un lot pour voir les détails
              </p>
            </div>
          </div>

          {isLoadingBatches && !batches.length ? (
            <div className={`flex items-center justify-center rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} p-12`}>
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-blue-500" />
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Chargement des lots...</span>
            </div>
          ) : batches.length === 0 ? (
            <div className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-300 bg-slate-50'} p-16 text-center`}>
              <div className={`p-5 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'} mb-4`}>
                <FileText className={`h-10 w-10 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aucun lot pour le moment</h3>
              <p className={`mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Uploadez votre premier PDF pour commencer l'analyse</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {batches.map((batch) => {
                const config = STATUS_CONFIG[batch.status] ?? STATUS_CONFIG.uploaded;
                const StatusIcon = config.icon;
                const isSelected = batch.id === selectedBatchId;
                const isDeleting = deletingBatchId === batch.id;

                return (
                  <div
                    key={batch.id}
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                      isSelected
                        ? isDarkMode
                          ? 'border-blue-500 bg-gradient-to-br from-blue-950/50 to-purple-950/30 shadow-2xl shadow-blue-500/20 scale-[1.02]'
                          : 'border-blue-400 bg-gradient-to-br from-blue-50 to-purple-50 shadow-2xl shadow-blue-200/50 scale-[1.02]'
                        : isDarkMode
                          ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:shadow-xl'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xl'
                    } backdrop-blur-sm cursor-pointer`}
                    onClick={() => !isDeleting && setSelectedBatchId(batch.id)}
                  >
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                    )}

                    <div className="relative p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0 pr-3">
                          <h3 className={`text-sm font-bold truncate mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {batch.source_filename}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white ${config.color} shadow-lg`}>
                              <StatusIcon className={`w-3.5 h-3.5 ${batch.status === 'processing' ? 'animate-spin' : ''}`} />
                              {config.label}
                            </span>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBatch(batch.id, batch.source_filename);
                          }}
                          disabled={isDeleting}
                          className={`p-2 rounded-xl transition-all duration-200 ${
                            isDarkMode
                              ? 'hover:bg-red-500/20 text-red-400'
                              : 'hover:bg-red-100 text-red-600'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title="Supprimer le lot"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Stats */}
                      <div className={`space-y-2 p-3 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Documents</span>
                          <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {batch.processed_documents}/{batch.total_documents}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Ajouté le</span>
                          <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            {formatDate(batch.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Error message */}
                      {batch.error_message && (
                        <div className={`mt-3 p-2.5 rounded-lg ${isDarkMode ? 'bg-red-950/50 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                          <p className={`text-xs ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>{batch.error_message}</p>
                        </div>
                      )}

                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute bottom-3 right-3">
                          <div className="p-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Action Bar + Table */}
        {selectedBatchId && (
          <section className="space-y-5">
            {/* Action Bar */}
            <div className={`rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} backdrop-blur-sm shadow-lg p-5`}>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                  <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Enrichissement des données
                  </h2>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {lines.length} ligne{lines.length > 1 ? 's' : ''} • {dirtyCount} modification{dirtyCount > 1 ? 's' : ''} en attente
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={handleProcessBatch}
                    disabled={isProcessing || selectedBatch?.status === 'processing'}
                    className={`${isDarkMode ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'} text-white shadow-lg hover:shadow-xl transition-all`}
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    {isProcessing ? 'Traitement...' : 'Traiter avec IA'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleViewPdf}
                    disabled={!selectedBatchId}
                    className={isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Voir PDF
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRefreshBatch}
                    disabled={isLoadingLines}
                    className={isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingLines ? 'animate-spin' : ''}`} />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadCsv}
                    disabled={!lines.length}
                    className={isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>

                  {dirtyCount > 0 && (
                    <Button
                      type="button"
                      onClick={handleSaveChanges}
                      disabled={isSaving}
                      className={`${isDarkMode ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500' : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700'} text-white shadow-lg hover:shadow-xl transition-all`}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Enregistrer ({dirtyCount})
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Data Table */}
            {isLoadingLines ? (
              <div className={`flex items-center justify-center rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} p-12`}>
                <Loader2 className="mr-3 h-6 w-6 animate-spin text-blue-500" />
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Chargement des lignes...</span>
              </div>
            ) : lines.length === 0 ? (
              <div className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-300 bg-slate-50'} p-16 text-center`}>
                <Clock className={`h-10 w-10 mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Aucune ligne disponible pour ce lot</p>
              </div>
            ) : (
              <EditableDataTable
                data={lines.map(line => {
                  const doc = line.documents || documentsById[line.document_id];
                  const hasHSCode = Boolean(line.hs_code);
                  const hasCountryOrigin = Boolean(line.country_of_origin);

                  // Determine confidence and errors
                  const confidence = hasHSCode && hasCountryOrigin ? 0.95 : hasHSCode || hasCountryOrigin ? 0.80 : 0.60;
                  const errors: Record<string, string> = {};
                  if (!line.hs_code) errors.hsCode = 'Code SH requis';
                  if (!line.country_of_origin) errors.countryOfOrigin = 'Origine requise';

                  return {
                    id: line.id,
                    invoiceNumber: doc?.invoice_number || '-',
                    supplier: doc?.supplier_name || '-',
                    description: line.description || doc?.supplier_name || '',
                    quantity: line.qty || 0,
                    unitPrice: line.unit_price || 0,
                    total: line.line_amount || line.customs_value_line || 0,
                    hsCode: line.hs_code || '',
                    countryOfOrigin: line.country_of_origin || '',
                    countryDestination: line.country_destination || '',
                    unit: line.unit || '',
                    netMassKg: line.net_mass_kg || 0,
                    confidence,
                    errors: Object.keys(errors).length > 0 ? errors : undefined,
                  } as TableRow;
                })}
                onDataChange={(newData) => {
                  // Update lines state and pendingUpdates when AG-Grid data changes
                  newData.forEach(row => {
                    const originalLine = lines.find(l => l.id === row.id);
                    if (!originalLine) return;

                    // Check what changed and update
                    const changes: Partial<Record<LineEditableField, unknown>> = {};

                    if (row.hsCode !== (originalLine.hs_code || '')) {
                      changes.hs_code = row.hsCode || null;
                    }
                    if (row.countryOfOrigin !== (originalLine.country_of_origin || '')) {
                      changes.country_of_origin = row.countryOfOrigin || null;
                    }
                    if (row.countryDestination !== (originalLine.country_destination || '')) {
                      changes.country_destination = row.countryDestination || null;
                    }
                    if (row.unit !== (originalLine.unit || '')) {
                      changes.unit = row.unit || null;
                    }
                    if (row.quantity !== (originalLine.qty || 0)) {
                      changes.qty = row.quantity;
                    }
                    if (row.netMassKg !== (originalLine.net_mass_kg || 0)) {
                      changes.net_mass_kg = row.netMassKg;
                    }
                    if (row.total !== (originalLine.customs_value_line || 0)) {
                      changes.customs_value_line = row.total;
                    }

                    if (Object.keys(changes).length > 0) {
                      // Update lines state
                      setLines(prev => prev.map(line =>
                        line.id === row.id ? { ...line, ...changes } : line
                      ));

                      // Update pending updates
                      setPendingUpdates(prev => ({
                        ...prev,
                        [row.id]: {
                          ...(prev[row.id] || {}),
                          ...changes
                        }
                      }));
                    }
                  });
                }}
                onSave={handleSaveChanges}
                isDarkMode={isDarkMode}
              />
            )}
          </section>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {showPdfViewer && pdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-7xl h-[95vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className={`flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} px-6 py-4`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {selectedBatch?.source_filename}
                  </h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Visualisation PDF
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPdfViewer(false);
                  setPdfUrl(null);
                }}
                className={`p-2 rounded-xl transition-all ${
                  isDarkMode
                    ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                    : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="h-[calc(100%-73px)]">
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="PDF Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
