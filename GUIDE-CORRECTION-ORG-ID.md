# 🔧 Guide : Correction du problème org_id=undefined

## ✅ Ce qui a été fait

1. **Script SQL exécuté** : `fix-org-id-app.sql` 
   - Fonctions `get_my_org_id()` et `get_current_user_org()` créées
   - Vue `my_orgs` corrigée 
   - Données de test ajoutées

2. **Hook React créé** : `/hooks/useOrganization.ts`
   - Gère automatiquement l'ID d'organisation
   - Crée une organisation si elle n'existe pas
   - Fournit des fonctions pour les appels API

3. **Composant corrigé** : `/app/org/[orgId]/page.tsx`
   - Utilise maintenant le hook `useOrgQuery`
   - Les appels API utilisent l'org_id correct

## 🎯 Étapes pour appliquer la solution complète

### Étape 1: Tester que ça marche déjà

1. Ajoutez ce composant de test à une page pour vérifier :

```tsx
// Dans app/page.tsx ou une autre page
import OrganizationTest from '@/app/components/OrganizationTest';

export default function HomePage() {
  return (
    <div>
      <OrganizationTest />
      {/* Votre contenu existant */}
    </div>
  );
}
```

2. Allez sur la page et regardez la console du navigateur
3. Vous devriez voir : ✅ "Organisation chargée avec succès"

### Étape 2: Corriger les autres composants

Pour tous les composants qui font des appels API, remplacez :

**❌ Avant (causait org_id=undefined):**
```tsx
const { data } = await supabase
  .from('usage_counters')
  .select('*')
  .eq('org_id', orgId) // orgId était undefined !
```

**✅ Après (avec le hook):**
```tsx
import { useOrgQuery } from '@/hooks/useOrganization';

const { fetchWithOrgId, isReady } = useOrgQuery();

// Dans votre useEffect
if (isReady) {
  const data = await fetchWithOrgId('usage_counters', {
    filters: { period_month: currentMonth }
  });
}
```

### Étape 3: Composants à corriger

Ces fichiers font probablement des appels API et ont besoin du hook :

- `/app/dashboard/analytics/page.tsx`
- `/app/dashboard/jobs/page.tsx` 
- `/app/dashboard/candidates/page.tsx`
- `/app/org/[orgId]/cv/page.tsx`
- `/app/org/[orgId]/deb/page.tsx`

### Étape 4: Pattern à suivre

1. **Importer le hook :**
```tsx
import { useOrgQuery } from '@/hooks/useOrganization';
```

2. **L'utiliser dans votre composant :**
```tsx
const { fetchWithOrgId, countWithOrgId, isReady } = useOrgQuery();
```

3. **Attendre qu'il soit prêt :**
```tsx
useEffect(() => {
  if (isReady) {
    // Faire vos appels API ici
    loadData();
  }
}, [isReady]);
```

4. **Utiliser les fonctions du hook :**
```tsx
// Au lieu de supabase.from('table').eq('org_id', orgId)
const data = await fetchWithOrgId('table_name', {
  filters: { status: 'active' },
  orderBy: { column: 'created_at', ascending: false },
  limit: 10
});

// Pour compter
const count = await countWithOrgId('table_name', { status: 'active' });
```

## 🔍 Comment vérifier que ça marche

1. **Dans la console du navigateur**, vous devriez voir :
   ```
   ✅ Organisation chargée: { id: "...", org_name: "..." }
   ✅ usage_counters chargé: 3 records
   ✅ projects chargé: 2 records
   ```

2. **Dans l'onglet Network**, les requêtes devraient montrer :
   ```
   ✅ GET .../usage_counters?org_id=eq.12345678-... 200 (OK)
   ```
   
   Au lieu de :
   ```
   ❌ GET .../usage_counters?org_id=eq.undefined 400 (Bad Request)
   ```

## 🚨 Si vous avez des erreurs

1. **"Cannot find module '@/hooks/useOrganization'"**
   - Vérifiez que le fichier `/hooks/useOrganization.ts` existe
   - Redémarrez votre serveur de dev : `npm run dev`

2. **"get_my_org_id is not a function"** 
   - Exécutez le script SQL `fix-org-id-app.sql` dans Supabase

3. **Hook ne charge pas l'organisation**
   - Vérifiez que vous êtes connecté
   - Regardez la console pour les erreurs

## ✨ Résultat final

- ❌ **Avant** : `org_id=eq.undefined` → 400 Bad Request
- ✅ **Après** : `org_id=eq.12345678-abcd-...` → 200 OK

Plus de problème org_id=undefined ! 🎉

## 📞 Besoin d'aide ?

Si vous avez des questions sur l'implémentation, montrez-moi :
1. Les erreurs dans la console
2. Le composant que vous essayez de corriger
3. Les requêtes dans l'onglet Network