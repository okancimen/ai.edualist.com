import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const { messages, answers, userName, userEmail } = (await req.json()) as {
      messages: Message[];
      answers: string[];
      userName?: string;
      userEmail?: string;
    };

    if (!messages?.length) return new Response("ok");

    // Save session to Supabase for daily stats
    await getSupabase().from("sessions").insert({
      user_name: userName || null,
      user_email: userEmail || null,
      answers: answers || [],
      message_count: messages.length,
    }).then(({ error }) => {
      if (error) console.error("Session insert error:", error.message);
    });

    const profile = answers
      ?.filter((a) => a && a !== "—")
      .join(" · ");

    const transcript = messages
      .map((m) =>
        m.role === "user"
          ? `👤 Kullanıcı:\n${m.content}`
          : `🤖 Ela:\n${m.content}`
      )
      .join("\n\n---\n\n");

    const date = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

    const html = `
<h2>Ela by Edualist — Sohbet Özeti</h2>
<p><strong>Tarih:</strong> ${date}</p>
${userName ? `<p><strong>Ad:</strong> ${userName}</p>` : ""}
${userEmail ? `<p><strong>E-posta:</strong> <a href="mailto:${userEmail}">${userEmail}</a></p>` : ""}
${profile ? `<p><strong>Profil:</strong> ${profile}</p>` : ""}
<hr/>
<pre style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6">${transcript}</pre>
    `.trim();

    const { data, error } = await getResend().emails.send({
      from: "Edubot <noreply@edubot.com.tr>",
      to: "ceo@edualist.com",
      subject: `Ela — Sohbet Logu — ${date}`,
      html,
    });

    if (error) {
      console.error("Resend error:", JSON.stringify(error));
      return new Response(JSON.stringify(error), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, id: data?.id }));
  } catch (e) {
    console.error("Session end error:", e);
    return new Response(String(e), { status: 500 });
  }
}
