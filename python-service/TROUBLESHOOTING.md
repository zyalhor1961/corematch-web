# Configuration du Service Python - Insights Agent

## ⚠️ Problème Actuel

Le service Python démarre correctement mais ne peut pas se connecter à Supabase car les variables d'environnement sont manquantes.

**Erreur** : `supabase_url is required`

## ✅ Solution

### Étape 1 : Créer le fichier `.env`

Créez un fichier `.env` dans le dossier `python-service/` avec le contenu suivant :

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=votre-url-supabase-ici
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key-ici

# OpenAI Configuration  
OPENAI_API_KEY=votre-openai-api-key-ici

# Redis Configuration (Optionnel - graceful fallback)
REDIS_HOST=localhost
REDIS_PORT=6379

# Server Configuration
PORT=8000
```

### Étape 2 : Copier les valeurs depuis `.env.local`

Vous pouvez copier les valeurs depuis votre fichier `.env.local` à la racine du projet :

```powershell
# Depuis la racine du projet
Copy-Item .env.local python-service/.env
```

### Étape 3 : Redémarrer le service Python

```powershell
cd python-service
python main.py
```

## 📦 Dépendances Installées

✅ Toutes les dépendances sont maintenant installées :
- `langchain` + `langchain-openai`
- `redis`
- `reportlab` (PDF export)
- `openpyxl` (Excel export)

## 🧪 Test

Une fois le `.env` configuré, testez avec :

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/insights" -Method POST -Body '{"query":"top 5 fournisseurs","org_id":"demo-org-id"}' -ContentType "application/json"
```

Ou directement depuis l'interface web : `/org/[orgId]/insights`
