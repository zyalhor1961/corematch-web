import { NextResponse } from 'next/server';

export async function GET() {
  const providers = {
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    claude: !!process.env.ANTHROPIC_API_KEY,
  };

  const available = Object.values(providers).filter(Boolean).length;

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers,
    available,
    message: `${available}/3 providers available`,
    env: {
      hasGeminiKey: providers.gemini,
      geminiKeyName: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'GOOGLE_GENERATIVE_AI_API_KEY' : 'none',
    },
  });
}
