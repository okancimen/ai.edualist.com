import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Yesterday's date range (Istanbul time = UTC+3)
  const now = new Date();
  const yesterdayStart = new Date(now);
  yesterdayStart.setUTCHours(yesterdayStart.getUTCHours() - 24);
  const dayBefore = new Date(yesterdayStart);
  dayBefore.setUTCHours(dayBefore.getUTCHours() - 24);

  const { data: sessions, error } = await getSupabase()
    .from("sessions")
    .select("*")
    .gte("created_at", dayBefore.toISOString())
    .lt("created_at", yesterdayStart.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = sessions?.length ?? 0;
  const withEmail = sessions?.filter((s) => s.user_email).length ?? 0;
  const avgMessages = total
    ? Math.round((sessions!.reduce((sum, s) => sum + (s.message_count ?? 0), 0) / total) * 10) / 10
    : 0;

  // Tally onboarding answers
  type AnswerTally = Record<string, number>;
  const levelTally: AnswerTally = {};
  const curriculumTally: AnswerTally = {};
  const budgetTally: AnswerTally = {};

  for (const s of sessions ?? []) {
    const a = Array.isArray(s.answers) ? s.answers : [];
    if (a[0] && a[0] !== "—") levelTally[a[0]] = (levelTally[a[0]] ?? 0) + 1;
    if (a[2] && a[2] !== "—") curriculumTally[a[2]] = (curriculumTally[a[2]] ?? 0) + 1;
    if (a[4] && a[4] !== "—") budgetTally[a[4]] = (budgetTally[a[4]] ?? 0) + 1;
  }

  const toRows = (tally: AnswerTally) =>
    Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`)
      .join("");

  const leads = sessions
    ?.filter((s) => s.user_email)
    .map((s) => `<tr><td>${s.user_name ?? "—"}</td><td><a href="mailto:${s.user_email}">${s.user_email}</a></td><td>${s.message_count}</td></tr>`)
    .join("") ?? "";

  const date = yesterdayStart.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });

  const html = `
<h2>Edubot — Günlük İstatistik Raporu</h2>
<p><strong>Tarih:</strong> ${date}</p>
<hr/>
<h3>Genel</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
  <tr><td>Toplam sohbet</td><td><strong>${total}</strong></td></tr>
  <tr><td>E-posta veren kullanıcı</td><td><strong>${withEmail}</strong></td></tr>
  <tr><td>Ortalama mesaj sayısı</td><td><strong>${avgMessages}</strong></td></tr>
</table>

${total > 0 ? `
<h3>Eğitim Seviyesi</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><tr><th>Seviye</th><th>Sayı</th></tr>${toRows(levelTally)}</table>

<h3>Müfredat</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><tr><th>Müfredat</th><th>Sayı</th></tr>${toRows(curriculumTally)}</table>

<h3>Bütçe</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><tr><th>Bütçe</th><th>Sayı</th></tr>${toRows(budgetTally)}</table>
` : "<p>Dün sohbet yapılmadı.</p>"}

${withEmail > 0 ? `
<h3>Leads (E-posta verenler)</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
  <tr><th>Ad</th><th>E-posta</th><th>Mesaj</th></tr>
  ${leads}
</table>
` : ""}
`.trim();

  const { error: mailError } = await getResend().emails.send({
    from: "Edubot <noreply@edubot.com.tr>",
    to: "ceo@edualist.com",
    subject: `Edubot Günlük Rapor — ${date}`,
    html,
  });

  if (mailError) {
    return NextResponse.json({ error: mailError }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date, total, withEmail });
}
