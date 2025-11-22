/**
 * Moteur Comptable Corematch
 * Export centralisé
 */

// Types
export * from './types';

// Moteur principal
export { AccountingEngine, createAccountingEngine, initializeOrganizationAccounting } from './engine';

// Déclencheurs pour les événements métier
export {
  onCustomerInvoiceValidated,
  onSupplierInvoiceValidated,
  onPaymentReceived,
  onPaymentSent,
  onExpenseRecorded,
  reverseEntriesForSource,
  regenerateEntriesForInvoice,
} from './triggers';
