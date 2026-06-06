import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { embedTexts } from "@/lib/voyage";

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
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`KHDA fetch failed: ${res.status}`);
  const html = await res.text();

  const docs: RawDocument[] = [];
  const ratingPattern = /khda-badge-dsib\s+rating-([\w-]+)[^>]*>.*?href="([^"]+)"[^>]*>\s*([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = ratingPattern.exec(html)) !== null) {
    const [, rating, href, name] = match;
    const schoolName = name.trim();
    if (!schoolName) continue;
    docs.push({
      source: "khda",
      school_name: schoolName,
      title: `${schoolName} — KHDA Rating`,
      content: `Okul: ${schoolName}. KHDA değerlendirmesi: ${rating.replace(/-/g, " ")}. Kaynak: KHDA (Dubai Knowledge and Human Development Authority).`,
      url: `https://web.khda.gov.ae${href}`,
      metadata: { rating },
    });
  }

  return docs;
}

async function scrapeReddit(): Promise<RawDocument[]> {
  const subreddits = ["dubai", "DubaiExpats", "UAE"];
  const queries = ["KHDA school rating", "international school Dubai", "Dubai school expat"];
  const docs: RawDocument[] = [];
  const seen = new Set<string>();

  for (const sub of subreddits) {
    for (const q of queries) {
      try {
        const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(q)}&sort=top&limit=10&t=year`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Edualist/1.0 (educational research)" },
        });
        if (!res.ok) continue;
        const json = await res.json();
        const posts = json?.data?.children ?? [];

        for (const { data: post } of posts) {
          if (seen.has(post.id)) continue;
          seen.add(post.id);

          const content = [post.title, post.selftext]
            .filter(Boolean)
            .join("\n")
            .slice(0, 1500);

          if (content.length < 100) continue;

          docs.push({
            source: "reddit",
            title: post.title,
            content,
            url: `https://reddit.com${post.permalink}`,
            metadata: { subreddit: sub, score: post.score, query: q },
          });
        }
      } catch {
        // skip failed subreddit/query combos
      }
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

    const { error } = await supabase.from("documents").insert(rows);
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
