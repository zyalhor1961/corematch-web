import { NextResponse } from 'next/server';

export async function GET() {
  // Vérifier la présence des clés API
  const apiKeys = {
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    claude: !!process.env.ANTHROPIC_API_KEY,
  };

  const available = Object.values(apiKeys).filter(Boolean).length;

  // Tester l'instanciation des providers
  const providerTests: Record<string, { available: boolean; working: boolean; error?: string }> = {
    openai: { available: apiKeys.openai, working: false },
    gemini: { available: apiKeys.gemini, working: false },
    claude: { available: apiKeys.claude, working: false },
  };

  // Test OpenAI
  if (apiKeys.openai) {
    try {
      const { createOpenAIProvider } = await import('@/lib/cv-analysis/providers/openai-provider');
      const provider = createOpenAIProvider();
      providerTests.openai.working = true;
    } catch (error) {
      providerTests.openai.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Test Gemini
  if (apiKeys.gemini) {
    try {
      const { createGeminiProvider } = await import('@/lib/cv-analysis/providers/gemini-provider');
      const provider = createGeminiProvider();
      providerTests.gemini.working = true;
    } catch (error) {
      providerTests.gemini.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Test Claude
  if (apiKeys.claude) {
    try {
      const { createClaudeProvider } = await import('@/lib/cv-analysis/providers/claude-provider');
      const provider = createClaudeProvider();
      providerTests.claude.working = true;
    } catch (error) {
      providerTests.claude.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  const workingCount = Object.values(providerTests).filter(p => p.working).length;

  return NextResponse.json({
    status: workingCount === available ? 'ok' : 'partial',
    timestamp: new Date().toISOString(),
    summary: {
      keysAvailable: available,
      providersWorking: workingCount,
      message: `${workingCount}/${available} providers working`,
    },
    providers: providerTests,
    modes: {
      eco: providerTests.openai.working,
      balanced: providerTests.openai.working && providerTests.gemini.working,
      premium: providerTests.openai.working && providerTests.gemini.working && providerTests.claude.working,
    },
    env: {
      geminiKeyName: process.env.GEMINI_API_KEY
        ? 'GEMINI_API_KEY'
        : process.env.GOOGLE_GENERATIVE_AI_API_KEY
        ? 'GOOGLE_GENERATIVE_AI_API_KEY'
        : 'none',
    },
  });
}
