# Production Deployment Guide

## Overview
This guide covers deploying CoreMatch OS to production using Railway for both the Next.js frontend and Python Brain microservice.

## Architecture

```
┌─────────────────────────┐
│   Railway Service 1     │
│   Next.js Frontend      │
│   Port: 3000            │
└───────────┬─────────────┘
            │
            ├──────────────────────┐
            │                      │
            ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│   Railway Service 2 │  │   Supabase          │
│   Python Brain      │  │   Database          │
│   Port: 8000        │  │   Realtime          │
└─────────────────────┘  └─────────────────────┘
```

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Push your code to GitHub
3. **Supabase Project**: Production Supabase instance
4. **Environment Variables**: Prepare all secrets

## Part 1: Deploy Python Brain Service

### Step 1: Create New Railway Project
1. Go to [railway.app/new](https://railway.app/new)
2. Click "Deploy from GitHub repo"
3. Select your repository
4. Click "Add variables" before deploying

### Step 2: Configure Python Service
1. **Root Directory**: Set to `python-service`
2. **Build Command**: (Auto-detected from Dockerfile)
3. **Start Command**: (Auto-detected from Dockerfile)

### Step 3: Add Environment Variables
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

### Step 4: Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Railway will assign a URL like: `https://python-service-production-xxxx.up.railway.app`
4. **Copy this URL** - you'll need it for Next.js

### Step 5: Verify Python Service
```bash
curl https://your-python-service.up.railway.app/
# Should return: {"status": "CoreMatch Brain is operational 🧠"}
```

## Part 2: Deploy Next.js Frontend

### Step 1: Create Second Railway Service
1. In the same Railway project, click "New Service"
2. Select "GitHub Repo" again
3. Choose the same repository
4. This time, configure for Next.js (root directory)

### Step 2: Configure Next.js Service
1. **Root Directory**: `.` (root)
2. **Build Command**: `npm run build`
3. **Start Command**: `node server.js`

### Step 3: Add Environment Variables
```env
# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Python Brain Service (Internal)
PYTHON_SERVICE_URL=https://your-python-service.up.railway.app

# Other environment variables
NODE_ENV=production
```

### Step 4: Deploy
1. Click "Deploy"
2. Wait for build (may take 3-5 minutes)
3. Railway will assign a URL like: `https://corematch-production-xxxx.up.railway.app`

### Step 5: Verify Next.js
1. Visit your Railway URL
2. Navigate to an invoice detail page
3. Click "Analyze" to test the full integration

## Part 3: Custom Domain (Optional)

### For Next.js Service
1. Go to Railway project → Next.js service → Settings
2. Click "Generate Domain" or "Custom Domain"
3. Add your domain: `app.corematch.com`
4. Update DNS records as instructed

### For Python Service
1. Usually kept internal (not public)
2. If needed, add domain: `brain.corematch.com`

## Environment Variables Reference

### Next.js Service
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGc...` |
| `PYTHON_SERVICE_URL` | Python Brain URL | `https://brain.railway.app` |
| `NODE_ENV` | Environment | `production` |

### Python Service
| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJhbGc...` |

## Troubleshooting

### Build Fails: "Module not found"
**Solution**: Check `package.json` includes all dependencies
```bash
npm install
npm run build  # Test locally first
```

### Python Service: "Supabase connection failed"
**Solution**: 
- Verify `SUPABASE_SERVICE_KEY` is the **service role** key (not anon)
- Check Supabase project is not paused
- Test connection locally first

### Next.js: "Failed to reach Neural Core"
**Solution**:
- Verify `PYTHON_SERVICE_URL` points to Railway Python service
- Check Python service is deployed and running
- Test Python service health endpoint

### CORS Errors
**Solution**: Python service already has CORS configured for production
```python
# In main.py - already configured
allow_origins=["http://localhost:3001", "http://localhost:3000"]
```
Update to include your production domain:
```python
allow_origins=["https://your-app.railway.app"]
```

## Monitoring

### Railway Logs
```bash
# View Next.js logs
railway logs --service nextjs

# View Python logs
railway logs --service python
```

### Supabase Monitoring
1. Go to Supabase Dashboard
2. Check "Database" → "Logs"
3. Monitor `jobs` table for agent activity

## Scaling

### Horizontal Scaling
Railway auto-scales based on traffic. For manual control:
1. Go to Service → Settings
2. Adjust "Replicas" (Pro plan required)

### Database Connection Pooling
For high traffic, enable Supabase connection pooling:
1. Supabase Dashboard → Settings → Database
2. Enable "Connection Pooling"
3. Use pooled connection string

## Security Checklist

- [ ] All secrets in Railway environment variables (not in code)
- [ ] Supabase RLS policies enabled
- [ ] CORS configured for production domain
- [ ] HTTPS enforced (Railway does this automatically)
- [ ] Service role key never exposed to client
- [ ] Rate limiting configured (optional)

## Cost Estimation

### Railway (Hobby Plan - $5/month)
- 2 services (Next.js + Python)
- 500 hours/month execution time
- Shared CPU/RAM

### Railway (Pro Plan - $20/month)
- Unlimited services
- Dedicated resources
- Custom domains
- Better performance

### Supabase (Free Tier)
- 500MB database
- 1GB file storage
- 2GB bandwidth
- Realtime included

## Next Steps After Deployment

1. **Monitor Performance**: Use Railway metrics
2. **Set Up Alerts**: Configure Railway notifications
3. **Add Analytics**: Integrate Vercel Analytics or similar
4. **Enable Caching**: Add Redis for session management
5. **CI/CD Pipeline**: Automate deployments with GitHub Actions

## Alternative: Vercel Deployment

If you prefer Vercel for Next.js:

### Next.js on Vercel
1. Import GitHub repo to Vercel
2. Add environment variables
3. Deploy

### Python on Railway
1. Keep Python service on Railway
2. Update `PYTHON_SERVICE_URL` in Vercel

This hybrid approach works well for Next.js-heavy apps.

## Support

- Railway Docs: https://docs.railway.app
- Supabase Docs: https://supabase.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment