import { format, differenceInDays, parseISO } from 'date-fns';

export type ReportType = 'aging_balance' | 'vendor_spend' | 'pnl' | 'vat_report' | 'general_ledger';

export interface ReportData {
    columns: { key: string; label: string; type?: 'text' | 'number' | 'date' | 'currency' }[];
    data: any[];
}

/**
 * Transformer for Aging Balance Report
 * Groups by Client and buckets amounts by due date
 */
export const transformAgingBalance = (invoices: any[]): ReportData => {
    const today = new Date();
    const clientMap = new Map<string, {
        client: string;
        current: number;
        days_30: number;
        days_60: number;
        days_90: number;
        total: number;
    }>();

    invoices.forEach(inv => {
        const client = inv.client_name || 'Unknown';
        const amount = Number(inv.total_amount) || 0;
        const dueDate = inv.due_date ? parseISO(inv.due_date) : new Date();
        const daysOverdue = differenceInDays(today, dueDate);

        if (!clientMap.has(client)) {
            clientMap.set(client, { client, current: 0, days_30: 0, days_60: 0, days_90: 0, total: 0 });
        }

        const entry = clientMap.get(client)!;
        entry.total += amount;

        if (daysOverdue <= 0) entry.current += amount;
        else if (daysOverdue <= 30) entry.days_30 += amount;
        else if (daysOverdue <= 60) entry.days_60 += amount;
        else entry.days_90 += amount;
    });

    return {
        columns: [
            { key: 'client', label: 'Client / Fournisseur', type: 'text' },
            { key: 'current', label: 'Courant', type: 'currency' },
            { key: 'days_30', label: '1-30 Jours', type: 'currency' },
            { key: 'days_60', label: '30-60 Jours', type: 'currency' },
            { key: 'days_90', label: '+90 Jours', type: 'currency' },
            { key: 'total', label: 'Total', type: 'currency' },
        ],
        data: Array.from(clientMap.values()),
    };
};

/**
 * Transformer for Vendor Spend Report
 * Groups by Client and sums total amount
 */
export const transformVendorSpend = (invoices: any[]): ReportData => {
    const clientMap = new Map<string, { client: string; count: number; total: number }>();

    invoices.forEach(inv => {
        const client = inv.client_name || 'Unknown';
        const amount = Number(inv.total_amount) || 0;

        if (!clientMap.has(client)) {
            clientMap.set(client, { client, count: 0, total: 0 });
        }

        const entry = clientMap.get(client)!;
        entry.count += 1;
        entry.total += amount;
    });

    return {
        columns: [
            { key: 'client', label: 'Fournisseur', type: 'text' },
            { key: 'count', label: 'Nombre de Factures', type: 'number' },
            { key: 'total', label: 'Montant Total', type: 'currency' },
        ],
        data: Array.from(clientMap.values()).sort((a, b) => b.total - a.total),
    };
};

/**
 * Transformer for P&L (Profit & Loss) - Mock Implementation
 * Simulates Expenses vs Revenue
 */
export const transformPnL = (invoices: any[]): ReportData => {
    // Mock expenses (normally would come from another table)
    const totalRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const mockExpenses = totalRevenue * 0.65; // Assume 65% margin
    const netIncome = totalRevenue - mockExpenses;

    return {
        columns: [
            { key: 'category', label: 'Catégorie', type: 'text' },
            { key: 'amount', label: 'Montant', type: 'currency' },
            { key: 'percentage', label: '% Revenu', type: 'text' },
        ],
        data: [
            { category: 'Chiffre d\'Affaires (Revenu)', amount: totalRevenue, percentage: '100%' },
            { category: 'Coût des Marchandises (COGS)', amount: mockExpenses * 0.4, percentage: '26%' },
            { category: 'Dépenses Opérationnelles', amount: mockExpenses * 0.6, percentage: '39%' },
            { category: 'Résultat Net', amount: netIncome, percentage: '35%' },
        ],
    };
};

/**
 * Transformer for VAT Report
 * Calculates VAT (20%) from Total Amount
 */
export const transformVAT = (invoices: any[]): ReportData => {
    const vatRate = 0.20;

    const data = invoices.map(inv => {
        const total = Number(inv.total_amount) || 0;
        const vat = total * vatRate; // Simplified calculation
        const ht = total - vat;

        return {
            invoice_number: inv.invoice_number,
            date: inv.date_issued,
            client: inv.client_name,
            amount_ht: ht,
            vat_amount: vat,
            amount_ttc: total,
        };
    });

    return {
        columns: [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'invoice_number', label: 'N° Facture', type: 'text' },
            { key: 'client', label: 'Tiers', type: 'text' },
            { key: 'amount_ht', label: 'Montant HT', type: 'currency' },
            { key: 'vat_amount', label: 'TVA (20%)', type: 'currency' },
            { key: 'amount_ttc', label: 'Montant TTC', type: 'currency' },
        ],
        data: data,
    };
};

/**
 * Transformer for General Ledger
 * Flat list of all transactions sorted by date
 */
export const transformGeneralLedger = (invoices: any[]): ReportData => {
    const data = invoices.map(inv => ({
        date: inv.date_issued,
        journal: 'ACHATS', // Default journal for invoices
        reference: inv.invoice_number,
        label: `Facture ${inv.client_name}`,
        debit: Number(inv.total_amount) || 0,
        credit: 0,
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
        columns: [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'journal', label: 'Journal', type: 'text' },
            { key: 'reference', label: 'Référence', type: 'text' },
            { key: 'label', label: 'Libellé', type: 'text' },
            { key: 'debit', label: 'Débit', type: 'currency' },
            { key: 'credit', label: 'Crédit', type: 'currency' },
        ],
        data: data,
    };
};

export const REPORT_TRANSFORMERS: Record<ReportType, (data: any[]) => ReportData> = {
    aging_balance: transformAgingBalance,
    vendor_spend: transformVendorSpend,
    pnl: transformPnL,
    vat_report: transformVAT,
    general_ledger: transformGeneralLedger,
};
