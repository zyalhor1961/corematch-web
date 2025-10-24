/**
 * Script maître pour exécuter tous les tests
 */

import { execSync } from 'child_process';
import { join } from 'path';

const tests = [
  'utils.dates.test.ts',
  'utils.normalize.test.ts',
  'validators.test.ts',
  'config.test.ts',
  'integration.test.ts',
];

console.log('\n🚀 Running all Phase 1 tests...\n');
console.log('═'.repeat(60));

let totalPassed = 0;
let totalFailed = 0;

for (const testFile of tests) {
  const testPath = join(__dirname, testFile);

  try {
    console.log(`\n📦 Running ${testFile}...`);
    console.log('─'.repeat(60));

    const output = execSync(`npx tsx "${testPath}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    // Compter les ✅
    const passedCount = (output.match(/✅/g) || []).length;
    totalPassed += passedCount;

    console.log(output);
    console.log(`\n✅ ${testFile} passed (${passedCount} assertions)`);
  } catch (error: any) {
    totalFailed++;
    console.error(`\n❌ ${testFile} FAILED`);
    console.error(error.stdout || error.message);
  }
}

console.log('\n═'.repeat(60));
console.log('\n📊 Test Summary');
console.log('═'.repeat(60));
console.log(`Total test files: ${tests.length}`);
console.log(`Passed: ${tests.length - totalFailed} ✅`);
console.log(`Failed: ${totalFailed} ❌`);
console.log(`Total assertions: ${totalPassed} ✅`);
console.log('═'.repeat(60));

if (totalFailed === 0) {
  console.log('\n🎉 All tests passed! Phase 1 is solid! 🎉\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please review the errors above.\n');
  process.exit(1);
}
