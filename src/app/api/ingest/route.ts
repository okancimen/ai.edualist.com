import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { embedTexts } from "@/lib/voyage";

export async function GET() {
  return NextResponse.json({ ok: true, route: "ingest" });
}

type RawDocument = {
  source: string;
  school_name?: string;
  title?: string;
  content: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

async function scrapeKhda(): Promise<RawDocument[]> {
  const res = await fetch("https://web.khda.gov.ae/en/Education-Directory/Schools", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Edubot/1.0)" },
  });
  if (!res.ok) throw new Error(`KHDA fetch failed: ${res.status}`);
  const html = await res.text();

  const docs: RawDocument[] = [];

  // Match each school's lnkName anchor, then look back for rating and ahead for area
  const nameRe = /<a\s+id="lnkName"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = nameRe.exec(html)) !== null) {
    const href = match[1];
    const schoolName = match[2].trim();
    if (!schoolName) continue;

    // Rating is in the preceding ~3000 chars of the block
    const before = html.substring(Math.max(0, match.index - 3000), match.index);
    const ratingMatches = before.match(/rating-(outstanding|very-good|good|acceptable|not-inspected-yet)/g);
    const rating = ratingMatches ? ratingMatches[ratingMatches.length - 1].replace("rating-", "") : "unknown";

    // Area is right after the anchor
    const after = html.substring(match.index, match.index + 400);
    const areaMatch = after.match(/<span[^>]*id="lblArea"[^>]*>([^<]+)<\/span>/);
    const area = areaMatch ? areaMatch[1].trim() : "";

    const ratingLabel = rating.replace(/-/g, " ");
    docs.push({
      source: "khda",
      school_name: schoolName,
      title: `${schoolName} — KHDA Rating`,
      content: `Okul: ${schoolName}. KHDA değerlendirmesi: ${ratingLabel}. ${area ? `Konum: ${area}, Dubai.` : "Dubai."} Kaynak: KHDA (Dubai Knowledge and Human Development Authority). Yıl: 2025-2026.`,
      url: `https://web.khda.gov.ae${href}`,
      metadata: { rating, area },
    });
  }

  return docs;
}

async function scrapeReddit(): Promise<RawDocument[]> {
  // Reddit JSON API now requires OAuth; use RSS feeds which remain open
  const feeds = [
    "https://www.reddit.com/r/dubai/search.rss?q=KHDA+school&sort=top&t=year",
    "https://www.reddit.com/r/dubai/search.rss?q=international+school+Dubai&sort=top&t=year",
    "https://www.reddit.com/r/DubaiExpats/search.rss?q=school+rating&sort=top&t=year",
    "https://www.reddit.com/r/UAE/search.rss?q=Dubai+international+school&sort=top&t=year",
    "https://www.reddit.com/r/dubai/top.rss?t=year",
  ];
  const docs: RawDocument[] = [];
  const seen = new Set<string>();

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "Edualist/1.0 (educational research)" },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      // Reddit feeds use Atom format
      const items = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
      for (const [, item] of items) {
        const title = (item.match(/<title(?:[^>]*)>([\s\S]*?)<\/title>/) ?? [])[1]
          ?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() ?? "";
        const link = (item.match(/<link[^>]+href="([^"]+)"/) ?? [])[1]?.trim() ?? "";
        const desc = (item.match(/<content[^>]*>([\s\S]*?)<\/content>/) ?? [])[1]
          ?.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
          .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200) ?? "";

        if (seen.has(link) || !title || desc.length < 80) continue;
        seen.add(link);

        // Only keep school-relevant posts
        const text = (title + " " + desc).toLowerCase();
        const relevant = ["school", "khda", "curriculum", "education", "ib ", "british", "american", "montessori", "fees", "admission"].some(k => text.includes(k));
        if (!relevant) continue;

        docs.push({
          source: "reddit",
          title,
          content: desc,
          url: link,
          metadata: { feed: feedUrl },
        });
      }
    } catch {
      // skip failed feeds
    }
  }

  return docs;
}

async function ingestDocuments(docs: RawDocument[]) {
  if (!docs.length) return { inserted: 0 };

  // embed in batches of 20
  const batchSize = 20;
  let inserted = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const texts = batch.map((d) => `${d.title ?? ""}\n${d.content}`.trim());
    const embeddings = await embedTexts(texts);

    const rows = batch.map((doc, j) => ({
      source: doc.source,
      school_name: doc.school_name ?? null,
      title: doc.title ?? null,
      content: doc.content,
      url: doc.url ?? null,
      metadata: doc.metadata ?? {},
      embedding: embeddings[j],
    }));

    const { error } = await getSupabase().from("documents").insert(rows);
    if (error) throw new Error(error.message);
    inserted += rows.length;
  }

  return { inserted };
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-ingest-secret") !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await req.json();

  try {
    let docs: RawDocument[] = [];

    if (source === "khda") {
      docs = await scrapeKhda();
    } else if (source === "reddit") {
      docs = await scrapeReddit();
    } else if (source === "all") {
      const [khda, reddit] = await Promise.allSettled([scrapeKhda(), scrapeReddit()]);
      if (khda.status === "fulfilled") docs.push(...khda.value);
      if (reddit.status === "fulfilled") docs.push(...reddit.value);
    } else {
      return NextResponse.json({ error: "Unknown source" }, { status: 400 });
    }

    const result = await ingestDocuments(docs);
    return NextResponse.json({ ok: true, source, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
