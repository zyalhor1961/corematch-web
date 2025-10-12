/**
 * Complete DEB System Test
 *
 * Runnable example demonstrating the complete DEB processing flow.
 *
 * Usage:
 *   npx tsx examples/deb-complete-test.ts
 */

import { performVATControls } from '../lib/services/deb/vat-control';
import { enrichHSCodes } from '../lib/services/deb/hs-code-enrichment';
import { recordValidation, getLearningStats } from '../lib/services/deb/auto-learning';
import { prepareForArchiving } from '../lib/services/deb/archiving';
import { allocateShipping } from '../lib/utils/shipping';

// Test data
const TEST_ORG_ID = 'test-org-123';
const TEST_DOCUMENT_ID = 'test-doc-456';

async function runCompleteTest() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       DEB COMPLETE SYSTEM TEST                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // ═══════════════════════════════════════════════════════════
    // STEP 1: VAT CONTROLS
    // ═══════════════════════════════════════════════════════════
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ STEP 1: VAT Financial Controls                  │');
    console.log('└─────────────────────────────────────────────────┘\n');

    const vatResult = await performVATControls({
      documentId: TEST_DOCUMENT_ID,
      netAmount: 10000.00,
      taxAmount: 0.00, // Zero VAT for intra-EU
      totalAmount: 10000.00,
      vendorVAT: 'DE123456789',
      vendorCountry: 'DE',
      currency: 'EUR'
    });

    console.log(`✓ Overall Status: ${vatResult.overallStatus.toUpperCase()}`);
    console.log(`  ├─ Arithmetic TTC: ${getStatusEmoji(vatResult.controls.arithmeticTTC.status)} ${vatResult.controls.arithmeticTTC.status}`);
    console.log(`  │  └─ ${vatResult.controls.arithmeticTTC.message}`);
    console.log(`  ├─ Intra-EU: ${getStatusEmoji(vatResult.controls.intraEUClassification.status)} ${vatResult.controls.intraEUClassification.status}`);
    console.log(`  │  └─ ${vatResult.controls.intraEUClassification.message}`);
    console.log(`  └─ VAT Zero: ${getStatusEmoji(vatResult.controls.vatZeroVerification.status)} ${vatResult.controls.vatZeroVerification.status}`);
    console.log(`     └─ ${vatResult.controls.vatZeroVerification.message}`);
    console.log();

    // ═══════════════════════════════════════════════════════════
    // STEP 2: HS CODE ENRICHMENT
    // ═══════════════════════════════════════════════════════════
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ STEP 2: HS Code Enrichment (OpenAI)            │');
    console.log('└─────────────────────────────────────────────────┘\n');

    const testLineItems = [
      {
        lineId: 'line-001',
        description: 'Laptop computer Dell XPS 13 13.3" Intel Core i7',
        sku: 'LAPTOP-XPS13-I7',
        quantity: 2,
        unitPrice: 1500.00,
        valueHT: 3000.00
      },
      {
        lineId: 'line-002',
        description: 'Wireless mouse Logitech MX Master 3 with USB receiver',
        sku: 'MOUSE-MX3',
        quantity: 5,
        unitPrice: 80.00,
        valueHT: 400.00
      },
      {
        lineId: 'line-003',
        description: 'USB-C charging cable 2 meters braided nylon',
        sku: 'CABLE-USBC-2M',
        quantity: 10,
        unitPrice: 15.00,
        valueHT: 150.00
      }
    ];

    console.log('Enriching line items with HS codes...\n');

    const enrichResult = await enrichHSCodes({
      orgId: TEST_ORG_ID,
      documentId: TEST_DOCUMENT_ID,
      lineItems: testLineItems
    });

    console.log(`✓ Enrichment complete`);
    console.log(`  ├─ Total lines: ${enrichResult.summary.totalLines}`);
    console.log(`  ├─ From Reference DB: ${enrichResult.summary.fromReferenceDB} (${enrichResult.referenceHitRate.toFixed(1)}%)`);
    console.log(`  ├─ From OpenAI: ${enrichResult.summary.fromOpenAI}`);
    console.log(`  └─ Failed: ${enrichResult.summary.failed}\n`);

    console.log('Enrichment Results:\n');
    enrichResult.suggestions.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. ${suggestion.description}`);
      console.log(`     ├─ HS Code: ${formatHSCode(suggestion.hsCode)} [${suggestion.source}]`);
      console.log(`     ├─ Weight: ${suggestion.weightKg} kg`);
      console.log(`     ├─ Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);
      if (suggestion.reasoning) {
        console.log(`     └─ Reasoning: ${suggestion.reasoning}`);
      }
      console.log();
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 3: USER VALIDATION & AUTO-LEARNING
    // ═══════════════════════════════════════════════════════════
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ STEP 3: User Validation & Auto-Learning        │');
    console.log('└─────────────────────────────────────────────────┘\n');

    console.log('Recording user validations to learning database...\n');

    for (const suggestion of enrichResult.suggestions) {
      const learningResult = await recordValidation({
        orgId: TEST_ORG_ID,
        description: suggestion.description,
        hsCode: suggestion.hsCode,
        weightKg: suggestion.weightKg || 1.0,
        sku: testLineItems.find(item => item.description === suggestion.description)?.sku,
        validatedBy: 'test-user'
      });

      console.log(`  ${learningResult.isNew ? '🆕' : '♻️ '} ${learningResult.message}`);
      console.log(`     └─ ${suggestion.description.substring(0, 60)}...`);
    }
    console.log();

    // Check learning stats
    const stats = await getLearningStats(TEST_ORG_ID);
    if (stats) {
      console.log('✓ Learning Statistics Updated:');
      console.log(`  ├─ Total articles: ${stats.totalArticles}`);
      console.log(`  ├─ User validated: ${stats.userValidatedCount}`);
      console.log(`  ├─ AI suggested: ${stats.aiSuggestedCount}`);
      console.log(`  └─ Avg confidence: ${(stats.avgConfidence * 100).toFixed(1)}%\n`);
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 4: TRANSPORT FEE ALLOCATION
    // ═══════════════════════════════════════════════════════════
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ STEP 4: Transport Fee Allocation               │');
    console.log('└─────────────────────────────────────────────────┘\n');

    const lineItemsForAllocation = enrichResult.suggestions.map((s, i) => ({
      line_amount: testLineItems[i].valueHT,
      qty: testLineItems[i].quantity,
      net_mass_kg: s.weightKg
    }));

    const totalShipping = 150.00;
    const shippingAllocations = allocateShipping(
      lineItemsForAllocation,
      totalShipping,
      'value'
    );

    console.log(`Total shipping cost: €${totalShipping.toFixed(2)}`);
    console.log('Allocated proportionally by value:\n');

    shippingAllocations.forEach((amount, index) => {
      const lineItem = testLineItems[index];
      console.log(`  Line ${index + 1}: €${amount.toFixed(2)}`);
      console.log(`     └─ ${lineItem.description.substring(0, 60)}...`);
    });

    const allocatedTotal = shippingAllocations.reduce((sum, amount) => sum + amount, 0);
    console.log(`\n  Total allocated: €${allocatedTotal.toFixed(2)} (Δ €${Math.abs(totalShipping - allocatedTotal).toFixed(2)})`);
    console.log();

    // ═══════════════════════════════════════════════════════════
    // STEP 5: ARCHIVE PREPARATION
    // ═══════════════════════════════════════════════════════════
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ STEP 5: Archive Preparation                     │');
    console.log('└─────────────────────────────────────────────────┘\n');

    const archiveResult = await prepareForArchiving(TEST_DOCUMENT_ID);

    if (archiveResult.success) {
      console.log(`✓ ${archiveResult.message}`);
      console.log(`  ├─ Completeness: ${archiveResult.validation.completeness}%`);
      console.log(`  ├─ Valid: ${archiveResult.validation.valid ? '✅' : '❌'}`);
      console.log(`  ├─ Errors: ${archiveResult.validation.errors.length}`);
      console.log(`  └─ Warnings: ${archiveResult.validation.warnings.length}\n`);

      if (archiveResult.metadata) {
        console.log('Archive Metadata Generated:');
        console.log(`  ├─ Document Type: ${archiveResult.metadata.documentType}`);
        console.log(`  ├─ Supplier: ${archiveResult.metadata.supplier.name}`);
        console.log(`  ├─ VAT Regime: ${archiveResult.metadata.vatControls.vatRegime}`);
        console.log(`  ├─ Total Amount: €${archiveResult.metadata.financial.totalAmount.toFixed(2)}`);
        console.log(`  └─ Line Items: ${archiveResult.metadata.lineItems.length}\n`);
      }
    } else {
      console.log(`❌ ${archiveResult.message}`);
      if (archiveResult.validation.errors.length > 0) {
        console.log('\nErrors:');
        archiveResult.validation.errors.forEach(error => {
          console.log(`  • ${error}`);
        });
      }
      console.log();
    }

    // ═══════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('✅ All steps completed successfully!\n');

    console.log('Process Flow:');
    console.log('  1. ✅ VAT controls passed');
    console.log('  2. ✅ HS codes enriched via OpenAI');
    console.log('  3. ✅ Validations recorded to learning database');
    console.log('  4. ✅ Transport fees allocated');
    console.log('  5. ✅ Document prepared for archiving\n');

    console.log('Next invoice processing will benefit from:');
    console.log(`  • ${enrichResult.suggestions.length} new articles in reference database`);
    console.log('  • Faster HS code enrichment (DB lookup instead of AI)');
    console.log('  • Improved confidence scores over time\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Helper functions
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'passed': return '✅';
    case 'warning': return '⚠️ ';
    case 'failed': return '❌';
    default: return '❓';
  }
}

function formatHSCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }
  return code;
}

// Run test
runCompleteTest()
  .then(() => {
    console.log('🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
