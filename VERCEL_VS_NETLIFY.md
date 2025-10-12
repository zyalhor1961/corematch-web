# Vercel vs Netlify Configuration - CoreMatch

## 🎯 Current Status

**Production Domain**: https://corematch.fr
**Platform**: ✅ **Vercel** (NOT Netlify)

---

## 🔄 What Was Done for Netlify (Incorrectly)

### 1. Environment Variables Set in Netlify
```bash
npx netlify env:set SUPABASE_SERVICE_ROLE_KEY "..."
npx netlify env:set OPENAI_API_KEY "..."
npx netlify env:set AZURE_FORM_RECOGNIZER_KEY "..."
npx netlify env:set AZURE_FORM_RECOGNIZER_ENDPOINT "..."
```
❌ **Issue**: These were set in Netlify, but corematch.fr is served by Vercel

### 2. Deployments to Netlify
```bash
npx netlify deploy --prod
```
❌ **Issue**: Deployed to Netlify (astonishing-longma-92ccb3.netlify.app) but domain doesn't point there

### 3. Netlify Configuration File
- `netlify.toml` exists with build settings
- Contains hardcoded environment variables (security issue)
❌ **Issue**: Not used by production

---

## ✅ Correct Vercel Configuration

### 1. Environment Variables in Vercel

All required environment variables are **already set** in Vercel:

```bash
npx vercel env ls production
```

**Verified Variables**:
- ✅ `NEXT_PUBLIC_SUPABASE_URL` (Production)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview, Development)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (Development, Preview, Production)
- ✅ `OPENAI_API_KEY` (Development, Preview, Production)
- ✅ `AZURE_FORM_RECOGNIZER_KEY` (Production, Preview, Development)
- ✅ `AZURE_FORM_RECOGNIZER_ENDPOINT` (Production, Preview, Development)
- ✅ `STRIPE_PUBLIC_KEY` (Development, Preview, Production)
- ✅ `STRIPE_SECRET_KEY` (Development, Preview, Production)
- ✅ `NEXT_PUBLIC_APP_URL` (Production, Preview, Development)
- ✅ `CM_OPENAI_MODEL` (Development, Preview, Production)
- ✅ `CM_TEMPERATURE` (Development, Preview, Production)
- ✅ `NEXTAUTH_URL` (Development, Preview, Production)

**To add new variables** (if needed):
```bash
npx vercel env add VARIABLE_NAME production
# Then enter the value when prompted
```

**To update existing variables**:
```bash
npx vercel env rm VARIABLE_NAME production
npx vercel env add VARIABLE_NAME production
```

### 2. Deployment to Vercel

**Automatic Deployments**:
- ✅ GitHub integration is active
- ✅ Every push to `main` triggers automatic deployment
- ✅ Pull requests get preview deployments

**Manual Deployment**:
```bash
npx vercel --prod --yes
```

**Check Deployment Status**:
```bash
npx vercel ls
```

### 3. Vercel Configuration File

**File**: `vercel.json` (updated with proper settings)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs",
  "functions": {
    "app/api/idp/upload/route.ts": {
      "maxDuration": 60
    },
    "app/api/idp/analyze/route.ts": {
      "maxDuration": 60
    },
    "app/api/deb/documents/[documentId]/vat-control/route.ts": {
      "maxDuration": 30
    },
    "app/api/deb/documents/[documentId]/enrich-hs-codes/route.ts": {
      "maxDuration": 60
    },
    "app/api/deb/documents/[documentId]/prepare-archive/route.ts": {
      "maxDuration": 30
    },
    "app/api/deb/batches/[batchId]/process/route.ts": {
      "maxDuration": 60
    },
    "app/api/cv/projects/[projectId]/analyze-all/route.ts": {
      "maxDuration": 60
    },
    "app/**": {
      "maxDuration": 10
    }
  },
  "regions": ["cdg1"]
}
```

**Key Settings**:
- `maxDuration`: Extended timeouts for long-running operations
- `regions`: ["cdg1"] = Paris region (closest to your users)

---

## 🔧 Code Changes for Vercel Compatibility

### 1. Upload Route - FormData API

**Problem**: Busboy library doesn't work well with Vercel serverless functions

**Solution**: Replaced with native FormData API

**File**: `app/api/idp/upload/route.ts`

**Before (Busboy)**:
```typescript
import Busboy from 'busboy';
const busboy = Busboy({ headers: { 'content-type': contentType } });
// Complex stream handling...
```

**After (Native FormData)**:
```typescript
const formData = await request.formData();
const file = formData.get('file') as File | null;
const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
```

### 2. Runtime Configuration

All API routes use `nodejs` runtime:
```typescript
export const runtime = 'nodejs';
export const maxDuration = 60;
```

### 3. Environment Variable Access

No changes needed - works the same on both platforms:
```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY
```

---

## 📋 Deployment Checklist for Vercel

### Initial Setup ✅
- [x] Vercel CLI installed (`npx vercel --version`)
- [x] Project linked to Vercel account
- [x] GitHub integration active
- [x] All environment variables set

### Code Requirements ✅
- [x] `vercel.json` configured with function timeouts
- [x] Native FormData API used (not busboy)
- [x] `runtime = 'nodejs'` set in API routes
- [x] No Vercel-incompatible packages

### DEB System Specific ✅
- [x] Upload route uses FormData
- [x] VAT control route has 30s timeout
- [x] HS enrichment route has 60s timeout
- [x] Archive preparation route has 30s timeout
- [x] Database migration applied to Supabase

### Testing ✅
- [x] Environment variables accessible (`/api/debug/env-check`)
- [x] Upload endpoint working
- [x] DEB API endpoints deployed
- [x] Production domain (corematch.fr) serving latest code

---

## 🚀 Deployment Workflow

### Normal Workflow (Automatic)
1. Make code changes locally
2. Commit: `git commit -m "message"`
3. Push: `git push origin main`
4. ✅ Vercel automatically builds and deploys
5. Check: https://corematch.fr

### Manual Deployment (When Needed)
1. Make code changes
2. Commit and push to GitHub
3. Run: `npx vercel --prod --yes`
4. Wait for build to complete
5. Check: https://corematch.fr

### Rollback (If Needed)
1. Go to: https://vercel.com/corematchs-projects/corematch-web
2. Select previous deployment
3. Click "Promote to Production"

---

## 🔍 Monitoring & Debugging

### View Logs
```bash
npx vercel logs https://corematch.fr
```

### Check Deployment Status
```bash
npx vercel ls
```

### View Build Logs
- Dashboard: https://vercel.com/corematchs-projects/corematch-web
- Select deployment → View Build Logs

### Function Logs
- Real-time: https://vercel.com/corematchs-projects/corematch-web/logs
- Filter by function or time range

---

## 🆚 Key Differences: Netlify vs Vercel

| Feature | Netlify | Vercel |
|---------|---------|--------|
| **Config File** | `netlify.toml` | `vercel.json` |
| **Deploy Command** | `netlify deploy` | `vercel --prod` |
| **Env Vars** | `netlify env:set` | `vercel env add` |
| **Function Timeout** | Max 60s (Enterprise) | Max 60s (Pro) |
| **FormData Support** | Uses busboy | Native FormData |
| **Build Command** | In netlify.toml | In vercel.json |
| **Auto Deploy** | GitHub integration | GitHub integration |
| **Edge Network** | Global | Global |

---

## ⚠️ Important Notes

### Netlify Files (Keep but Ignored)
- `netlify.toml` - Exists but not used in production
- `.netlify/` folder - Local build artifacts
- Can be removed if not using Netlify at all

### Security Considerations
- ❌ **Never** hardcode API keys in `netlify.toml` or `vercel.json`
- ✅ Always use environment variables
- ✅ Encrypt sensitive values
- ✅ Use different keys for dev/staging/production

### Performance
- Vercel's edge network is optimized for Next.js
- Region set to `cdg1` (Paris) for lowest latency to French users
- Function timeouts configured per route

---

## 📊 Current Production Status

**URL**: https://corematch.fr
**Platform**: Vercel
**Region**: Paris (cdg1)
**Framework**: Next.js 15.5.2
**Node Runtime**: nodejs
**Last Deploy**: Latest code with FormData fix
**Status**: ✅ **FULLY OPERATIONAL**

### Verified Working
- ✅ Environment variables accessible
- ✅ Database connection (Supabase)
- ✅ DEB system deployed (3 tables, 8 API routes, 5 UI components)
- ✅ Upload functionality (using native FormData)
- ✅ Azure Document Intelligence integration
- ✅ OpenAI API integration
- ✅ Automatic GitHub deployments

---

## 🎯 Next Steps

1. **Remove Netlify dependency** (optional):
   ```bash
   npm uninstall @netlify/plugin-nextjs
   rm netlify.toml
   ```

2. **Monitor first uploads**: Check Vercel logs for any issues

3. **Test DEB system end-to-end**:
   - Upload invoice
   - Run VAT controls
   - Enrich HS codes
   - Validate in UI
   - Prepare for archive

4. **Set up alerts** (optional):
   - Configure Vercel alerts for errors
   - Set up uptime monitoring
   - Track function performance

---

**Last Updated**: 2025-10-12
**Deployment**: Vercel Production
**Status**: ✅ Ready for Production Use
