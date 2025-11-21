/**
 * Azure Document Intelligence Extractor
 * Provider fallback pour l'extraction DAF
 */

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { getSecret } from '@/lib/secrets/1password';
import type { DAFExtractor, DAFExtractionResult } from './types';
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

  async extractDocument(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult> {
    const startTime = Date.now();

    try {
      // Get Azure credentials from 1Password
      let endpoint = await getSecret('AZURE_DI_ENDPOINT');
      const apiKey = await getSecret('AZURE_DI_API_KEY');

      if (!endpoint || !apiKey) {
        throw new Error('Azure Document Intelligence credentials not found in 1Password');
      }

      // Remove trailing slash to prevent double-slash in URL
      endpoint = endpoint.replace(/\/+$/, '');

      // Debug: Log endpoint format (masked API key)
      console.log(`[Azure DI] Endpoint: ${endpoint}`);
      console.log(`[Azure DI] API Key length: ${apiKey.length} chars, starts with: ${apiKey.substring(0, 4)}...`);

      const azureClient = new DocumentAnalysisClient(
        endpoint,
        new AzureKeyCredential(apiKey)
      );

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

      console.log(`[Azure DI] Extraction completed in ${extractedData.extraction_duration_ms}ms (confidence: ${extractedData.confidence})`);
      console.log(`[Azure DI] Extracted: montant_ttc=${montantTTC}, montant_ht=${montantHT}, fournisseur="${fournisseur}"`);
      console.log(`[Azure DI] Found ${fieldPositions.length} bounding boxes`);

      return extractedData;

    } catch (error) {
      console.error('[Azure DI] Extraction failed:', error);

      return {
        success: false,
        provider: 'azure-di',
        confidence: 0,
        extraction_duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
