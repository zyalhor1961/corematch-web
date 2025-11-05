/**
 * Simple Text Extractor for Native PDFs
 *
 * Extrait les données comptables depuis PDFs natifs en utilisant
 * des patterns regex (GRATUIT, pas d'API externe)
 *
 * Utilisé pour les PDFs natifs (texte sélectionnable) pour économiser
 * les coûts Landing AI / Azure DI
 */

import { extractPDFTextWithPositions, type TextPosition } from './pdf-detector';
import { extractPDFMetadata } from './pdf-metadata-extractor';
import { generateProfessionalMarkdown } from './markdown-generator';
import type { DAFExtractor, DAFExtractionResult, FieldBoundingBox } from './types';

/**
 * Nettoie le texte pour supprimer les caractères null
 */
function cleanText(text: string | undefined): string | undefined {
  if (!text) return undefined;

  return text
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim() || undefined;
}

export class SimpleTextExtractor implements DAFExtractor {
  name = 'simple-text';

  /**
   * Patterns regex pour extraction de champs
   */
  private patterns = {
    // Montants
    montantTTC: [
      /total\s*ttc\s*:?\s*([0-9\s,.]+)\s*€?/gi,
      /montant\s*total\s*:?\s*([0-9\s,.]+)\s*€?/gi,
      /total\s*à\s*payer\s*:?\s*([0-9\s,.]+)\s*€?/gi,
      /net\s*à\s*payer\s*:?\s*([0-9\s,.]+)\s*€?/gi,
    ],
    montantHT: [
      /total\s*ht\s*:?\s*([0-9\s,.]+)\s*€?/gi,
      /montant\s*ht\s*:?\s*([0-9\s,.]+)\s*€?/gi,
      /sous-total\s*:?\s*([0-9\s,.]+)\s*€?/gi,
    ],
    tva: [
      /tva\s*\(?([0-9,.]+)\s*%?\)?/gi,
      /t\.v\.a\s*\(?([0-9,.]+)\s*%?\)?/gi,
    ],
    numeroFacture: [
      /facture\s*n°?\s*:?\s*([A-Z0-9\-\/]+)/gi,
      /invoice\s*(?:no|number)\s*:?\s*([A-Z0-9\-\/]+)/gi,
      /n°\s*facture\s*:?\s*([A-Z0-9\-\/]+)/gi,
      /référence\s*:?\s*([A-Z0-9\-\/]+)/gi,
    ],
    date: [
      /date\s*(?:de\s*)?facture\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
      /date\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
      /émise?\s*le\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
    ],
    dateEcheance: [
      /échéance\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
      /date\s*limite\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
      /paiement\s*avant\s*le\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
    ],
  };

  /**
   * Trouve les positions dans le PDF pour un texte donné
   */
  private findTextPositions(searchText: string, positions: TextPosition[]): FieldBoundingBox[] {
    const found: FieldBoundingBox[] = [];

    // Normaliser le texte recherché
    const normalizedSearch = searchText.toLowerCase().trim();

    // Chercher dans les positions
    for (const pos of positions) {
      const normalizedText = pos.text.toLowerCase().trim();

      if (normalizedText.includes(normalizedSearch) || normalizedSearch.includes(normalizedText)) {
        found.push({
          field: 'detected',
          page: pos.page,
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
          text: pos.text,
        });
      }
    }

    return found;
  }

  async extractDocument(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult> {
    const startTime = Date.now();

    try {
      console.log(`[Simple Text] Extracting from ${fileName}...`);

      // Extraire le texte avec positions du PDF
      const { text, positions, metadata } = await extractPDFTextWithPositions(fileBuffer);

      if (!text || text.length < 50) {
        throw new Error('PDF contains insufficient text for extraction');
      }

      console.log(`[Simple Text] Extracted ${text.length} characters with ${positions.length} text positions`);

      // Extraire les métadonnées complètes du PDF
      const pdfMetadata = await extractPDFMetadata(fileBuffer);

      // Extraire les champs avec regex
      const montantTTC = this.extractMontant(text, this.patterns.montantTTC);
      const montantHT = this.extractMontant(text, this.patterns.montantHT);
      const tauxTVA = this.extractTaux(text, this.patterns.tva);
      const numeroFacture = this.extractString(text, this.patterns.numeroFacture);
      const dateDocument = this.extractDate(text, this.patterns.date);
      const dateEcheance = this.extractDate(text, this.patterns.dateEcheance);
      const fournisseur = this.extractFournisseur(text);

      // Données extraites (nettoyées)
      const extracted = {
        montant_ht: montantHT,
        montant_ttc: montantTTC,
        taux_tva: tauxTVA,
        date_document: dateDocument,
        date_echeance: dateEcheance,
        numero_facture: cleanText(numeroFacture),
        fournisseur: cleanText(fournisseur),
      };

      // Trouver les positions des champs extraits (pour bounding boxes)
      const fieldPositions: FieldBoundingBox[] = [];

      if (numeroFacture) {
        const boxes = this.findTextPositions(numeroFacture, positions);
        boxes.forEach(box => { box.field = 'numero_facture'; fieldPositions.push(box); });
      }

      if (fournisseur) {
        const boxes = this.findTextPositions(fournisseur, positions);
        boxes.forEach(box => { box.field = 'fournisseur'; fieldPositions.push(box); });
      }

      if (montantTTC) {
        const boxes = this.findTextPositions(montantTTC.toString(), positions);
        boxes.forEach(box => { box.field = 'montant_ttc'; fieldPositions.push(box); });
      }

      if (montantHT) {
        const boxes = this.findTextPositions(montantHT.toString(), positions);
        boxes.forEach(box => { box.field = 'montant_ht'; fieldPositions.push(box); });
      }

      if (tauxTVA) {
        const boxes = this.findTextPositions(tauxTVA.toString(), positions);
        boxes.forEach(box => { box.field = 'taux_tva'; fieldPositions.push(box); });
      }

      if (dateDocument) {
        const boxes = this.findTextPositions(dateDocument, positions);
        boxes.forEach(box => { box.field = 'date_document'; fieldPositions.push(box); });
      }

      if (dateEcheance) {
        const boxes = this.findTextPositions(dateEcheance, positions);
        boxes.forEach(box => { box.field = 'date_echeance'; fieldPositions.push(box); });
      }

      console.log(`[Simple Text] Found ${fieldPositions.length} bounding boxes`);

      // Générer JSON + Markdown professionnel (style Landing AI)
      const markdown = generateProfessionalMarkdown(extracted, pdfMetadata, text);
      const json = JSON.stringify(extracted, null, 2);

      const result: DAFExtractionResult = {
        success: true,
        provider: 'simple-text',
        confidence: this.calculateConfidence(extracted),
        ...extracted,
        field_positions: fieldPositions,
        extraction_duration_ms: Date.now() - startTime,
        raw_response: {
          text,
          extracted,
          markdown,
          json,
          metadata,
          positions, // Include all positions for debugging
        },
      };

      console.log(`[Simple Text] ✓ Extraction completed in ${result.extraction_duration_ms}ms`);
      console.log(`[Simple Text] Extracted: ${json}`);

      return result;

    } catch (error) {
      console.error('[Simple Text] ✗ Extraction failed:', error);

      return {
        success: false,
        provider: 'simple-text',
        confidence: 0,
        extraction_duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extrait un montant numérique du texte
   */
  private extractMontant(text: string, patterns: RegExp[]): number | undefined {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        // Nettoyer le montant : enlever espaces, remplacer virgule par point
        const cleaned = match[1].replace(/\s/g, '').replace(',', '.');
        const amount = parseFloat(cleaned);
        if (!isNaN(amount)) {
          return amount;
        }
      }
    }
    return undefined;
  }

  /**
   * Extrait un taux (%)
   */
  private extractTaux(text: string, patterns: RegExp[]): number | undefined {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const cleaned = match[1].replace(',', '.');
        const rate = parseFloat(cleaned);
        if (!isNaN(rate)) {
          return rate;
        }
      }
    }
    return undefined;
  }

  /**
   * Extrait une chaîne de caractères
   */
  private extractString(text: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * Extrait une date et la normalise en YYYY-MM-DD
   */
  private extractDate(text: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const dateStr = match[1];
        const normalized = this.normalizeDate(dateStr);
        if (normalized) {
          return normalized;
        }
      }
    }
    return undefined;
  }

  /**
   * Normalise une date au format YYYY-MM-DD
   */
  private normalizeDate(dateStr: string): string | undefined {
    // Formats supportés: DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MM-YY
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      let [day, month, year] = parts;

      // Si année sur 2 chiffres, ajouter 20xx
      if (year.length === 2) {
        year = '20' + year;
      }

      // Valider
      const d = parseInt(day);
      const m = parseInt(month);
      const y = parseInt(year);

      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      }
    }
    return undefined;
  }

  /**
   * Extrait le nom du fournisseur (premières lignes du document)
   */
  private extractFournisseur(text: string): string | undefined {
    // Prendre les 5 premières lignes non vides
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const firstLines = lines.slice(0, 5);

    // Chercher une ligne qui ressemble à un nom d'entreprise
    for (const line of firstLines) {
      // Si la ligne contient des mots en majuscules ou "SAS", "SARL", "SA", etc.
      if (/[A-Z]{2,}|S\.?A\.?S\.?|S\.?A\.?R\.?L\.?|S\.?A\.?/i.test(line) && line.length > 5 && line.length < 100) {
        return line.trim();
      }
    }

    // Sinon, retourner la première ligne
    return firstLines[0]?.trim();
  }

  /**
   * Calcule la confiance de l'extraction
   */
  private calculateConfidence(data: any): number {
    let score = 0;
    let total = 0;

    // Montant TTC (important)
    if (data.montant_ttc !== undefined) score += 30;
    total += 30;

    // Fournisseur (important)
    if (data.fournisseur) score += 25;
    total += 25;

    // Numéro facture (important)
    if (data.numero_facture) score += 20;
    total += 20;

    // Date (modérément important)
    if (data.date_document) score += 15;
    total += 15;

    // Autres champs
    if (data.montant_ht !== undefined) score += 5;
    total += 5;

    if (data.taux_tva !== undefined) score += 3;
    total += 3;

    if (data.date_echeance) score += 2;
    total += 2;

    return score / total;
  }

  /**
   * Génère un markdown structuré
   */
  private generateMarkdown(data: any, fullText: string): string {
    let markdown = `# Facture\n\n`;

    if (data.fournisseur) {
      markdown += `**Fournisseur:** ${data.fournisseur}\n\n`;
    }

    if (data.numero_facture) {
      markdown += `**Numéro:** ${data.numero_facture}\n\n`;
    }

    markdown += `## Montants\n\n`;

    if (data.montant_ht !== undefined) {
      markdown += `- **Montant HT:** ${data.montant_ht.toFixed(2)} €\n`;
    }

    if (data.taux_tva !== undefined) {
      markdown += `- **TVA:** ${data.taux_tva}%\n`;
    }

    if (data.montant_ttc !== undefined) {
      markdown += `- **Montant TTC:** ${data.montant_ttc.toFixed(2)} €\n`;
    }

    markdown += `\n## Dates\n\n`;

    if (data.date_document) {
      markdown += `- **Date facture:** ${data.date_document}\n`;
    }

    if (data.date_echeance) {
      markdown += `- **Date échéance:** ${data.date_echeance}\n`;
    }

    markdown += `\n---\n\n`;
    markdown += `*Extrait automatiquement par Simple Text Extractor*`;

    return markdown;
  }
}
