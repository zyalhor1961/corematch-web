/**
 * Azure Document Intelligence Extractor
 * Two-level extraction strategy:
 * - Level 1: prebuilt-document for ALL documents (full text, pages, tables)
 * - Level 2: prebuilt-invoice only for invoices (structured invoice fields)
 */

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { getSecret } from '@/lib/secrets/1password';
import type { DAFExtractor, DAFExtractionResult, GenericExtractionResult, DocumentType } from './types';
import { enrichWithGPT } from './gpt-enrichment';

export class AzureDIExtractor implements DAFExtractor {
  name = 'azure-di';

  /**
   * Helper to extract numeric value from Azure DI field
   * Azure DI peut retourner soit un nombre simple, soit un objet complexe comme :
   * { amount: 20, currencySymbol: "$", currencyCode: "USD" }
   */
  private extractNumericValue(fieldValue: any): number | undefined {
    if (fieldValue === undefined || fieldValue === null) {
      return undefined;
    }

    // Si c'est déjà un nombre, le retourner
    if (typeof fieldValue === 'number') {
      return fieldValue;
    }

    // Si c'est un objet avec une propriété "amount"
    if (typeof fieldValue === 'object' && 'amount' in fieldValue) {
      return typeof fieldValue.amount === 'number' ? fieldValue.amount : undefined;
    }

    // Si c'est une string, essayer de parser
    if (typeof fieldValue === 'string') {
      const parsed = parseFloat(fieldValue.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  }

  /**
   * Helper to extract string value from Azure DI field
   */
  private extractStringValue(fieldValue: any): string | undefined {
    if (fieldValue === undefined || fieldValue === null) {
      return undefined;
    }

    if (typeof fieldValue === 'string') {
      return fieldValue;
    }

    if (typeof fieldValue === 'object') {
      // Try 'content' first
      if ('content' in fieldValue && fieldValue.content) {
        return String(fieldValue.content);
      }
      // Try 'value'
      if ('value' in fieldValue && fieldValue.value) {
        return String(fieldValue.value);
      }
      // If it's an address object with structured fields
      if ('streetAddress' in fieldValue || 'city' in fieldValue) {
        const parts = [];
        if (fieldValue.streetAddress) parts.push(fieldValue.streetAddress);
        if (fieldValue.city) parts.push(fieldValue.city);
        if (fieldValue.state) parts.push(fieldValue.state);
        if (fieldValue.postalCode) parts.push(fieldValue.postalCode);
        if (fieldValue.country) parts.push(fieldValue.country);
        return parts.join(', ');
      }
      // Fallback: try to stringify but avoid [object Object]
      return undefined;
    }

    return String(fieldValue);
  }

  /**
   * Get configured Azure Document Intelligence client
   */
  private getAzureClient(): DocumentAnalysisClient {
    // Get Azure credentials - prefer OLD working vars, fall back to new ones
    let endpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT || process.env.AZURE_DI_ENDPOINT;
    let apiKey = process.env.AZURE_FORM_RECOGNIZER_KEY || process.env.AZURE_DI_API_KEY;

    if (!endpoint || !apiKey) {
      throw new Error('Azure Document Intelligence credentials not found. Set AZURE_DI_ENDPOINT and AZURE_DI_API_KEY (or AZURE_FORM_RECOGNIZER_*)');
    }

    // Clean endpoint: remove quotes, newlines, trailing slashes
    endpoint = endpoint
      .replace(/^["']|["']$/g, '')  // Remove surrounding quotes
      .replace(/\\n/g, '')           // Remove literal \n
      .replace(/\n/g, '')            // Remove actual newlines
      .replace(/\/+$/, '')           // Remove trailing slashes
      .trim();

    // Clean API key: remove quotes, newlines, whitespace
    apiKey = apiKey
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '')
      .replace(/\n/g, '')
      .trim();

    return new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(apiKey)
    );
  }

  /**
   * Detect document type based on content heuristics
   */
  private detectDocumentType(fullText: string, fileName: string): { type: DocumentType; confidence: number } {
    const textLower = fullText.toLowerCase();
    const fileNameLower = fileName.toLowerCase();

    // Invoice detection keywords
    const invoiceKeywords = ['facture', 'invoice', 'montant ttc', 'montant ht', 'tva', 'total', 'échéance', 'due date', 'payment'];
    const invoiceScore = invoiceKeywords.filter(kw => textLower.includes(kw)).length;

    // CV detection keywords
    const cvKeywords = ['cv', 'curriculum', 'experience', 'expérience', 'formation', 'education', 'compétences', 'skills', 'diplôme'];
    const cvScore = cvKeywords.filter(kw => textLower.includes(kw) || fileNameLower.includes(kw)).length;

    // Contract detection keywords
    const contractKeywords = ['contrat', 'contract', 'agreement', 'signé', 'signed', 'parties', 'clause', 'article', 'conditions générales'];
    const contractScore = contractKeywords.filter(kw => textLower.includes(kw)).length;

    // Determine type based on scores
    const scores: Array<{ type: DocumentType; score: number }> = [
      { type: 'invoice', score: invoiceScore },
      { type: 'cv', score: cvScore },
      { type: 'contract', score: contractScore },
    ];

    const best = scores.sort((a, b) => b.score - a.score)[0];

    if (best.score >= 2) {
      return { type: best.type, confidence: Math.min(best.score / 5, 0.95) };
    }

    return { type: 'other', confidence: 0.5 };
  }

  /**
   * LEVEL 1: Generic extraction using prebuilt-document
   * Works for ALL document types (CV, contracts, invoices, etc.)
   */
  async extractGeneric(fileBuffer: ArrayBuffer, fileName: string): Promise<GenericExtractionResult> {
    const startTime = Date.now();

    try {
      const azureClient = this.getAzureClient();

      console.log(`[Azure DI L1] Starting generic extraction for: ${fileName}`);

      // Use prebuilt-document for generic extraction
      const poller = await azureClient.beginAnalyzeDocument(
        'prebuilt-document',
        fileBuffer
      );

      const result = await poller.pollUntilDone();

      // Extract full text
      const fullText = result.content || '';
      console.log(`[Azure DI L1] Extracted ${fullText.length} characters of text`);

      // Extract pages information
      const pages = (result.pages || []).map((page, idx) => ({
        page_number: idx + 1,
        width: page.width || 0,
        height: page.height || 0,
        unit: page.unit || 'inch',
        lines: (page.lines || []).map(line => ({
          content: line.content || '',
          polygon: line.polygon ? line.polygon.flatMap(p => [p.x, p.y]) : undefined,
        })),
      }));

      // Extract tables
      const tables = (result.tables || []).map(table => ({
        row_count: table.rowCount || 0,
        column_count: table.columnCount || 0,
        cells: (table.cells || []).map(cell => ({
          row_index: cell.rowIndex || 0,
          column_index: cell.columnIndex || 0,
          content: cell.content || '',
          kind: cell.kind,
        })),
      }));

      // Detect document type
      const { type: detectedType, confidence: typeConfidence } = this.detectDocumentType(fullText, fileName);

      console.log(`[Azure DI L1] Detected document type: ${detectedType} (confidence: ${typeConfidence})`);
      console.log(`[Azure DI L1] Found ${pages.length} pages, ${tables.length} tables`);

      return {
        success: true,
        provider: 'azure-di',
        full_text: fullText,
        pages,
        tables: tables.length > 0 ? tables : undefined,
        detected_type: detectedType,
        type_confidence: typeConfidence,
        extraction_duration_ms: Date.now() - startTime,
      };

    } catch (error) {
      console.error('[Azure DI L1] Generic extraction failed:', error);

      return {
        success: false,
        provider: 'azure-di',
        full_text: '',
        pages: [],
        detected_type: 'other',
        type_confidence: 0,
        extraction_duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * LEVEL 2: Invoice-specific extraction using prebuilt-invoice
   * Only called when document is detected as an invoice
   */
  async extractInvoice(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult> {
    const startTime = Date.now();

    try {
      const azureClient = this.getAzureClient();

      console.log(`[Azure DI L2] Starting invoice-specific extraction for: ${fileName}`);

      // Analyze document with prebuilt-invoice model
      const poller = await azureClient.beginAnalyzeDocument(
        'prebuilt-invoice',
        fileBuffer
      );

      const result = await poller.pollUntilDone();

      if (!result.documents || result.documents.length === 0) {
        throw new Error('No document found in analysis result');
      }

      const document = result.documents[0];
      const fields = document.fields;

      // Log ALL field names detected by Azure to debug missing emails
      console.log('[Azure DI] All detected field names:', Object.keys(fields || {}));
      console.log('[Azure DI] Total fields detected:', Object.keys(fields || {}).length);

      // Debug: Log email fields specifically if they exist
      if (fields?.VendorEmail) {
        console.log('[Azure DI] VendorEmail field structure:', JSON.stringify(fields.VendorEmail, null, 2));
      } else {
        console.log('[Azure DI] VendorEmail NOT found in fields');
      }

      if (fields?.CustomerEmail) {
        console.log('[Azure DI] CustomerEmail field structure:', JSON.stringify(fields.CustomerEmail, null, 2));
      } else {
        console.log('[Azure DI] CustomerEmail NOT found in fields');
      }

      // Extract numeric values (handles both simple numbers and complex objects)
      const montantHT = this.extractNumericValue(fields?.SubTotal?.value);
      const montantTTC = this.extractNumericValue(fields?.InvoiceTotal?.value);
      const totalTax = this.extractNumericValue(fields?.TotalTax?.value);

      // Calculate TVA rate if possible
      let tauxTVA: number | undefined = undefined;
      if (totalTax && montantHT && montantHT > 0) {
        tauxTVA = (totalTax / montantHT) * 100;
      }

      // Extract string values
      const numeroFacture = this.extractStringValue(fields?.InvoiceId?.value);
      const fournisseur = this.extractStringValue(fields?.VendorName?.value);
      const clientName = this.extractStringValue(fields?.CustomerName?.value);
      const adresseFournisseur = this.extractStringValue(fields?.VendorAddress?.value);
      const adresseClient = this.extractStringValue(fields?.CustomerAddress?.value);
      const emailFournisseur = this.extractStringValue(fields?.VendorEmail?.value);
      const emailClient = this.extractStringValue(fields?.CustomerEmail?.value);
      const numeroCommande = this.extractStringValue(fields?.PurchaseOrder?.value);
      const conditionsPaiement = this.extractStringValue(fields?.PaymentTerm?.value);

      // Extract dates (Azure DI retourne des objets Date)
      const dateDocument = fields?.InvoiceDate?.value instanceof Date
        ? fields.InvoiceDate.value.toISOString().split('T')[0]
        : this.extractStringValue(fields?.InvoiceDate?.value);

      const dateEcheance = fields?.DueDate?.value instanceof Date
        ? fields.DueDate.value.toISOString().split('T')[0]
        : this.extractStringValue(fields?.DueDate?.value);

      // Extract line items (items/descriptions)
      const items: any[] = [];

      console.log('[Azure DI] Checking for Items field...');
      console.log('[Azure DI] Items exists?', !!fields?.Items);

      if (fields?.Items) {
        console.log('[Azure DI] Items object keys:', Object.keys(fields.Items));
        console.log('[Azure DI] Items.value type:', typeof fields?.Items?.value);
        console.log('[Azure DI] Items.valueArray type:', typeof fields?.Items?.valueArray);
        console.log('[Azure DI] Items.kind:', fields?.Items?.kind);

        // Try multiple possible structures
        let itemsArray = fields.Items.value || fields.Items.valueArray || fields.Items.values;

        console.log('[Azure DI] itemsArray type:', typeof itemsArray);
        console.log('[Azure DI] itemsArray is array?', Array.isArray(itemsArray));

        if (Array.isArray(itemsArray)) {
          console.log('[Azure DI] Found', itemsArray.length, 'items');

          for (let i = 0; i < itemsArray.length; i++) {
            const item = itemsArray[i];
            console.log(`[Azure DI] Item ${i} structure:`, JSON.stringify(item, null, 2).substring(0, 500));

            // Try different access patterns
            const itemFields = item.value || item.properties || item;
            console.log(`[Azure DI] Item ${i} fields keys:`, Object.keys(itemFields || {}));

            if (itemFields) {
              items.push({
                description: this.extractStringValue(itemFields.Description?.value || itemFields.Description?.content),
                quantite: this.extractNumericValue(itemFields.Quantity?.value || itemFields.Quantity?.content),
                prix_unitaire: this.extractNumericValue(itemFields.UnitPrice?.value || itemFields.UnitPrice?.content),
                montant: this.extractNumericValue(itemFields.Amount?.value || itemFields.Amount?.content),
              });
            }
          }
        } else {
          console.log('[Azure DI] Items is not an array, structure:', JSON.stringify(fields.Items, null, 2).substring(0, 500));
        }
      } else {
        console.log('[Azure DI] No Items field found in Azure response');
      }

      console.log('[Azure DI] Extracted', items.length, 'items:', items);

      // Extract bounding boxes for all fields
      const fieldPositions: any[] = [];

      // Helper to convert Azure polygon to flat array
      const polygonToArray = (polygon: any): number[] | undefined => {
        if (!polygon || !Array.isArray(polygon)) return undefined;
        const flatArray: number[] = [];
        for (const point of polygon) {
          if (point.x !== undefined && point.y !== undefined) {
            flatArray.push(point.x, point.y);
          }
        }
        return flatArray.length >= 4 ? flatArray : undefined;
      };

      // Extract bounding box for the entire Items table (if exists)
      if (fields?.Items && fields.Items.boundingRegions && fields.Items.boundingRegions.length > 0) {
        const itemsBoundingRegion = fields.Items.boundingRegions[0];
        const itemsPolygon = polygonToArray(itemsBoundingRegion.polygon);

        if (itemsPolygon) {
          console.log('[Azure DI] Found Items table bounding box');
          fieldPositions.push({
            field: 'items_table',
            page: (itemsBoundingRegion.pageNumber || 1) - 1,
            polygon: itemsPolygon,
            text: `Table avec ${items.length} lignes`,
            confidence: fields.Items.confidence || 0
          });
        }
      } else {
        console.log('[Azure DI] No bounding region found for Items table');
      }

      // Extract bounding boxes for each field with mapping to DAF field names
      const fieldMapping: { [key: string]: string } = {
        'InvoiceId': 'numero_facture',
        'VendorName': 'fournisseur',
        'CustomerName': 'client',
        'VendorAddress': 'adresse_fournisseur',
        'CustomerAddress': 'adresse_client',
        'VendorEmail': 'email_fournisseur',
        'CustomerEmail': 'email_client',
        'PurchaseOrder': 'numero_commande',
        'PaymentTerm': 'conditions_paiement',
        'InvoiceTotal': 'montant_ttc',
        'SubTotal': 'montant_ht',
        'TotalTax': 'taux_tva',
        'InvoiceDate': 'date_document',
        'DueDate': 'date_echeance',
      };

      for (const [azureFieldName, field] of Object.entries(fields || {})) {
        if (field && field.boundingRegions && field.boundingRegions.length > 0) {
          const boundingRegion = field.boundingRegions[0];
          const polygon = polygonToArray(boundingRegion.polygon);

          if (polygon) {
            const dafFieldName = fieldMapping[azureFieldName] || azureFieldName;
            fieldPositions.push({
              field: dafFieldName,
              page: (boundingRegion.pageNumber || 1) - 1, // Convert to 0-indexed
              polygon: polygon,
              text: String(field.content || field.value || ''),
              confidence: field.confidence || 0
            });
          }
        }
      }

      // ======== GPT POST-PROCESSING ENRICHMENT ========
      // Extract full text from PDF for GPT analysis
      const pdfText = result.content || '';
      console.log(`[Azure DI] Extracted ${pdfText.length} chars of text for GPT enrichment`);

      // Call GPT to enrich missing fields (emails, etc.)
      const gptEnriched = await enrichWithGPT({
        azureFields: fields || {},
        pdfText: pdfText,
        fileName: fileName
      });

      // Merge GPT enriched data with Azure extracted data
      // GPT fields override Azure fields only if Azure didn't find them
      const finalEmailFournisseur = emailFournisseur || gptEnriched.email_fournisseur;
      const finalEmailClient = emailClient || gptEnriched.email_client;
      const finalNumeroCommande = numeroCommande || gptEnriched.numero_commande;
      const finalConditionsPaiement = conditionsPaiement || gptEnriched.conditions_paiement;

      console.log('[Azure DI] Email fournisseur:', emailFournisseur, '→ GPT:', gptEnriched.email_fournisseur, '→ Final:', finalEmailFournisseur);
      console.log('[Azure DI] Email client:', emailClient, '→ GPT:', gptEnriched.email_client, '→ Final:', finalEmailClient);

      // Extract fields from Azure response
      const extractedData: DAFExtractionResult = {
        success: true,
        provider: 'azure-di',
        confidence: document.confidence || 0.7,
        document_type: 'invoice', // This is invoice-specific extraction
        full_text: pdfText,
        montant_ht: montantHT,
        montant_ttc: montantTTC,
        taux_tva: tauxTVA,
        date_document: dateDocument,
        date_echeance: dateEcheance,
        numero_facture: numeroFacture,
        fournisseur: fournisseur,
        client: clientName,
        adresse_fournisseur: adresseFournisseur,
        adresse_client: adresseClient,
        email_fournisseur: finalEmailFournisseur,
        email_client: finalEmailClient,
        numero_commande: finalNumeroCommande,
        conditions_paiement: finalConditionsPaiement,
        items: items.length > 0 ? items : undefined,
        extraction_duration_ms: Date.now() - startTime,
        raw_response: {
          ...document,
          content: pdfText, // Include full text for RAG embeddings
        },
        field_positions: fieldPositions, // Add bounding boxes
      };

      console.log(`[Azure DI L2] Invoice extraction completed in ${extractedData.extraction_duration_ms}ms (confidence: ${extractedData.confidence})`);
      console.log(`[Azure DI L2] Extracted: montant_ttc=${montantTTC}, montant_ht=${montantHT}, fournisseur="${fournisseur}"`);
      console.log(`[Azure DI L2] Found ${fieldPositions.length} bounding boxes`);

      return extractedData;

    } catch (error) {
      console.error('[Azure DI L2] Invoice extraction failed:', error);

      return {
        success: false,
        provider: 'azure-di',
        confidence: 0,
        document_type: 'invoice',
        extraction_duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * MAIN EXTRACTION METHOD - Two-level strategy
   * 1. Always run generic extraction (prebuilt-document) for ALL documents
   * 2. If document is detected as invoice, additionally run invoice extraction
   * 3. Merge results from both levels
   */
  async extractDocument(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult> {
    const startTime = Date.now();

    console.log(`[Azure DI] Starting two-level extraction for: ${fileName}`);

    // ============ LEVEL 1: Generic extraction for ALL documents ============
    const genericResult = await this.extractGeneric(fileBuffer, fileName);

    if (!genericResult.success) {
      console.error('[Azure DI] Level 1 (generic) extraction failed, aborting');
      return {
        success: false,
        provider: 'azure-di',
        confidence: 0,
        document_type: 'other',
        full_text: '',
        extraction_duration_ms: Date.now() - startTime,
        error: genericResult.error || 'Generic extraction failed',
      };
    }

    console.log(`[Azure DI] Level 1 complete: ${genericResult.detected_type} (${genericResult.type_confidence * 100}% confidence)`);
    console.log(`[Azure DI] Full text: ${genericResult.full_text.length} chars, ${genericResult.pages.length} pages, ${genericResult.tables?.length || 0} tables`);

    // ============ LEVEL 2: Invoice-specific extraction (conditional) ============
    // Only run invoice extraction if document is detected as invoice (or high heuristic match)
    const isInvoice = genericResult.detected_type === 'invoice' && genericResult.type_confidence >= 0.4;

    if (isInvoice) {
      console.log('[Azure DI] Document detected as invoice, running Level 2 extraction...');

      const invoiceResult = await this.extractInvoice(fileBuffer, fileName);

      if (invoiceResult.success) {
        // Merge Level 1 + Level 2 results
        const mergedResult: DAFExtractionResult = {
          ...invoiceResult,
          // Override with Level 1 generic data
          document_type: 'invoice',
          full_text: genericResult.full_text, // Use L1's full text (more complete)
          pages: genericResult.pages,
          tables: genericResult.tables,
          extraction_duration_ms: Date.now() - startTime,
        };

        console.log(`[Azure DI] Two-level extraction complete: invoice with ${mergedResult.items?.length || 0} items`);
        return mergedResult;
      } else {
        console.warn('[Azure DI] Level 2 (invoice) extraction failed, returning Level 1 data only');
      }
    } else {
      console.log(`[Azure DI] Document is ${genericResult.detected_type}, skipping invoice extraction`);
    }

    // Return generic-only result for non-invoices (CV, contracts, etc.)
    const genericOnlyResult: DAFExtractionResult = {
      success: true,
      provider: 'azure-di',
      confidence: genericResult.type_confidence,
      document_type: genericResult.detected_type,
      full_text: genericResult.full_text,
      pages: genericResult.pages,
      tables: genericResult.tables,
      extraction_duration_ms: Date.now() - startTime,
      raw_response: {
        content: genericResult.full_text,
        pages: genericResult.pages,
        tables: genericResult.tables,
      },
    };

    console.log(`[Azure DI] Extraction complete: ${genericResult.detected_type} document with ${genericResult.full_text.length} chars`);
    return genericOnlyResult;
  }
}
