import { NextResponse } from "next/server";


export async function GET() {
  return NextResponse.json({
    OPENAI_KEY: process.env.OPENAI_API_KEY ? "✅ Loaded" : "❌ Not found",
    MODEL: process.env.CM_OPENAI_MODEL || "not set"
  });
}
