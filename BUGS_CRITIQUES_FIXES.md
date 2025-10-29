# 🚨 Bugs Critiques - Plan de Correction

**Date**: 2025-10-27
**Priorité**: 🔴 CRITIQUE
**Source**: Review sécurité complet

---

## 🔴 CRITIQUE - Sécurité (À faire MAINTENANT)

### 1. Routes `/api/admin/*` sans auth ⚠️ **TRÈS GRAVE**

**Fichiers concernés** :
- `app/api/admin/list-projects/route.ts`
- `app/api/admin/create-project/route.ts`
- `app/api/admin/list-candidates/route.ts`
- Tous les `app/api/admin/**`

**Problème** :
```typescript
// ❌ Aucune vérification d'auth
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('orgId');
  const { data } = await supabaseAdmin.from('projects').select('*').eq('org_id', orgId);
  return NextResponse.json({ projects: data });
}
```

**Impact** :
- Exfiltration inter-organisations
- Modification de données
- Violation RGPD

**Fix** : Ajouter middleware auth à TOUTES les routes admin

**Temps** : 2-3h

---

### 2. Master Admin hardcodé (`admin@corematch.test`)

**Fichiers** :
- `lib/auth/middleware.ts:53`
- `app/org/[orgId]/cv/page.tsx:70`

**Problème** :
```typescript
const isMasterAdmin = user?.email === 'admin@corematch.test';
```

**Fix** : Vérifier rôle dans `organization_members`

**Temps** : 30min

---

### 3. CV path dans `notes` (regex fragile)

**Fichiers** :
- `app/api/cv/projects/[projectId]/upload/route.ts:146-171`
- `app/api/cv/projects/[projectId]/analyze/route.ts:53-70`

**Problème** : Path extrait via regex, cassé si `notes` modifié

**Fix** : Migration + nouvelle colonne `cv_path`

**Temps** : 1h

---

## 🟠 HAUTE PRIORITÉ - Bloquants UX

### 4. Boucle inscription (email confirmation)

**Fichier** : `app/register/page.tsx:70-106`

**Problème** : Redirection `/onboarding` avant confirmation email

**Fix** : Vérifier session + page "check-email"

**Temps** : 30min

---

### 5. Onboarding - Invitation échoue

**Fichier** : `app/onboarding/page.tsx:132-147`

**Problème** : `user_id` manquant (PK non nullable)

**Fix** : Migration `user_id` nullable + logique invitation

**Temps** : 1h

---

### 6. RPC `sum_pages_for_org` manquant

**Fichier** : `app/org/[orgId]/page.tsx:63`

**Problème** : Page crash si migration 004 pas appliquée

**Fix** : Fallback si RPC absent

**Temps** : 15min

---

## 🟡 MOYENNE PRIORITÉ - Qualité

### 7. Logs "SUSPICIOUS_ACTIVITY" faux positifs

**Fichier** : `app/api/cv/projects/[projectId]/upload/route.ts:94-104`

**Fix** : Logger uniquement si vraiment suspect

**Temps** : 15min

---

### 8. MCP_MOCK_MODE jamais désactivé

**Fichier** : `.env.mcp`

**Fix** : Tester avec `MCP_MOCK_MODE=false`

**Temps** : 30min (tests)

---

## 🎯 Plan d'Exécution

### Jour 1 (Aujourd'hui) - Sécurité

- [ ] **Créer middleware auth** pour routes `/api/admin/*`
- [ ] **Remplacer master admin** hardcodé par vérif rôle
- [ ] **Migration** : Ajouter colonne `cv_path`

**Temps estimé** : 4-5h

### Jour 2 - UX Bloquante

- [ ] **Fix inscription** : Email confirmation flow
- [ ] **Fix onboarding** : Invitations
- [ ] **Fix RPC** : Fallback sum_pages_for_org

**Temps estimé** : 2h

### Jour 3 - Qualité

- [ ] **Nettoyer logs** suspicious
- [ ] **Tester MCP** mode production
- [ ] **Tests complets** end-to-end

**Temps estimé** : 2h

---

## 📝 Détails Techniques

### Fix 1 : Middleware Auth Routes Admin

Créer `lib/api/auth-middleware.ts` :

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function withAuth(
  handler: (req: NextRequest, session: any) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    return handler(req, session);
  };
}

export async function withOrgAccess(
  handler: (req: NextRequest, session: any, orgId: string) => Promise<NextResponse>
) {
  return withAuth(async (req, session) => {
    const orgId = req.nextUrl.searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'MISSING_ORG_ID' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', session.user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'ACCESS_DENIED' }, { status: 403 });
    }

    return handler(req, session, orgId);
  });
}
```

Utiliser dans routes :

```typescript
// app/api/admin/list-projects/route.ts
import { withOrgAccess } from '@/lib/api/auth-middleware';

export const GET = withOrgAccess(async (request, session, orgId) => {
  // ✅ Auth + org access vérifié
  const supabase = createRouteHandlerClient({ cookies });

  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('org_id', orgId);

  return NextResponse.json({ projects: data });
});
```

---

### Fix 2 : Migration CV Path

```sql
-- supabase/migrations/011_add_cv_path_column.sql

-- Ajouter colonne cv_path
ALTER TABLE candidates
ADD COLUMN cv_path TEXT;

-- Index pour recherche rapide
CREATE INDEX idx_candidates_cv_path ON candidates(cv_path) WHERE cv_path IS NOT NULL;

-- Migrer données existantes (extraire path depuis notes)
UPDATE candidates
SET cv_path = substring(notes FROM 'Path: (.+)')
WHERE notes LIKE '%Path:%';

-- Commentaire
COMMENT ON COLUMN candidates.cv_path IS 'Chemin du fichier CV dans Supabase Storage';
```

---

### Fix 3 : Email Confirmation Flow

Créer `app/auth/check-email/page.tsx` :

```typescript
export default function CheckEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Vérifiez votre email</h2>
          <p className="mt-4 text-gray-600">
            Un lien de confirmation a été envoyé à votre adresse email.
          </p>
          <p className="mt-2 text-gray-600">
            Cliquez sur le lien dans l'email pour activer votre compte.
          </p>

          <div className="mt-6">
            <a
              href="/login"
              className="text-blue-600 hover:underline"
            >
              Retour à la connexion
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Mettre à jour `app/register/page.tsx` :

```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});

if (error) throw error;

// Vérifier si confirmation requise
if (data.user && !data.session) {
  // Email confirmation requise
  router.push('/auth/check-email');
  return;
}

// Session active = pas de confirmation ou auto-confirmée
router.push('/onboarding');
```

---

### Fix 4 : Invitation Onboarding

Migration :

```sql
-- supabase/migrations/012_invitation_system.sql

-- Rendre user_id nullable (invitation pending)
ALTER TABLE organization_members
ALTER COLUMN user_id DROP NOT NULL;

-- Ajouter contrainte : user_id OU invited_email doit être renseigné
ALTER TABLE organization_members
ADD CONSTRAINT check_user_or_invite
CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL);

-- Index sur invited_email
CREATE INDEX idx_org_members_invited_email
ON organization_members(invited_email)
WHERE invited_email IS NOT NULL;
```

Code :

```typescript
// app/onboarding/page.tsx
await supabase
  .from('organization_members')
  .insert({
    org_id: orgId,
    user_id: null,  // ← Invitation pending
    invited_email: email,
    role: 'member',
  });

// Envoyer email d'invitation
await fetch('/api/auth/send-invitation', {
  method: 'POST',
  body: JSON.stringify({ email, orgId }),
});
```

---

## ✅ Checklist de Vérification

### Sécurité
- [ ] Toutes routes `/api/admin/*` ont middleware auth
- [ ] Aucun master admin hardcodé
- [ ] `cv_path` en colonne dédiée
- [ ] RLS actif partout (pas supabaseAdmin)
- [ ] Tests de pénétration basiques

### UX
- [ ] Inscription fonctionne (avec et sans confirmation)
- [ ] Onboarding complet sans erreur
- [ ] Invitation membres fonctionne
- [ ] Dashboard charge sans crash

### Qualité
- [ ] Logs propres (pas de faux positifs)
- [ ] MCP testé en mode production
- [ ] Tests E2E passent
- [ ] Documentation à jour

---

**Créé le** : 2025-10-27
**Auteur** : Claude Code (review utilisateur)
**Priorité** : 🔴 CRITIQUE

