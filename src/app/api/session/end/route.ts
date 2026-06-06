import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const { messages, answers } = (await req.json()) as {
      messages: Message[];
      answers: string[];
    };

    if (!messages?.length) return new Response("ok");

    const profile = answers
      ?.filter((a) => a && a !== "—")
      .join(" · ");

    const transcript = messages
      .map((m) =>
        m.role === "user"
          ? `👤 Kullanıcı:\n${m.content}`
          : `🤖 Edualist:\n${m.content}`
      )
      .join("\n\n---\n\n");

    const date = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

    const html = `
<h2>Edualist — Sohbet Özeti</h2>
<p><strong>Tarih:</strong> ${date}</p>
${profile ? `<p><strong>Profil:</strong> ${profile}</p>` : ""}
<hr/>
<pre style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6">${transcript}</pre>
    `.trim();

    const { data, error } = await getResend().emails.send({
      from: "Edualist <noreply@edubot.com.tr>",
      to: "ceo@edualist.com",
      subject: `Sohbet Logu — ${date}`,
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
