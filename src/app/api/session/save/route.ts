import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { sessionId, messages, userName, userEmail, utm } = await req.json();
    if (!sessionId || !messages?.length) return new Response("ok");

    const { error } = await getSupabase()
      .from("sessions")
      .upsert(
        {
          session_id: sessionId,
          user_name: userName || null,
          user_email: userEmail || null,
          answers: [],
          message_count: messages.length,
          messages,
          utm_source: utm?.source || null,
          utm_medium: utm?.medium || null,
          utm_campaign: utm?.campaign || null,
        },
        { onConflict: "session_id" }
      );

    if (error) console.error("Session upsert error:", error.message);
    return new Response("ok");
  } catch (e) {
    console.error("Session save error:", e);
    return new Response("ok");
  }
}
