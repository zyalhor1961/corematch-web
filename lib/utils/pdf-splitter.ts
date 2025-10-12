/**
 * PDF Splitter Utility
 *
 * Splits multi-invoice PDFs into separate invoices based on page analysis
 */

import { PDFDocument } from 'pdf-lib';
import { analyzeDocument, AzurePrebuiltModel } from '@/lib/services/azure-document-intelligence';

export interface InvoiceBoundary {
  startPage: number; // 1-indexed
  endPage: number;   // 1-indexed
  reason: string;
}

export interface SplitInvoice {
  pages: number[];
  pdfBuffer: Buffer;
  invoiceNumber?: string;
}

/**
 * Detect invoice boundaries in a PDF by analyzing text content
 * Uses Azure Layout model to extract text per page
 */
export async function detectInvoiceBoundaries(
  pdfUrl: string
): Promise<InvoiceBoundary[]> {
  try {
    console.log('🔍 Detecting invoice boundaries...');

    // Use Layout model to get text from all pages
    const result = await analyzeDocument(pdfUrl, AzurePrebuiltModel.LAYOUT);

    if (!result.pages || result.pages.length === 0) {
      throw new Error('No pages detected in PDF');
    }

    console.log(`📄 Analyzing ${result.pages.length} pages for invoice boundaries`);

    const boundaries: InvoiceBoundary[] = [];
    let currentInvoiceStart = 1;

    for (let i = 0; i < result.pages.length; i++) {
      const page = result.pages[i];
      const pageNumber = page.pageNumber;

      // Get all text from this page
      const pageText = page.lines.map(line => line.content).join(' ').toLowerCase();

      // Check for invoice indicators (new invoice starting)
      const hasInvoiceHeader =
        pageText.includes('invoice') ||
        pageText.includes('facture') ||
        pageText.includes('invoice number') ||
        pageText.includes('numéro de facture') ||
        pageText.includes('n° facture');

      const hasTotal =
        pageText.includes('total') ||
        pageText.includes('amount due') ||
        pageText.includes('montant total') ||
        pageText.includes('total à payer');

      // If we find an invoice header and we're not on the first page
      // and the previous page had a total, this is likely a new invoice
      if (i > 0 && hasInvoiceHeader && hasTotal) {
        const prevPage = result.pages[i - 1];
        const prevPageText = prevPage.lines.map(line => line.content).join(' ').toLowerCase();
        const prevHasTotal =
          prevPageText.includes('total') ||
          prevPageText.includes('amount due') ||
          prevPageText.includes('montant total');

        if (prevHasTotal) {
          // Previous invoice ends at previous page
          boundaries.push({
            startPage: currentInvoiceStart,
            endPage: pageNumber - 1,
            reason: 'Detected total on previous page and invoice header on current page'
          });
          currentInvoiceStart = pageNumber;
          console.log(`✂️  Detected invoice boundary: Pages ${currentInvoiceStart - (pageNumber - currentInvoiceStart)} to ${pageNumber - 1}`);
        }
      }
    }

    // Add the last invoice
    boundaries.push({
      startPage: currentInvoiceStart,
      endPage: result.pages.length,
      reason: 'Last invoice in PDF'
    });

    console.log(`✅ Detected ${boundaries.length} invoice(s) in PDF`);
    return boundaries;

  } catch (error: any) {
    console.error('Error detecting invoice boundaries:', error);
    // Fallback: treat entire PDF as one invoice
    return [{
      startPage: 1,
      endPage: 999, // Will be limited by actual page count
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
  pdfBuffer: Buffer,
  pdfUrl: string
): Promise<SplitInvoice[]> {
  // Step 1: Detect boundaries
  const boundaries = await detectInvoiceBoundaries(pdfUrl);

  // Step 2: Split PDF
  const splitInvoices = await splitPdfByPages(pdfBuffer, boundaries);

  return splitInvoices;
}
