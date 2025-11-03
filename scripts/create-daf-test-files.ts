/**
 * Script pour créer des fichiers de test pour la démo DAF
 * Ces fichiers déclencheront la classification automatique
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PDFDocument, rgb } from 'pdf-lib';

async function createTestFiles() {
  console.log('📄 Creating DAF test files...\n');

  // Create test directory
  const testDir = join(process.cwd(), 'daf-test-files');
  try {
    mkdirSync(testDir, { recursive: true });
  } catch (e) {
    // Directory already exists
  }

  const testFiles = [
    {
      name: 'Facture_EDF_Mars_2025.pdf',
      title: 'FACTURE EDF',
      content: [
        'EDF - Électricité de France',
        'Facture n°: FAC-2025-03-001234',
        '',
        'Date d\'émission: 15/03/2025',
        'Date d\'échéance: 30/03/2025',
        '',
        'Client: Entreprise Demo',
        'Adresse: 123 Rue de la République, 75001 Paris',
        '',
        'DÉTAIL DE LA CONSOMMATION',
        '',
        'Période: 01/02/2025 - 28/02/2025',
        'Consommation: 450 kWh',
        '',
        'Montant HT: 65.00 EUR',
        'TVA 20%: 13.00 EUR',
        'Montant TTC: 78.00 EUR',
        '',
        'À payer avant le 30/03/2025',
      ],
      expectedType: 'facture',
      expectedFournisseur: 'EDF',
    },
    {
      name: 'Releve_BNP_Janvier_2025.pdf',
      title: 'RELEVÉ DE COMPTE',
      content: [
        'BNP PARIBAS',
        'Relevé de compte professionnel',
        '',
        'Compte n°: 30004 12345 00012345678 25',
        'Période: 01/01/2025 - 31/01/2025',
        '',
        'Titulaire: Entreprise Demo SARL',
        'Adresse: 123 Rue de la République, 75001 Paris',
        '',
        'MOUVEMENTS DU MOIS',
        '',
        '05/01/2025  Virement salaires           -12,500.00',
        '10/01/2025  Encaissement client A       +5,000.00',
        '15/01/2025  Prélèvement EDF               -78.00',
        '20/01/2025  Encaissement client B       +3,200.00',
        '25/01/2025  Frais bancaires                -25.00',
        '',
        'Solde au 31/01/2025: 8,597.00 EUR',
      ],
      expectedType: 'releve_bancaire',
      expectedFournisseur: 'BNP Paribas',
    },
    {
      name: 'Contrat_Assurance_AXA_2025.pdf',
      title: 'CONTRAT D\'ASSURANCE',
      content: [
        'AXA FRANCE',
        'Contrat d\'Assurance Multirisque Professionnelle',
        '',
        'N° de contrat: AXA-PRO-2025-789456',
        'Date d\'effet: 01/01/2025',
        'Date d\'échéance: 31/12/2025',
        '',
        'Souscripteur: Entreprise Demo SARL',
        'SIREN: 123 456 789',
        'Adresse: 123 Rue de la République, 75001 Paris',
        '',
        'GARANTIES SOUSCRITES',
        '',
        '• Responsabilité Civile Professionnelle',
        '  Plafond: 1,000,000 EUR',
        '',
        '• Dommages aux locaux',
        '  Capital assuré: 500,000 EUR',
        '',
        '• Protection juridique',
        '  Plafond: 50,000 EUR',
        '',
        'Prime annuelle TTC: 2,450.00 EUR',
        'Paiement: Mensuel (204.17 EUR/mois)',
      ],
      expectedType: 'assurance',
      expectedFournisseur: 'AXA',
    },
    {
      name: 'Facture_Orange_Telecom_Fevrier_2025.pdf',
      title: 'FACTURE ORANGE',
      content: [
        'Orange Business Services',
        'Facture Télécom Professionnelle',
        '',
        'N° de facture: ORA-2025-02-567890',
        'Date: 28/02/2025',
        'Échéance: 20/03/2025',
        '',
        'Client: Entreprise Demo SARL',
        'N° de compte: 123456789',
        '',
        'DÉTAIL DES SERVICES',
        '',
        'Forfait Mobile Pro (5 lignes)      125.00 EUR',
        'Internet Fibre Pro 1 Gb/s          89.90 EUR',
        'Options et communications           24.50 EUR',
        '',
        'Sous-total HT:                     239.40 EUR',
        'TVA 20%:                            47.88 EUR',
        'Total TTC:                         287.28 EUR',
        '',
        'Date limite de paiement: 20/03/2025',
      ],
      expectedType: 'facture',
      expectedFournisseur: 'Orange',
    },
    {
      name: 'Note_Frais_Deplacement_Paris_Mars.pdf',
      title: 'NOTE DE FRAIS',
      content: [
        'NOTE DE FRAIS',
        '',
        'Salarié: Jean Dupont',
        'Période: 15-18 Mars 2025',
        'Mission: Salon professionnel Paris',
        '',
        'DÉTAIL DES DÉPENSES',
        '',
        '15/03 - Transport SNCF Paris A/R    156.00 EUR',
        '15/03 - Hôtel Ibis Paris (3 nuits)  360.00 EUR',
        '16/03 - Restaurant déjeuner client   78.00 EUR',
        '17/03 - Taxi aéroport                45.00 EUR',
        '18/03 - Repas                        32.00 EUR',
        '',
        'Total TTC: 671.00 EUR',
        '',
        'Justificatifs: 5 pièces jointes',
        'Date: 20/03/2025',
        'Signature: J. Dupont',
      ],
      expectedType: 'note_frais',
      expectedFournisseur: null,
    },
  ];

  for (const file of testFiles) {
    console.log(`📝 Creating: ${file.name}`);
    console.log(`   Expected type: ${file.expectedType}`);
    if (file.expectedFournisseur) {
      console.log(`   Expected fournisseur: ${file.expectedFournisseur}`);
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { height } = page.getSize();

    // Add title
    page.drawText(file.title, {
      x: 50,
      y: height - 50,
      size: 18,
      color: rgb(0, 0, 0),
    });

    // Add content
    let yPosition = height - 100;
    for (const line of file.content) {
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 10,
        color: rgb(0, 0, 0),
      });
      yPosition -= 15;

      if (yPosition < 50) break; // Stop if page is full
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const filePath = join(testDir, file.name);
    writeFileSync(filePath, pdfBytes);

    console.log(`   ✅ Created: ${filePath}\n`);
  }

  console.log('✅ All test files created successfully!\n');
  console.log('📂 Files location:', testDir);
  console.log('\n🧪 Next steps:');
  console.log('1. Open: http://localhost:3001/daf-demo');
  console.log('2. Login with your test account');
  console.log('3. Drag & drop the files from:', testDir);
  console.log('4. Verify classification results\n');
}

createTestFiles().catch(console.error);
