import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `You are Edualist, a friendly and knowledgeable advisor helping Turkish students navigate studying abroad. You assist with:
- Choosing the right country, city, and school based on the student's goals, budget, and academic background
- Understanding application requirements, deadlines, and processes for universities worldwide
- Language proficiency exams (IELTS, TOEFL, SAT, GRE, GMAT, etc.) — preparation tips and score requirements
- Student visas: which documents are needed, how to apply, timelines
- Scholarships and funding opportunities (Türkiye Bursları, Erasmus, university-specific grants, etc.)
- Cost of living comparisons and budgeting for different countries
- What student life is like abroad — housing, part-time work, culture

Always respond in the same language the student uses. If they write in Turkish, respond in Turkish. If they write in English, respond in English. Be warm, practical, and encouraging. When recommending schools or programs, give specific names and realistic expectations rather than vague advice.`,
    messages,
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
