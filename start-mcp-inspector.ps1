# Script PowerShell pour lancer MCP Inspector avec les bonnes variables d'environnement
# Usage: .\start-mcp-inspector.ps1

Write-Host "🚀 Starting MCP Inspector with production environment..." -ForegroundColor Green
Write-Host ""

# Charger les variables d'environnement depuis .env.production
if (Test-Path ".env.production") {
    Write-Host "📄 Loading .env.production..." -ForegroundColor Cyan
    Get-Content .env.production | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim('"')
            $value = $matches[2].Trim('"')
            [Environment]::SetEnvironmentVariable($key, $value)
            Write-Host "   ✓ $key" -ForegroundColor Gray
        }
    }
    Write-Host ""
} else {
    Write-Host "❌ .env.production not found!" -ForegroundColor Red
    exit 1
}

# Vérifier les variables critiques
Write-Host "🔍 Verifying environment variables..." -ForegroundColor Cyan
$requiredVars = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "MCP_AUTH_HEADER",
    "OPENAI_API_KEY"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ([string]::IsNullOrEmpty($value)) {
        $missingVars += $var
        Write-Host "   ❌ $var (MISSING)" -ForegroundColor Red
    } else {
        $preview = if ($value.Length -gt 30) { $value.Substring(0, 30) + "..." } else { $value }
        Write-Host "   ✓ $var = $preview" -ForegroundColor Green
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Missing required variables!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ All environment variables loaded!" -ForegroundColor Green
Write-Host ""

# Lancer MCP Inspector
Write-Host "🎯 Launching MCP Inspector..." -ForegroundColor Cyan
Write-Host "   Server: npx tsx bin/mcp-server.ts" -ForegroundColor Gray
Write-Host ""

npx @modelcontextprotocol/inspector npx tsx bin/mcp-server.ts
