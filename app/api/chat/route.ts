// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";              // ✅ évite Edge runtime
export const dynamic = "force-dynamic";       // ✅ pas de cache

const SYSTEM_PROMPT = `Tu es "CoreMatch Assistant".
Tu aides les recruteurs: améliorer l'offre d'emploi, analyser/scorer les CV,
et expliquer clairement les étapes d'automatisation (n8n, OCR, etc.). 
Style: clair, professionnel, concis.`;

function jsonError(message: string, status = 500) {
  console.error("[/api/chat] ERROR:", message);
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    const MODEL = process.env.CM_OPENAI_MODEL || "gpt-4o-mini";

    if (!OPENAI_KEY) return jsonError("OPENAI_API_KEY manquant côté serveur");
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      return jsonError("Env Supabase manquantes (URL / SERVICE_ROLE)");
    }

    const body = await req.json();
    const { messages, conversationId, deviceId } = body as {
      messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
      conversationId?: string | null;
      deviceId?: string | null;
    };

    if (!messages || !Array.isArray(messages)) {
      return jsonError("payload.messages invalide", 400);
    }

    // 1) Conversation: créer si absente
    let convId = conversationId ?? null;
    if (!convId) {
      const { data, error } = await supabaseAdmin
        .from("conversations")
        .insert({ device_id: deviceId || null })
        .select("id")
        .single();
      if (error) return jsonError("Supabase insert(conversations): " + error.message);
      convId = data.id;
    }

    // 2) Stocker le dernier message user
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser?.content) {
      const { error } = await supabaseAdmin.from("messages").insert({
        conversation_id: convId,
        role: "user",
        content: lastUser.content,
      });
      if (error) console.warn("Supabase insert(user msg) WARN:", error.message);
    }

    // 3) Appel OpenAI
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: Number(process.env.CM_TEMPERATURE ?? 0.6),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("[OpenAI error]", r.status, txt);
      return jsonError(`OpenAI ${r.status}: ${txt}`, 502);
    }

    const data = await r.json();
    const reply: string =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Je n'ai pas de réponse pour le moment.";

    // 4) Stocker la réponse assistant
    const { error: insErr } = await supabaseAdmin.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: reply,
    });
    if (insErr) console.warn("Supabase insert(assistant msg) WARN:", insErr.message);

    return NextResponse.json({ reply, conversationId: convId });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "unknown";
    const errorStack = e instanceof Error ? e.stack : undefined;
    console.error("[/api/chat] FATAL:", errorStack || errorMessage || e);
    return jsonError("Server error: " + errorMessage);
  }
}
