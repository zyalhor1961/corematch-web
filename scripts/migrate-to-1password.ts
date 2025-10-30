#!/usr/bin/env tsx

/**
 * Migration Script: supabaseAdmin → getSupabaseAdmin()
 *
 * This script automatically migrates all API routes to use 1Password-backed
 * getSupabaseAdmin() instead of the legacy supabaseAdmin.
 *
 * Pattern:
 * 1. Change: import { supabaseAdmin } → import { getSupabaseAdmin }
 * 2. Add at start of each handler: const supabaseAdmin = await getSupabaseAdmin();
 * 3. Add at start of helper functions that use supabaseAdmin
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface MigrationResult {
  file: string;
  status: 'migrated' | 'skipped' | 'error';
  reason?: string;
}

const results: MigrationResult[] = [];

/**
 * Check if file needs migration (imports supabaseAdmin)
 */
function needsMigration(content: string): boolean {
  return content.includes("from '@/lib/supabase/server'") &&
    (content.includes('supabaseAdmin') || content.includes('{ supabaseAdmin }'));
}

/**
 * Check if file is already migrated (uses getSupabaseAdmin)
 */
function isAlreadyMigrated(content: string): boolean {
  return content.includes('getSupabaseAdmin');
}

/**
 * Migrate import statement
 */
function migrateImport(content: string): string {
  // Replace: import { supabaseAdmin } → import { getSupabaseAdmin }
  content = content.replace(
    /import\s*{\s*supabaseAdmin\s*}\s*from\s*'@\/lib\/supabase\/server'/g,
    "import { getSupabaseAdmin } from '@/lib/supabase/server'"
  );

  return content;
}

/**
 * Find all exported async functions (GET, POST, PUT, PATCH, DELETE)
 * Returns array of { name: 'POST', startLine: number, startPos: number }
 */
function findExportedHandlers(content: string): Array<{ name: string; startPos: number }> {
  const handlers: Array<{ name: string; startPos: number }> = [];
  const regex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    handlers.push({
      name: match[1],
      startPos: match.index
    });
  }

  return handlers;
}

/**
 * Find all helper async functions that use supabaseAdmin
 */
function findHelperFunctions(content: string): Array<{ name: string; startPos: number }> {
  const helpers: Array<{ name: string; startPos: number }> = [];

  // Match: async function name(...) {
  const regex = /async\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const funcName = match[1];
    const funcStart = match.index;

    // Check if this function uses supabaseAdmin (look ahead ~500 chars)
    const snippet = content.substring(funcStart, funcStart + 1000);
    if (snippet.includes('supabaseAdmin')) {
      helpers.push({
        name: funcName,
        startPos: funcStart
      });
    }
  }

  return helpers;
}

/**
 * Insert `const supabaseAdmin = await getSupabaseAdmin();` at the start of a function
 */
function insertGetSupabaseAdmin(content: string, functionStartPos: number): string {
  // Find the opening brace after function signature
  const afterFunc = content.substring(functionStartPos);
  const braceMatch = afterFunc.match(/\)\s*\{/);

  if (!braceMatch || !braceMatch.index) {
    console.warn('Could not find opening brace for function');
    return content;
  }

  const insertPos = functionStartPos + braceMatch.index! + braceMatch[0].length;

  // Find indentation of next line
  const afterBrace = content.substring(insertPos);
  const nextLineMatch = afterBrace.match(/\n(\s*)/);
  const indent = nextLineMatch ? nextLineMatch[1] : '    ';

  // Check if next line already has getSupabaseAdmin
  const nextLines = afterBrace.substring(0, 200);
  if (nextLines.includes('getSupabaseAdmin()')) {
    return content; // Already migrated
  }

  // Find the 'try {' block if it exists
  const tryMatch = afterBrace.match(/(\s*)try\s*\{/);

  if (tryMatch && tryMatch.index! < 50) {
    // Insert after 'try {'
    const tryInsertPos = insertPos + tryMatch.index! + tryMatch[0].length;
    const insertion = `\n${indent}  const supabaseAdmin = await getSupabaseAdmin();\n`;
    return content.slice(0, tryInsertPos) + insertion + content.slice(tryInsertPos);
  } else {
    // Insert right after function opening brace
    const insertion = `\n${indent}const supabaseAdmin = await getSupabaseAdmin();\n`;
    return content.slice(0, insertPos) + insertion + content.slice(insertPos);
  }
}

/**
 * Migrate a single file
 */
function migrateFile(filePath: string): MigrationResult {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Skip if doesn't need migration
    if (!needsMigration(content)) {
      return { file: filePath, status: 'skipped', reason: 'No supabaseAdmin import' };
    }

    // Skip if already migrated
    if (isAlreadyMigrated(content)) {
      return { file: filePath, status: 'skipped', reason: 'Already uses getSupabaseAdmin' };
    }

    console.log(`\nMigrating: ${filePath}`);

    // Step 1: Migrate import
    content = migrateImport(content);
    console.log('  ✓ Import updated');

    // Step 2: Find and migrate exported handlers
    const handlers = findExportedHandlers(content);
    console.log(`  ✓ Found ${handlers.length} exported handlers:`, handlers.map(h => h.name).join(', '));

    for (const handler of handlers.reverse()) { // Reverse to maintain positions
      content = insertGetSupabaseAdmin(content, handler.startPos);
    }

    // Step 3: Find and migrate helper functions
    const helpers = findHelperFunctions(content);
    if (helpers.length > 0) {
      console.log(`  ✓ Found ${helpers.length} helper functions:`, helpers.map(h => h.name).join(', '));

      for (const helper of helpers.reverse()) { // Reverse to maintain positions
        content = insertGetSupabaseAdmin(content, helper.startPos);
      }
    }

    // Write back
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('  ✅ Migration complete');

    return { file: filePath, status: 'migrated' };

  } catch (error) {
    console.error(`  ❌ Error migrating ${filePath}:`, error);
    return {
      file: filePath,
      status: 'error',
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔐 Migration vers 1Password: supabaseAdmin → getSupabaseAdmin()');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Find all API route files
  const apiFiles = await glob('app/api/**/*.ts', {
    cwd: process.cwd(),
    absolute: true,
    ignore: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/node_modules/**'
    ]
  });

  console.log(`Found ${apiFiles.length} API route files\n`);

  // Migrate each file
  for (const file of apiFiles) {
    const result = migrateFile(file);
    results.push(result);
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 Migration Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const migrated = results.filter(r => r.status === 'migrated');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');

  console.log(`✅ Migrated: ${migrated.length} files`);
  console.log(`⏭️  Skipped: ${skipped.length} files`);
  console.log(`❌ Errors: ${errors.length} files\n`);

  if (migrated.length > 0) {
    console.log('Migrated files:');
    migrated.forEach(r => console.log(`  - ${path.relative(process.cwd(), r.file)}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('Files with errors:');
    errors.forEach(r => console.log(`  - ${path.relative(process.cwd(), r.file)}: ${r.reason}`));
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Next steps:');
  console.log('1. Review changes: git diff');
  console.log('2. Test build: npm run build');
  console.log('3. Manually fix any errors');
  console.log('4. Commit: git add . && git commit -m "feat: Migrate all routes to 1Password"');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run migration
main().catch(console.error);
