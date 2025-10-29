# 🚀 Appliquer la Migration MCP API Keys

## ✅ État actuel

- ✅ `consent_mcp` column existe dans `candidates`
- ✅ `pii_masking_level` column existe dans `projects`
- ⚠️  `mcp_api_keys` table MANQUANTE - À créer

## 📋 Instructions

### Étape 1 : Ouvrir SQL Editor

Ouvrez votre projet Supabase :

👉 **https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/sql/new**

### Étape 2 : Copier la migration

Copiez le contenu complet du fichier :

`F:\corematch\supabase\migrations\20250126_add_mcp_api_keys_table.sql`

### Étape 3 : Exécuter le SQL

1. Collez le SQL dans l'éditeur
2. Cliquez sur **"Run"** (ou Ctrl+Entrée)
3. Vérifiez le message de succès : **"MCP API keys table created successfully"**

### Étape 4 : Vérifier

Après exécution, vérifiez que la table existe :

```sql
SELECT * FROM mcp_api_keys LIMIT 1;
```

Résultat attendu : Aucune erreur (table vide c'est normal)

## ✅ Résultat attendu

Une fois terminé, vous devriez avoir :

- ✅ Table `mcp_api_keys` créée
- ✅ Index optimisés créés
- ✅ Policies RLS configurées
- ✅ Extension `pgcrypto` activée
- ✅ Fonction `generate_mcp_api_key()` disponible

## 🔄 Prochaine étape

Une fois la migration appliquée, nous pourrons :

1. ✅ Générer une API key production
2. ✅ Configurer les env vars
3. ✅ Tester le serveur MCP avec la vraie DB

---

**Note** : Si vous préférez, je peux aussi vous aider à l'appliquer via un script automatisé.
