# Setup 1Password for DAF Secrets

## Prerequisites
- 1Password CLI installed (`op` command available)
- Authenticated with your CoreMatch vault (`op signin`)

## Create Required Items

### 1. Landing AI Vision Agent (VA_API_KEY)

```bash
# Create the item (replace YOUR_ACTUAL_LANDING_AI_KEY with your key from Vercel)
# Note: The environment variable name is VA_API_KEY (not VISION_AGENT_API_KEY)
op item create --vault="CoreMatch" \
  --category="password" \
  --title="Landing AI Vision Agent" \
  password="YOUR_ACTUAL_LANDING_AI_KEY"
```

### 2. Azure Document Intelligence

```bash
# Create the item with multiple fields
op item create --vault="CoreMatch" \
  --category="login" \
  --title="Azure Document Intelligence" \
  endpoint="https://your-resource-name.cognitiveservices.azure.com/" \
  api_key="YOUR_ACTUAL_AZURE_DI_API_KEY_HERE"
```

## Verify Items Were Created

```bash
# List items in CoreMatch vault
op item list --vault="CoreMatch"

# Test reading each secret
op read "op://CoreMatch/Landing AI Vision Agent/password"
op read "op://CoreMatch/Azure Document Intelligence/endpoint"
op read "op://CoreMatch/Azure Document Intelligence/api_key"
```

## After Items Are Created

Once verified, you can remove these lines from `.env.local` (they'll be read from 1Password for local dev):

```
# Remove these from .env.local:
VA_API_KEY=your_landing_ai_key_here
AZURE_DI_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
AZURE_DI_API_KEY=YOUR_ACTUAL_AZURE_DI_API_KEY_HERE
```

## How It Works

The code will:
1. **In Vercel (production)**: Read from Vercel environment variables
2. **In local dev**: Read from 1Password CLI using the references:
   - `op://CoreMatch/Landing AI Vision Agent/password`
   - `op://CoreMatch/Azure Document Intelligence/endpoint`
   - `op://CoreMatch/Azure Document Intelligence/api_key`

## Important Notes

- The Landing AI key placeholder in `.env.local` needs to be replaced with your actual key before creating the 1Password item
- You already added the Landing AI key to Vercel, so retrieve it from there
- Supabase secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) should also remain in `.env.local` for now OR be added to 1Password following the same pattern
