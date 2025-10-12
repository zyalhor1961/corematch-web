/**
 * PDF Splitter Utility
 *
 * Splits multi-invoice PDFs into separate invoices based on Azure's document detection
 */

import { PDFDocument } from 'pdf-lib';
import { analyzeDocument, AzurePrebuiltModel } from '@/lib/services/azure-document-intelligence';

export interface InvoiceBoundary {
  startPage: number; // 1-indexed
  endPage: number;   // 1-indexed
  documentIndex: number;
  reason: string;
}

export interface SplitInvoice {
  pages: number[];
  pdfBuffer: Buffer;
  invoiceNumber?: string;
}

/**
 * Detect invoice boundaries by splitting into 2-page chunks
 * Most invoices are 1-2 pages, so this is a practical heuristic
 */
export async function detectInvoiceBoundaries(
  pdfBuffer: Buffer
): Promise<InvoiceBoundary[]> {
  try {
    console.log('🔍 Detecting invoice boundaries...');

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();

    console.log(`📄 PDF has ${totalPages} total pages`);

    const boundaries: InvoiceBoundary[] = [];
    const PAGES_PER_INVOICE = 2; // Assume max 2 pages per invoice

    let currentPage = 1;
    let invoiceIndex = 1;

    while (currentPage <= totalPages) {
      const startPage = currentPage;
      const endPage = Math.min(currentPage + PAGES_PER_INVOICE - 1, totalPages);

      boundaries.push({
        startPage,
        endPage,
        documentIndex: invoiceIndex,
        reason: `Invoice ${invoiceIndex}: pages ${startPage}-${endPage}`
      });

      console.log(`📋 Invoice ${invoiceIndex}: Pages ${startPage}-${endPage}`);

      currentPage = endPage + 1;
      invoiceIndex++;
    }

    console.log(`✅ Split PDF into ${boundaries.length} invoice(s) (${PAGES_PER_INVOICE} pages each)`);
    return boundaries;

  } catch (error: any) {
    console.error('Error detecting invoice boundaries:', error);
    // Fallback: treat entire PDF as one invoice
    return [{
      startPage: 1,
      endPage: 999,
      documentIndex: 1,
      reason: 'Fallback - treating entire PDF as one invoice'
    }];
  }
}

/**
 * Split a PDF into separate PDFs based on page ranges
 */
export async function splitPdfByPages(
  pdfBuffer: Buffer,
  boundaries: InvoiceBoundary[]
): Promise<SplitInvoice[]> {
  try {
    console.log('✂️  Splitting PDF into separate invoices...');

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();

    console.log(`📄 Total pages in PDF: ${totalPages}`);

    const splitInvoices: SplitInvoice[] = [];

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      const startPage = boundary.startPage - 1; // Convert to 0-indexed
      const endPage = Math.min(boundary.endPage, totalPages) - 1; // Convert to 0-indexed

      if (startPage >= totalPages) {
        console.log(`⚠️  Skipping boundary ${i + 1}: start page ${startPage + 1} exceeds total pages ${totalPages}`);
        continue;
      }

      console.log(`📋 Creating invoice ${i + 1}: pages ${startPage + 1} to ${endPage + 1}`);

      // Create new PDF for this invoice
      const newPdf = await PDFDocument.create();

      // Copy pages for this invoice
      const pages: number[] = [];
      for (let p = startPage; p <= endPage; p++) {
        pages.push(p + 1); // Store 1-indexed page numbers
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [p]);
        newPdf.addPage(copiedPage);
      }

      // Save as buffer
      const pdfBytes = await newPdf.save();
      const buffer = Buffer.from(pdfBytes);

      splitInvoices.push({
        pages,
        pdfBuffer: buffer
      });

      console.log(`✅ Created invoice PDF with ${pages.length} page(s)`);
    }

    console.log(`✅ Split PDF into ${splitInvoices.length} separate invoice(s)`);
    return splitInvoices;

  } catch (error: any) {
    console.error('Error splitting PDF:', error);
    throw new Error(`Failed to split PDF: ${error.message}`);
  }
}

/**
 * Main function: detect and split a PDF into separate invoices
 */
export async function detectAndSplitInvoices(
  pdfBuffer: Buffer
): Promise<SplitInvoice[]> {
  // Step 1: Detect boundaries (using 2-page chunks)
  const boundaries = await detectInvoiceBoundaries(pdfBuffer);

  // Step 2: Split PDF
  const splitInvoices = await splitPdfByPages(pdfBuffer, boundaries);

  return splitInvoices;
}
