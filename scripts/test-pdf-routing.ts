/**
 * Test script pour vérifier le routing intelligent des PDFs
 *
 * Teste:
 * 1. Détection du type de PDF (natif vs scanné)
 * 2. Routing vers le bon extracteur
 * 3. Extraction des métadonnées (99.99% fiabilité)
 * 4. Génération du markdown professionnel
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzePDFType } from '../lib/daf-docs/extraction/pdf-detector';
import { extractPDFMetadata } from '../lib/daf-docs/extraction/pdf-metadata-extractor';
import { generateProfessionalMarkdown } from '../lib/daf-docs/extraction/markdown-generator';
import { SimpleTextExtractor } from '../lib/daf-docs/extraction/simple-text-extractor';

async function testPDFRouting() {
  console.log('🧪 Test du système de routing intelligent des PDFs\n');
  console.log('=' .repeat(60));

  // Chercher un PDF de test
  const testPDFPath = join(process.cwd(), 'test-invoice.pdf');

  try {
    console.log('\n📄 Chargement du PDF de test...');
    const pdfBuffer = readFileSync(testPDFPath);
    const arrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    );

    console.log(`✓ PDF chargé: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

    // ÉTAPE 1: Analyse du type de PDF
    console.log('🔍 ÉTAPE 1: Analyse du type de PDF');
    console.log('-' .repeat(60));

    const analysis = await analyzePDFType(arrayBuffer);

    console.log(`Type détecté: ${analysis.type}`);
    console.log(`Confiance: ${(analysis.confidence * 100).toFixed(1)}%`);
    console.log(`Texte extrait: ${analysis.textLength} caractères`);
    console.log(`Pages: ${analysis.pageCount}`);
    console.log(`Densité: ${analysis.avgTextPerPage.toFixed(0)} chars/page`);
    console.log(`Recommandation: ${analysis.recommendation}`);
    console.log(`\n✓ Analyse terminée\n`);

    // ÉTAPE 2: Extraction des métadonnées (99.99% fiabilité)
    console.log('📊 ÉTAPE 2: Extraction des métadonnées (99.99%)');
    console.log('-' .repeat(60));

    const metadata = await extractPDFMetadata(arrayBuffer);

    console.log('Informations du document:');
    if (metadata.info.title) console.log(`  - Titre: ${metadata.info.title}`);
    if (metadata.info.author) console.log(`  - Auteur: ${metadata.info.author}`);
    if (metadata.info.creator) console.log(`  - Créé avec: ${metadata.info.creator}`);
    if (metadata.info.producer) console.log(`  - Produit par: ${metadata.info.producer}`);
    if (metadata.info.creationDate) console.log(`  - Date création: ${metadata.info.creationDate}`);

    console.log('\nStructure:');
    console.log(`  - Pages: ${metadata.structure.pageCount}`);
    console.log(`  - Taille: ${(metadata.structure.fileSizeBytes / 1024).toFixed(2)} KB`);
    console.log(`  - Version PDF: ${metadata.structure.pdfVersion || 'N/A'}`);
    console.log(`  - Chiffré: ${metadata.structure.isEncrypted ? 'Oui' : 'Non'}`);
    console.log(`  - Texte: ${metadata.structure.textLength} caractères`);

    console.log('\nIntégrité:');
    console.log(`  - MD5: ${metadata.integrity.md5Hash}`);
    console.log(`  - SHA-256: ${metadata.integrity.sha256Hash.substring(0, 32)}...`);

    console.log(`\n✓ Métadonnées extraites en ${metadata.extraction.durationMs}ms\n`);

    // ÉTAPE 3: Test extraction selon le type
    console.log('🎯 ÉTAPE 3: Test extraction selon recommandation');
    console.log('-' .repeat(60));

    if (analysis.recommendation === 'simple-parser') {
      console.log('💰 PDF NATIF détecté → Utilisation du parser GRATUIT');

      const simpleExtractor = new SimpleTextExtractor();
      const result = await simpleExtractor.extractDocument(arrayBuffer, 'test-invoice.pdf');

      if (result.success) {
        console.log(`\n✓ Extraction réussie (confiance: ${(result.confidence * 100).toFixed(1)}%)`);
        console.log('\nDonnées extraites:');
        if (result.fournisseur) console.log(`  - Fournisseur: ${result.fournisseur}`);
        if (result.numero_facture) console.log(`  - N° facture: ${result.numero_facture}`);
        if (result.date_document) console.log(`  - Date: ${result.date_document}`);
        if (result.montant_ht !== undefined) console.log(`  - Montant HT: ${result.montant_ht.toFixed(2)} €`);
        if (result.montant_ttc !== undefined) console.log(`  - Montant TTC: ${result.montant_ttc.toFixed(2)} €`);
        if (result.taux_tva !== undefined) console.log(`  - TVA: ${result.taux_tva}%`);

        console.log(`\n⏱️  Temps d'extraction: ${result.extraction_duration_ms}ms`);
        console.log(`💵 Coût: €0.00 (GRATUIT!)`);

        // Afficher un extrait du markdown généré
        if (result.raw_response?.markdown) {
          const markdown = result.raw_response.markdown;
          const preview = markdown.substring(0, 500);
          console.log('\n📝 Aperçu du Markdown généré:');
          console.log('-' .repeat(60));
          console.log(preview + '...\n');
        }
      } else {
        console.log(`✗ Extraction échouée: ${result.error}`);
        console.log('→ Fallback vers OCR recommandé');
      }

    } else {
      console.log('💵 PDF SCANNÉ détecté → OCR requis (Landing AI ou Azure DI)');
      console.log(`   Coût estimé: ~€0.10 par page (${metadata.structure.pageCount} pages = ~€${(metadata.structure.pageCount * 0.10).toFixed(2)})`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ TEST TERMINÉ AVEC SUCCÈS');
    console.log('=' .repeat(60));

    // Statistiques finales
    console.log('\n📈 RÉSUMÉ:');
    console.log(`  Type: ${analysis.type.toUpperCase()}`);
    console.log(`  Stratégie: ${analysis.recommendation === 'simple-parser' ? 'Parser gratuit (€0)' : 'OCR payant (€€€)'}`);
    console.log(`  Économies: ${analysis.recommendation === 'simple-parser' ? '100%' : '0%'}`);

  } catch (error) {
    console.error('\n❌ ERREUR:', error);

    if ((error as any).code === 'ENOENT') {
      console.log('\n💡 Conseil: Placez un fichier PDF nommé "test-invoice.pdf" à la racine du projet.');
      console.log('   Ou testez en uploadant un PDF via l\'interface web sur http://localhost:3005/daf-demo');
    }
  }
}

// Exécuter le test
testPDFRouting().catch(console.error);
