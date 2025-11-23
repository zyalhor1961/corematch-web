'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
    ArrowLeft,
    Save,
    Send,
    Plus,
    Trash2,
    Calendar,
    User,
    FileText,
    CheckCircle,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    RotateCcw
} from 'lucide-react';

// Types (simplified for this implementation)
interface Client {
    id: string;
    name: string;
    email: string;
    address: string;
    vat_number?: string;
    default_payment_terms?: string;
}

interface Product {
    id: string;
    name: string;
    price: number;
    vat_rate: number;
}

interface QuoteLine {
    id: string;
    product_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    total_ht: number;
}

export default function NewQuotePage() {
    const params = useParams();
    const router = useRouter();
    const orgId = params.orgId as string;

    // Wizard State
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [autoSaved, setAutoSaved] = useState(false);

    // Data State
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Form State
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
    const [validityDate, setValidityDate] = useState(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [reference, setReference] = useState('');
    const [lines, setLines] = useState<QuoteLine[]>([]);
    const [notes, setNotes] = useState('');

    // Load initial data
    useEffect(() => {
        async function loadData() {
            // Mock data for now - in real app fetch from Supabase
            setClients([
                { id: '1', name: 'Acme Corp', email: 'contact@acme.com', address: '123 Rue de Paris', default_payment_terms: '30_days' },
                { id: '2', name: 'Globex Inc', email: 'info@globex.com', address: '456 Avenue des Champs', default_payment_terms: 'immediate' },
            ]);
            setProducts([
                { id: 'p1', name: 'Consulting Senior', price: 1200, vat_rate: 20 },
                { id: 'p2', name: 'Développement Web', price: 800, vat_rate: 20 },
                { id: 'p3', name: 'Formation IA', price: 1500, vat_rate: 20 },
            ]);
        }
        loadData();

        // Check for draft
        const savedDraft = localStorage.getItem(`quote_draft_${orgId}`);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                setSelectedClient(draft.selectedClient);
                setReference(draft.reference);
                setLines(draft.lines);
                setAutoSaved(true);
                setTimeout(() => setAutoSaved(false), 3000);
            } catch (e) {
                console.error("Failed to restore draft", e);
            }
        }
    }, [orgId]);

    // Auto-save effect
    useEffect(() => {
        if (selectedClient || lines.length > 0) {
            const draft = {
                selectedClient,
                reference,
                lines,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(`quote_draft_${orgId}`, JSON.stringify(draft));
        }
    }, [selectedClient, reference, lines, orgId]);

    // AI Smart Defaults
    useEffect(() => {
        if (selectedClient && !reference) {
            // Simulate AI generating a reference
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const clientCode = selectedClient.name.substring(0, 3).toUpperCase();
            setReference(`DEV-${dateStr}-${clientCode}`);
        }
    }, [selectedClient, reference]);

    const addLine = () => {
        const newLine: QuoteLine = {
            id: Math.random().toString(36).substr(2, 9),
            product_id: '',
            description: '',
            quantity: 1,
            unit_price: 0,
            vat_rate: 20,
            total_ht: 0
        };
        setLines([...lines, newLine]);
    };

    const updateLine = (id: string, field: keyof QuoteLine, value: any) => {
        setLines(lines.map(line => {
            if (line.id === id) {
                const updatedLine = { ...line, [field]: value };

                // Auto-update related fields
                if (field === 'product_id') {
                    const product = products.find(p => p.id === value);
                    if (product) {
                        updatedLine.description = product.name;
                        updatedLine.unit_price = product.price;
                        updatedLine.vat_rate = product.vat_rate;
                    }
                }

                updatedLine.total_ht = updatedLine.quantity * updatedLine.unit_price;
                return updatedLine;
            }
            return line;
        }));
    };

    const removeLine = (id: string) => {
        setLines(lines.filter(l => l.id !== id));
    };

    const totals = lines.reduce((acc, line) => {
        const ht = line.quantity * line.unit_price;
        const tva = ht * (line.vat_rate / 100);
        return {
            ht: acc.ht + ht,
            tva: acc.tva + tva,
            ttc: acc.ttc + ht + tva
        };
    }, { ht: 0, tva: 0, ttc: 0 });

    const handleNext = () => {
        if (currentStep < 3) setCurrentStep(currentStep + 1);
    };

    const handlePrev = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleSubmit = async () => {
        setSaving(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        localStorage.removeItem(`quote_draft_${orgId}`);
        setSaving(false);
        router.push(`/org/${orgId}/erp/quotes`);
    };

    return (
        <div className="max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau Devis</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Créer une proposition commerciale</p>
                    </div>
                </div>

                {autoSaved && (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full animate-fade-in">
                        <RotateCcw className="w-3 h-3" />
                        Brouillon restauré
                    </div>
                )}
            </div>

            {/* Wizard Progress */}
            <div className="mb-8">
                <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700 -z-10" />

                    {[1, 2, 3].map((step) => (
                        <div key={step} className="flex flex-col items-center bg-gray-50/50 dark:bg-gray-900 px-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${currentStep >= step
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                                }`}>
                                {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                            </div>
                            <span className={`text-xs font-medium mt-2 ${currentStep >= step ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
                                }`}>
                                {step === 1 ? 'Client & Infos' : step === 2 ? 'Lignes' : 'Finalisation'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 1: Client & Infos */}
            {currentStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-500" />
                            Informations Client
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
                                <select
                                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    value={selectedClient?.id || ''}
                                    onChange={(e) => setSelectedClient(clients.find(c => c.id === e.target.value) || null)}
                                >
                                    <option value="">Sélectionner un client...</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Référence</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                        value={reference}
                                        onChange={(e) => setReference(e.target.value)}
                                        placeholder="DEV-2024-..."
                                    />
                                    {reference && <Sparkles className="absolute right-3 top-3 w-4 h-4 text-purple-500 opacity-50" />}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date du devis</label>
                                <input
                                    type="date"
                                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    value={quoteDate}
                                    onChange={(e) => setQuoteDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validité jusqu'au</label>
                                <input
                                    type="date"
                                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    value={validityDate}
                                    onChange={(e) => setValidityDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Lines */}
            {currentStep === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-500" />
                                Lignes du devis
                            </h2>
                            <button
                                onClick={addLine}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                Ajouter une ligne
                            </button>
                        </div>

                        <div className="space-y-4">
                            {lines.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                                    <p>Aucune ligne. Ajoutez des produits ou services.</p>
                                </div>
                            ) : (
                                lines.map((line, index) => (
                                    <div key={line.id} className="grid grid-cols-12 gap-4 items-start p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-700 group">
                                        <div className="col-span-12 md:col-span-4">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Produit / Service</label>
                                            <select
                                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                                                value={line.product_id}
                                                onChange={(e) => updateLine(line.id, 'product_id', e.target.value)}
                                            >
                                                <option value="">Personnalisé</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                className="w-full mt-2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                                                placeholder="Description"
                                                value={line.description}
                                                onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                                            />
                                        </div>

                                        <div className="col-span-6 md:col-span-2">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Qté</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-right"
                                                value={line.quantity}
                                                onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value))}
                                            />
                                        </div>

                                        <div className="col-span-6 md:col-span-2">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Prix U. HT</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-right"
                                                value={line.unit_price}
                                                onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value))}
                                            />
                                        </div>

                                        <div className="col-span-6 md:col-span-2">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">TVA %</label>
                                            <input
                                                type="number"
                                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-right"
                                                value={line.vat_rate}
                                                onChange={(e) => updateLine(line.id, 'vat_rate', parseFloat(e.target.value))}
                                            />
                                        </div>

                                        <div className="col-span-6 md:col-span-2 relative">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Total HT</label>
                                            <div className="p-2 text-sm font-medium text-right text-gray-900 dark:text-white">
                                                {line.total_ht.toFixed(2)} €
                                            </div>
                                            <button
                                                onClick={() => removeLine(line.id)}
                                                className="absolute -right-2 top-8 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Totals */}
                        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-end">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                    <span>Total HT</span>
                                    <span>{totals.ht.toFixed(2)} €</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                    <span>TVA</span>
                                    <span>{totals.tva.toFixed(2)} €</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-2">
                                    <span>Total TTC</span>
                                    <span>{totals.ttc.toFixed(2)} €</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Finalisation */}
            {currentStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h2 className="text-lg font-semibold mb-4">Récapitulatif</h2>

                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mb-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{selectedClient?.name}</h3>
                                    <p className="text-sm text-gray-500">{selectedClient?.address}</p>
                                    <p className="text-sm text-gray-500">{selectedClient?.email}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono font-medium text-blue-600">{reference}</p>
                                    <p className="text-sm text-gray-500">Date: {quoteDate}</p>
                                    <p className="text-sm text-gray-500">Valide: {validityDate}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes & Conditions</label>
                            <textarea
                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-32"
                                placeholder="Conditions de paiement, livraison, etc..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Buttons */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-10">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <button
                        onClick={handlePrev}
                        disabled={currentStep === 1}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors ${currentStep === 1
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Précédent
                    </button>

                    {currentStep < 3 ? (
                        <button
                            onClick={handleNext}
                            disabled={!selectedClient}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                        >
                            Suivant
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Enregistrer le devis
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
