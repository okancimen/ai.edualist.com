import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { embedTexts } from "@/lib/voyage";

export const maxDuration = 300;

type RawDocument = {
  source: string;
  school_name?: string;
  title?: string;
  content: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

async function scrapeReddit(): Promise<RawDocument[]> {
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

        const text = (title + " " + desc).toLowerCase();
        const relevant = ["school", "khda", "curriculum", "education", "ib ", "british", "american", "montessori", "fees", "admission"].some(k => text.includes(k));
        if (!relevant) continue;

        docs.push({ source: "reddit", title, content: desc, url: link, metadata: { feed: feedUrl } });
      }
    } catch {
      // skip failed feeds
    }
  }

  return docs;
}

async function ingestDocuments(docs: RawDocument[]) {
  if (!docs.length) return { inserted: 0 };

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

export async function GET(req: NextRequest) {
  // Vercel passes Authorization: Bearer <CRON_SECRET> on cron invocations
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const docs = await scrapeReddit();
    const result = await ingestDocuments(docs);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
