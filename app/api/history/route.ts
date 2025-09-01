import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/history?conversationId=...&limit=50&cursor=msg_id
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const cursor = searchParams.get("cursor"); // id du dernier message reçu (pagination)

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId requis" }, { status: 400 });
    }

    // 1) deviceId envoyé par le client (via header) pour vérifier l'appartenance
    const deviceId = req.headers.get("x-device-id") || "";

    // 2) Vérifier que la conversation existe et appartient au device (ou laisser passer si pas de device check)
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .select("id, device_id")
      .eq("id", conversationId)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    }
    if (conv.device_id && deviceId && conv.device_id !== deviceId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // 3) Charger messages (pagination simple)
    let q = supabaseAdmin
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (cursor) {
      // on reprend après le message 'cursor'
      const { data: pivot, error: pivotErr } = await supabaseAdmin
        .from("messages")
        .select("created_at")
        .eq("id", cursor)
        .single();
      if (!pivotErr && pivot) {
        q = q.gt("created_at", pivot.created_at);
      }
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    // nextCursor = dernier id renvoyé (si on a pile 'limit' messages)
    const nextCursor = rows && rows.length === limit ? rows[rows.length - 1].id : null;

    return NextResponse.json({
      messages: rows?.map((m) => ({
        id: m.id,
        type: m.role === "assistant" ? "bot" : "user",
        content: m.content,
        timestamp: m.created_at,
      })) || [],
      nextCursor,
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
