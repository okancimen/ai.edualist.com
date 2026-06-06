const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function embedTexts(texts: string[]): Promise<number[][]> {
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(20_000 * attempt); // back-off: 20s, 40s, 60s

    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: texts, model: "voyage-3" }),
    });

    if (res.status === 429) {
      lastErr = new Error("Voyage AI rate limit");
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Voyage AI error: ${err}`);
    }

    const data = await res.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }
  throw lastErr ?? new Error("Voyage AI failed after retries");
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
