/**
 * Script d'Audit de Sécurité du Serveur MCP
 *
 * Vérifie que tous les fixes de sécurité sont correctement appliqués
 */

import fs from 'fs';
import path from 'path';

interface SecurityCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const checks: SecurityCheck[] = [];

function addCheck(
  name: string,
  status: 'PASS' | 'FAIL' | 'WARN',
  message: string,
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
) {
  checks.push({ name, status, message, severity });
}

console.log('\n🔒 AUDIT DE SÉCURITÉ DU SERVEUR MCP COREMATCH');
console.log('='.repeat(60));
console.log('');

// =============================================================================
// CHECK 1: Fichier .env.mcp existe et protégé
// =============================================================================

console.log('[1/10] Vérification .env.mcp...');

if (fs.existsSync('.env.mcp')) {
  addCheck('.env.mcp exists', 'PASS', 'Fichier de secrets existe', 'MEDIUM');

  const envContent = fs.readFileSync('.env.mcp', 'utf-8');

  // Vérifier qu'il ne contient pas de placeholders
  if (envContent.includes('YOUR_KEY_HERE') || envContent.includes('YOUR_PROJECT')) {
    addCheck(
      '.env.mcp placeholders',
      'FAIL',
      'Contient encore des placeholders (YOUR_KEY_HERE)',
      'CRITICAL'
    );
  } else {
    addCheck(
      '.env.mcp configured',
      'PASS',
      'Toutes les clés semblent configurées',
      'HIGH'
    );
  }

  // Vérifier MCP_MOCK_MODE
  if (envContent.includes('MCP_MOCK_MODE=true')) {
    addCheck(
      'MCP_MOCK_MODE',
      'WARN',
      'MOCK mode activé - OK pour dev, PAS pour production',
      'MEDIUM'
    );
  } else if (envContent.includes('MCP_MOCK_MODE=false')) {
    addCheck('MCP_MOCK_MODE', 'PASS', 'MOCK mode désactivé (production)', 'LOW');
  } else {
    addCheck('MCP_MOCK_MODE', 'WARN', 'MCP_MOCK_MODE non défini', 'MEDIUM');
  }
} else {
  addCheck('.env.mcp exists', 'FAIL', 'Fichier .env.mcp manquant!', 'CRITICAL');
}

// =============================================================================
// CHECK 2: start-mcp-server.bat ne contient PAS de secrets
// =============================================================================

console.log('[2/10] Vérification start-mcp-server.bat...');

if (fs.existsSync('start-mcp-server.bat')) {
  const batContent = fs.readFileSync('start-mcp-server.bat', 'utf-8');

  // Chercher des patterns de secrets
  const secretPatterns = [
    /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/, // JWT Supabase
    /mcp_sk_[a-f0-9]{64}/, // MCP API key
    /sk-proj-[A-Za-z0-9_-]+/, // OpenAI key
    /AIza[A-Za-z0-9_-]+/, // Gemini key
  ];

  let hasSecrets = false;
  secretPatterns.forEach((pattern) => {
    if (pattern.test(batContent)) {
      hasSecrets = true;
    }
  });

  if (hasSecrets) {
    addCheck(
      'start-mcp-server.bat secrets',
      'FAIL',
      'Contient des secrets en clair! Régénérer toutes les clés.',
      'CRITICAL'
    );
  } else {
    addCheck(
      'start-mcp-server.bat clean',
      'PASS',
      'Aucun secret trouvé dans le script',
      'HIGH'
    );
  }

  // Vérifier qu'il charge .env.mcp
  if (batContent.includes('.env.mcp')) {
    addCheck(
      'start-mcp-server.bat loads .env',
      'PASS',
      'Script charge les secrets depuis .env.mcp',
      'MEDIUM'
    );
  } else {
    addCheck(
      'start-mcp-server.bat loads .env',
      'FAIL',
      'Script ne charge PAS .env.mcp',
      'CRITICAL'
    );
  }
} else {
  addCheck(
    'start-mcp-server.bat exists',
    'FAIL',
    'Script de démarrage manquant!',
    'CRITICAL'
  );
}

// =============================================================================
// CHECK 3: .gitignore protège les secrets
// =============================================================================

console.log('[3/10] Vérification .gitignore...');

if (fs.existsSync('.gitignore')) {
  const gitignoreContent = fs.readFileSync('.gitignore', 'utf-8');

  if (gitignoreContent.includes('.env.mcp')) {
    addCheck('.gitignore .env.mcp', 'PASS', '.env.mcp ignoré par Git', 'HIGH');
  } else {
    addCheck(
      '.gitignore .env.mcp',
      'FAIL',
      '.env.mcp PAS ignoré - Risque de commit!',
      'CRITICAL'
    );
  }

  if (gitignoreContent.includes('start-mcp-server.bat')) {
    addCheck(
      '.gitignore start-mcp-server.bat',
      'PASS',
      'start-mcp-server.bat ignoré',
      'MEDIUM'
    );
  } else {
    addCheck(
      '.gitignore start-mcp-server.bat',
      'WARN',
      'start-mcp-server.bat PAS ignoré',
      'MEDIUM'
    );
  }
} else {
  addCheck('.gitignore exists', 'FAIL', 'Fichier .gitignore manquant!', 'HIGH');
}

// =============================================================================
// CHECK 4: Bypass test-user protégé
// =============================================================================

console.log('[4/10] Vérification auth middleware...');

const authMiddlewarePath = 'lib/mcp/server/middleware/auth-middleware.ts';
if (fs.existsSync(authMiddlewarePath)) {
  const authContent = fs.readFileSync(authMiddlewarePath, 'utf-8');

  if (authContent.includes("process.env.NODE_ENV === 'production'")) {
    addCheck(
      'test-user bypass protected',
      'PASS',
      'Bypass test-user bloqué en production',
      'HIGH'
    );
  } else if (authContent.includes('mcp_sk_test')) {
    addCheck(
      'test-user bypass',
      'FAIL',
      'Bypass test-user actif sans protection NODE_ENV!',
      'CRITICAL'
    );
  } else {
    addCheck(
      'test-user bypass',
      'PASS',
      'Bypass test-user supprimé ou protégé',
      'HIGH'
    );
  }
} else {
  addCheck('auth-middleware exists', 'WARN', 'auth-middleware.ts non trouvé', 'MEDIUM');
}

// =============================================================================
// CHECK 5: Documentation nettoyée
// =============================================================================

console.log('[5/10] Vérification documentation...');

const docsToCheck = [
  'MCP_SERVER_READY.md',
  'GUIDE_INTEGRATION_CLAUDE_DESKTOP.md',
  'MCP_INTEGRATION_SUCCESS.md',
  'README.md',
];

let docsWithSecrets = 0;
docsToCheck.forEach((doc) => {
  if (fs.existsSync(doc)) {
    const content = fs.readFileSync(doc, 'utf-8');
    const secretPatterns = [
      /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
      /mcp_sk_[a-f0-9]{64}/,
      /sk-proj-[A-Za-z0-9_-]+/,
    ];

    let hasSecrets = false;
    secretPatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        hasSecrets = true;
      }
    });

    if (hasSecrets) {
      docsWithSecrets++;
      addCheck(
        `Documentation ${doc}`,
        'FAIL',
        `${doc} contient des secrets!`,
        'HIGH'
      );
    }
  }
});

if (docsWithSecrets === 0) {
  addCheck('Documentation clean', 'PASS', 'Aucun secret dans la documentation', 'MEDIUM');
}

// =============================================================================
// CHECK 6-10: Checks supplémentaires
// =============================================================================

console.log('[6/10] Vérification PII dans logs...');
// TODO: Scanner les fichiers pour console.error avec PII
addCheck(
  'PII in logs',
  'WARN',
  'Vérification manuelle requise (rechercher console.error)',
  'MEDIUM'
);

console.log('[7/10] Vérification supabaseAdmin usage...');
// TODO: Scanner les tools pour vérifier usage de supabaseAdmin
addCheck(
  'supabaseAdmin usage',
  'WARN',
  'service-role utilisé partout - Considérer RLS',
  'HIGH'
);

console.log('[8/10] Vérification URLs signées CVs...');
// TODO: Vérifier si cv-parser utilise URLs signées
addCheck(
  'CV URLs signed',
  'WARN',
  'Vérifier manuellement que storage bucket est privé',
  'MEDIUM'
);

console.log('[9/10] Vérification NODE_ENV...');
if (process.env.NODE_ENV === 'production') {
  addCheck('NODE_ENV', 'PASS', 'NODE_ENV=production', 'LOW');
} else {
  addCheck(
    'NODE_ENV',
    'WARN',
    `NODE_ENV=${process.env.NODE_ENV || 'undefined'} (devrait être production)`,
    'MEDIUM'
  );
}

console.log('[10/10] Vérification package versions...');
// Check for known vulnerabilities
addCheck(
  'Dependencies',
  'WARN',
  'Exécuter npm audit pour vérifier vulnérabilités',
  'LOW'
);

// =============================================================================
// RÉSULTATS
// =============================================================================

console.log('');
console.log('='.repeat(60));
console.log('RÉSULTATS DE L\'AUDIT');
console.log('='.repeat(60));
console.log('');

const criticalIssues = checks.filter(
  (c) => c.status === 'FAIL' && c.severity === 'CRITICAL'
);
const highIssues = checks.filter((c) => c.status === 'FAIL' && c.severity === 'HIGH');
const warnings = checks.filter((c) => c.status === 'WARN');
const passed = checks.filter((c) => c.status === 'PASS');

console.log(`✅ Passed:   ${passed.length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);
console.log(`❌ Failed:   ${highIssues.length + criticalIssues.length}`);
console.log('');

if (criticalIssues.length > 0) {
  console.log('🔴 PROBLÈMES CRITIQUES:');
  console.log('');
  criticalIssues.forEach((check) => {
    console.log(`  ❌ ${check.name}`);
    console.log(`     ${check.message}`);
    console.log('');
  });
}

if (highIssues.length > 0) {
  console.log('🟠 PROBLÈMES ÉLEVÉS:');
  console.log('');
  highIssues.forEach((check) => {
    console.log(`  ❌ ${check.name}`);
    console.log(`     ${check.message}`);
    console.log('');
  });
}

if (warnings.length > 0) {
  console.log('🟡 AVERTISSEMENTS:');
  console.log('');
  warnings.forEach((check) => {
    console.log(`  ⚠️  ${check.name}`);
    console.log(`     ${check.message}`);
    console.log('');
  });
}

console.log('='.repeat(60));

// Status final
const totalIssues = criticalIssues.length + highIssues.length;

if (totalIssues === 0 && warnings.length === 0) {
  console.log('');
  console.log('🎉 AUDIT PASSÉ - Serveur MCP sécurisé!');
  console.log('');
  process.exit(0);
} else if (criticalIssues.length > 0) {
  console.log('');
  console.log('🚨 AUDIT ÉCHOUÉ - Problèmes critiques détectés!');
  console.log('');
  console.log('ACTION IMMÉDIATE REQUISE:');
  console.log('1. Corriger tous les problèmes CRITIQUES');
  console.log('2. Régénérer toutes les clés exposées');
  console.log('3. Relancer cet audit');
  console.log('');
  process.exit(1);
} else if (highIssues.length > 0) {
  console.log('');
  console.log('⚠️  AUDIT PARTIELLEMENT RÉUSSI - Problèmes à corriger');
  console.log('');
  console.log('ACTION REQUISE:');
  console.log('1. Corriger les problèmes ÉLEVÉS');
  console.log('2. Relancer cet audit');
  console.log('');
  process.exit(1);
} else {
  console.log('');
  console.log('✅ AUDIT RÉUSSI AVEC AVERTISSEMENTS');
  console.log('');
  console.log('Le serveur est sécurisé mais quelques améliorations recommandées.');
  console.log('');
  process.exit(0);
}
