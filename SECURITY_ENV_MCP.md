# Sécurité - Gestion de .env.mcp

## ⚠️ CRITIQUE - À lire impérativement

Le fichier `.env.mcp` contient des secrets sensibles en clair :
- **SUPABASE_SERVICE_ROLE_KEY** : Clé service-role avec accès admin complet à la base de données
- **MCP_AUTH_HEADER** : Clé d'authentification pour le serveur MCP

**Risque** : Toute personne ayant accès au poste peut lire ces secrets et obtenir un accès complet à votre infrastructure.

---

## État actuel

### Ce qui est EN PLACE ✅
1. `.env.mcp` est **exclu de Git** (via `.gitignore`)
2. Le fichier n'est **jamais commité** dans le dépôt
3. **MCP_MOCK_MODE=false** : Mode production activé (vrais contrôles RGPD/consent)

### Ce qui MANQUE ❌
1. Pas de chiffrement du fichier
2. Secrets accessibles en clair sur le disque
3. Pas de rotation automatique des secrets
4. Pas d'audit d'accès au fichier

---

## Solutions recommandées par ordre de priorité

### 🔴 P0 - URGENT (à faire immédiatement)

#### 1. Chiffrement du disque
**Windows BitLocker** (recommandé) :
```powershell
# Vérifier si BitLocker est activé
manage-bde -status C:

# Activer BitLocker (nécessite admin)
manage-bde -on C: -RecoveryPassword
```

**Alternative - VeraCrypt** (gratuit) :
- Télécharger : https://www.veracrypt.fr/
- Créer un conteneur chiffré pour le projet
- Monter le conteneur uniquement quand nécessaire

#### 2. Permissions fichier restrictives
```bash
# Limiter l'accès au fichier (Windows avec Git Bash/WSL)
icacls .env.mcp /inheritance:r /grant:r "%USERNAME%:R"

# Vérifier les permissions
icacls .env.mcp
```

#### 3. Supprimer les backups non chiffrés
```bash
# Rechercher d'éventuelles copies de .env.mcp
find /f/corematch -name "*env.mcp*" -o -name "*.backup" | grep -i env

# Supprimer toute copie trouvée (après vérification)
```

---

### 🟠 P1 - IMPORTANT (à implémenter sous 1 semaine)

#### Option A : Windows Credential Manager (Natif Windows)
**Avantages** : Déjà installé, intégré à Windows, chiffré automatiquement

**Mise en œuvre** :
```powershell
# Stocker la clé Supabase
cmdkey /generic:"CoreMatch_Supabase_ServiceRole" /user:"corematch" /pass:"votre_service_role_key"

# Stocker la clé MCP
cmdkey /generic:"CoreMatch_MCP_AuthKey" /user:"corematch" /pass:"votre_mcp_key"

# Lister les secrets stockés
cmdkey /list | findstr CoreMatch
```

Ensuite, modifier `lib/mcp/server/start-with-env.ts` pour lire depuis Credential Manager :
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getSecret(name: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `powershell -Command "cmdkey /list | Select-String '${name}' -Context 0,1"`
    );
    // Parser la sortie pour extraire le secret
    // Note: Credential Manager ne permet pas la lecture directe via CLI
    // Il faut utiliser l'API Windows ou un module Node.js comme 'node-keytar'
    throw new Error('Use node-keytar for reading credentials');
  } catch (error) {
    throw new Error(`Failed to retrieve secret ${name}: ${error}`);
  }
}
```

**Meilleure approche avec node-keytar** :
```bash
npm install keytar
```

```typescript
import * as keytar from 'keytar';

// Stocker (une fois)
await keytar.setPassword('CoreMatch', 'SUPABASE_SERVICE_ROLE_KEY', 'your_key');
await keytar.setPassword('CoreMatch', 'MCP_AUTH_HEADER', 'your_key');

// Récupérer (au runtime)
const serviceRoleKey = await keytar.getPassword('CoreMatch', 'SUPABASE_SERVICE_ROLE_KEY');
const mcpAuthKey = await keytar.getPassword('CoreMatch', 'MCP_AUTH_HEADER');

process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey || '';
process.env.MCP_AUTH_HEADER = mcpAuthKey || '';
```

#### Option B : 1Password CLI (recommandé pour les équipes)
**Avantages** : Partage sécurisé, audit, rotation facile, multi-plateformes

**Installation** :
```bash
# Télécharger 1Password CLI
# https://developer.1password.com/docs/cli/get-started/

# Se connecter
op signin

# Stocker les secrets
op item create \
  --category=password \
  --title="CoreMatch Supabase Service Role" \
  --vault="CoreMatch" \
  password="your_service_role_key"

op item create \
  --category=password \
  --title="CoreMatch MCP Auth" \
  --vault="CoreMatch" \
  password="your_mcp_auth_key"
```

**Utilisation dans le projet** :
```bash
# Récupérer un secret
op item get "CoreMatch Supabase Service Role" --fields password

# Modifier start-mcp-server.bat
@echo off
for /f "delims=" %%i in ('op item get "CoreMatch Supabase Service Role" --fields password') do set SUPABASE_SERVICE_ROLE_KEY=%%i
for /f "delims=" %%i in ('op item get "CoreMatch MCP Auth" --fields password') do set MCP_AUTH_HEADER=%%i
npx tsx bin/mcp-server.ts
```

#### Option C : Azure Key Vault (pour production Azure)
Si vous déployez sur Azure, utilisez Key Vault :
```typescript
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const credential = new DefaultAzureCredential();
const client = new SecretClient('https://corematch-kv.vault.azure.net/', credential);

const supabaseKey = await client.getSecret('supabase-service-role-key');
process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseKey.value;
```

---

### 🟢 P2 - BONNES PRATIQUES (amélioration continue)

#### 1. Rotation des secrets
**Fréquence recommandée** : Tous les 90 jours

**Procédure de rotation Supabase** :
1. Aller sur Supabase Dashboard → Settings → API
2. Générer une nouvelle service-role key
3. Mettre à jour dans le gestionnaire de secrets
4. Redémarrer le serveur MCP
5. Révoquer l'ancienne clé après vérification

**Procédure de rotation MCP** :
1. Générer une nouvelle clé API MCP
2. Mettre à jour dans le gestionnaire de secrets
3. Redémarrer le serveur
4. Mettre à jour Claude Desktop config

#### 2. Audit des accès
**Windows - Activer l'audit d'accès fichier** :
```powershell
# Activer l'audit pour .env.mcp
auditpol /set /subcategory:"File System" /success:enable /failure:enable

# Voir les événements d'accès (Event Viewer)
# Security Log → Event ID 4663 (An attempt was made to access an object)
```

#### 3. Détection de fuite
**Outils de scan** :
- **TruffleHog** : Scanner Git history pour secrets
- **GitGuardian** : Monitoring en temps réel
- **GitHub Secret Scanning** : Alertes automatiques

```bash
# Scanner avec TruffleHog
docker run --rm -v /f/corematch:/tmp trufflesecurity/trufflehog:latest filesystem /tmp
```

#### 4. Backup sécurisé
**Ne JAMAIS** :
- Commiter `.env.mcp` dans Git
- Envoyer par email
- Copier sur un support non chiffré
- Stocker dans un cloud non chiffré (Dropbox, Google Drive)

**À LA PLACE** :
```bash
# Backup chiffré avec GPG
gpg --symmetric --cipher-algo AES256 .env.mcp
# Crée .env.mcp.gpg (chiffré)

# Restaurer
gpg --decrypt .env.mcp.gpg > .env.mcp
```

---

## Que faire en cas de compromission

### 🚨 Si les secrets sont exposés (commit Git, email, etc.)

**ACTION IMMÉDIATE** (dans l'heure) :

1. **Révoquer les secrets compromis** :
   - Supabase : Dashboard → Settings → API → Regenerate service role key
   - MCP : Générer nouvelle clé API

2. **Mettre à jour partout** :
   ```bash
   # Mettre à jour .env.mcp (ou credential manager)
   # Redémarrer serveur MCP
   npx tsx bin/mcp-server.ts

   # Mettre à jour Claude Desktop config
   notepad %APPDATA%\Claude\claude_desktop_config.json
   ```

3. **Audit de sécurité** :
   ```sql
   -- Vérifier les accès suspects dans Supabase
   SELECT * FROM auth.audit_log_entries
   WHERE created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;

   -- Vérifier les modifications suspectes
   SELECT * FROM organization_members
   WHERE updated_at > NOW() - INTERVAL '24 hours';
   ```

4. **Nettoyer Git history** (si commitée) :
   ```bash
   # DANGER : Réécrit l'historique Git
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.mcp" \
     --prune-empty --tag-name-filter cat -- --all

   # Forcer push (coordination équipe requise)
   git push origin --force --all
   ```

5. **Notifier l'équipe** : Tous les développeurs doivent mettre à jour leurs secrets

---

## Checklist de déploiement production

Avant de déployer en production, vérifier :

- [ ] BitLocker ou chiffrement disque activé
- [ ] `.env.mcp` avec permissions restrictives (lecture seule, user unique)
- [ ] Secrets stockés dans un gestionnaire (Credential Manager / 1Password / Key Vault)
- [ ] `.env.mcp` dans `.gitignore`
- [ ] Pas de `.env.mcp` dans l'historique Git
- [ ] Audit d'accès fichier activé
- [ ] Plan de rotation des secrets (90 jours)
- [ ] Procédure de compromission documentée et testée
- [ ] Backup chiffré des secrets (GPG)
- [ ] `MCP_MOCK_MODE=false` en production
- [ ] Monitoring des accès Supabase activé

---

## Références

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [Windows BitLocker Documentation](https://docs.microsoft.com/en-us/windows/security/information-protection/bitlocker/)
- [1Password CLI Documentation](https://developer.1password.com/docs/cli/)
- [Azure Key Vault Best Practices](https://docs.microsoft.com/en-us/azure/key-vault/general/best-practices)

---

**Document créé le** : 2025-01-29
**Dernière mise à jour** : 2025-01-29
**Statut** : `MCP_MOCK_MODE=false` activé, reste à implémenter gestionnaire de secrets (P1)
