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
 * Detect invoice boundaries using Azure Invoice model (Pass 1)
 * Azure detects multiple invoices and tells us which pages belong to each
 */
export async function detectInvoiceBoundaries(
  pdfUrl: string
): Promise<InvoiceBoundary[]> {
  try {
    console.log('🔍 Pass 1: Detecting invoice boundaries using Azure Invoice model...');

    // Send whole PDF to Azure Invoice model
    const result = await analyzeDocument(pdfUrl, AzurePrebuiltModel.INVOICE);

    if (!result.pages || result.pages.length === 0) {
      throw new Error('No pages detected in PDF');
    }

    const totalPages = result.pages.length;
    console.log(`📄 PDF has ${totalPages} total pages`);

    // Group fields by document index to find page ranges
    const pagesByDoc: Map<number, Set<number>> = new Map();

    for (const field of result.fields) {
      // Check for Doc1_, Doc2_, Doc3_ prefixes
      const match = field.name.match(/^Doc(\d+)_/);
      const docIndex = match ? parseInt(match[1]) : 1;
      const pageNum = field.pageNumber || 1;

      if (!pagesByDoc.has(docIndex)) {
        pagesByDoc.set(docIndex, new Set());
      }
      pagesByDoc.get(docIndex)!.add(pageNum);
    }

    const boundaries: InvoiceBoundary[] = [];

    if (pagesByDoc.size > 1) {
      // Multiple invoices detected
      console.log(`✅ Azure detected ${pagesByDoc.size} invoice(s) in PDF`);

      // Sort by document index
      const sortedDocs = Array.from(pagesByDoc.entries()).sort((a, b) => a[0] - b[0]);

      for (const [docIndex, pages] of sortedDocs) {
        const pageArray = Array.from(pages).sort((a, b) => a - b);
        const startPage = Math.min(...pageArray);
        const endPage = Math.max(...pageArray);

        boundaries.push({
          startPage,
          endPage,
          documentIndex: docIndex,
          reason: `Azure detected invoice ${docIndex}: pages ${startPage}-${endPage} (${pageArray.length} pages)`
        });

        console.log(`📋 Invoice ${docIndex}: Pages ${startPage}-${endPage} (${pageArray.length} pages)`);
      }
    } else {
      // Single invoice
      console.log('📄 Single invoice detected in PDF');
      boundaries.push({
        startPage: 1,
        endPage: totalPages,
        documentIndex: 1,
        reason: `Single invoice: pages 1-${totalPages}`
      });
    }

    console.log(`✅ Pass 1 complete: Detected ${boundaries.length} invoice(s)`);
    return boundaries;

  } catch (error: any) {
    console.error('Error detecting invoice boundaries:', error);
    // Fallback: treat entire PDF as one invoice
    return [{
      startPage: 1,
      endPage: 999,
      documentIndex: 1,
      reason: 'Fallback - treating entire PDF as one invoice due to error'
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
 *
 * Two-pass approach:
 * Pass 1: Send whole PDF to Azure to detect invoice boundaries
 * Pass 2: Split PDF based on detected boundaries
 */
export async function detectAndSplitInvoices(
  pdfBuffer: Buffer,
  pdfUrl: string
): Promise<SplitInvoice[]> {
  // Pass 1: Detect boundaries by sending whole PDF to Azure
  const boundaries = await detectInvoiceBoundaries(pdfUrl);

  // Pass 2: Split PDF based on detected boundaries
  const splitInvoices = await splitPdfByPages(pdfBuffer, boundaries);

  return splitInvoices;
}
