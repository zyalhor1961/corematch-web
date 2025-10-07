'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTheme } from '@/app/components/ThemeProvider';
import { Button } from '@/app/components/ui/button';
import {
  Upload,
  FileText,
  RefreshCw,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2
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

const STATUS_STYLES: Record<string, string> = {
  uploaded: 'bg-slate-100 text-slate-700',
  processing: 'bg-blue-100 text-blue-700',
  needs_review: 'bg-amber-100 text-amber-700',
  ready: 'bg-emerald-100 text-emerald-700',
  exported: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700'

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
      setError('Seuls les fichiers PDF sont acceptes');
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
        throw new Error(payload.error || "Echec de l'upload");
      }
      await loadBatches();
    } catch (err: any) {
      setError(err.message || "Echec de l'upload");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
        throw new Error(payload.error || 'Echec de la sauvegarde');
      }
      setPendingUpdates({});
      await loadLines(selectedBatchId);
    } catch (err: any) {
      setError(err.message || 'Echec de la sauvegarde');
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
      'Quantite',
      'Unite',
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
  const dirtyCount = Object.keys(pendingUpdates).length;
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) ?? null;
  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">DEB Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Uploadez vos factures et bons de livraison, enrichissez les champs douaniers puis exportez un CSV normalise.
            </p>
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
              className="flex items-center gap-2"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isUploading ? 'Upload en cours...' : 'Uploader un PDF'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={loadBatches}
              disabled={isLoadingBatches}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingBatches ? 'animate-spin' : ''}`} />
              Recharger
            </Button>
          </div>
        </header>
        {error && (
          <div className="flex items-center justify-between gap-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-xs uppercase tracking-wide">
              Fermer
            </button>
          </div>
        )}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Lots importes</h2>
            <span className="text-xs text-muted-foreground">{batches.length} lot(s)</span>
          </div>
          {isLoadingBatches && !batches.length ? (
            <div className="flex items-center justify-center rounded-md border border-dashed border-slate-300 p-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement des lots...
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 p-12 text-center text-sm text-muted-foreground">
              <FileText className="mb-3 h-8 w-8" />
              <p>Aucun lot traite pour le moment. Deposez un PDF pour commencer.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {batches.map((batch) => {
                const badgeClass = STATUS_STYLES[batch.status] ?? 'bg-slate-200 text-slate-700';
                return (
                  <button
                    key={batch.id}
                    onClick={() => setSelectedBatchId(batch.id)}
                    className={`rounded-lg border p-4 text-left shadow-sm transition ${
                      batch.id === selectedBatchId
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{batch.source_filename}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                        {batch.status}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <dt>Documents</dt>
                        <dd>
                          {batch.processed_documents}/{batch.total_documents}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Ajoute le</dt>
                        <dd>{formatDate(batch.created_at)}</dd>
                      </div>
                    </dl>
                    {batch.error_message && (
                      <p className="mt-3 text-xs text-red-600">{batch.error_message}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium">Tableau des lignes</h2>
              {selectedBatch && (
                <span className="text-xs text-muted-foreground">
                  {selectedBatch.processed_documents} document(s) associes
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRefreshBatch}
                disabled={!selectedBatchId || isLoadingLines}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingLines ? 'animate-spin' : ''}`} />
                Rafraichir
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadCsv}
                disabled={!lines.length}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                type="button"
                onClick={handleSaveChanges}
                disabled={!dirtyCount || isSaving}
                className="flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {isSaving ? 'Sauvegarde...' : `Enregistrer (${dirtyCount})`}
              </Button>
            </div>
          </div>
          {!selectedBatchId ? (
            <div className="flex items-center justify-center rounded-md border border-dashed border-slate-300 p-12 text-sm text-muted-foreground">
              Selectionnez un lot pour afficher les lignes.
            </div>
          ) : isLoadingLines ? (
            <div className="flex items-center justify-center rounded-md border border-dashed border-slate-300 p-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement des lignes...
            </div>
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 p-12 text-center text-sm text-muted-foreground">
              <Clock className="mb-3 h-8 w-8" />
              <p>Aucune ligne disponible pour ce lot pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-100 text-xs font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Doc</th>
                    <th className="px-3 py-2 text-left">Fournisseur</th>
                    <th className="px-3 py-2 text-left">Code SH</th>
                    <th className="px-3 py-2 text-left">Quantite</th>
                    <th className="px-3 py-2 text-left">Unite</th>
                    <th className="px-3 py-2 text-left">Pays origine</th>
                    <th className="px-3 py-2 text-left">Pays destination</th>
                    <th className="px-3 py-2 text-left">Poids (kg)</th>
                    <th className="px-3 py-2 text-left">Valeur fiscale (EUR)</th>
                    <th className="px-3 py-2 text-left">No BL</th>
                    <th className="px-3 py-2 text-left">Derniere revue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {lines.map((line) => {
                    const doc = line.documents || documentsById[line.document_id];
                    const isDirty = Boolean(pendingUpdates[line.id]);
                    return (
                      <tr key={line.id} className={isDirty ? 'bg-amber-50/70 dark:bg-amber-900/20' : ''}>
                        <td className="whitespace-nowrap px-3 py-2 align-top">
                          <div className="text-xs font-medium">{doc?.invoice_number ?? '-'}</div>
                          <div className="text-[11px] text-muted-foreground">{doc?.invoice_date ? formatDate(doc.invoice_date) : '-'}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-xs font-medium">{doc?.supplier_name ?? '-'}</div>
                          <div className="text-[11px] text-muted-foreground">{doc?.supplier_vat ?? ''}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            className="w-24 rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                            value={line.hs_code ?? ''}
                            onChange={(event) => handleLineChange(line.id, 'hs_code', event.target.value.toUpperCase())}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            className="w-20 rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                            value={line.qty ?? ''}
                            onChange={(event) => handleLineChange(line.id, 'qty', event.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            className="w-20 rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                            value={line.unit ?? ''}
                            onChange={(event) => handleLineChange(line.id, 'unit', event.target.value.toUpperCase())}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            className="w-24 rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                            value={line.country_of_origin ?? ''}
                            onChange={(event) => handleLineChange(line.id, 'country_of_origin', event.target.value.toUpperCase())}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            className="w-24 rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                            value={line.country_destination ?? ''}
                            onChange={(event) => handleLineChange(line.id, 'country_destination', event.target.value.toUpperCase())}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            className="w-24 rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                            value={line.net_mass_kg ?? ''}
                            onChange={(event) => handleLineChange(line.id, 'net_mass_kg', event.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            className="w-28 rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                            value={line.customs_value_line ?? ''}
                            onChange={(event) => handleLineChange(line.id, 'customs_value_line', event.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                          {doc?.delivery_note_number ?? '-'}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                          {line.last_reviewed_at ? formatDate(line.last_reviewed_at) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );

}

