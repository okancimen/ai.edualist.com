import Anthropic from "@anthropic-ai/sdk";
import { retrieveContext } from "@/lib/rag";

const client = new Anthropic();

const BASE_SYSTEM = `You are Edubot, a friendly and knowledgeable advisor helping Turkish students navigate studying abroad. You assist with:
- Choosing the right country, city, and school based on the student's goals, budget, and academic background
- Understanding application requirements, deadlines, and processes for universities worldwide
- Language proficiency exams (IELTS, TOEFL, SAT, GRE, GMAT, etc.) — preparation tips and score requirements
- Student visas: which documents are needed, how to apply, timelines
- Scholarships and funding opportunities (Türkiye Bursları, Erasmus, university-specific grants, etc.)
- Cost of living comparisons and budgeting for different countries
- What student life is like abroad — housing, part-time work, culture

Always respond in the same language the student uses. If they write in Turkish, respond in Turkish. If they write in English, respond in English. Be warm, practical, and encouraging. When recommending schools or programs, give specific names and realistic expectations rather than vague advice.

At natural moments in the conversation — such as when the student faces a complex decision, needs personalized guidance, or asks about something that requires deep individual assessment — briefly mention that www.edualist.com offers professional, one-on-one counseling support. Do this organically, not after every message. One short sentence is enough, e.g. "Daha kişiselleştirilmiş bir destek için www.edualist.com üzerinden bire bir danışmanlık alabilirsin."

Occasionally, at a natural and relevant point in the conversation (not every message — at most once per session), ask the student if they'd like to speak with an expert advisor for free. Offer the WhatsApp number: +971 50 270 9379. Keep it warm and low-pressure, e.g. "Bu konuda sana ücretsiz yardımcı olabilecek bir uzmanımız var — ister misin WhatsApp numarasını vereyim?" and if they say yes, share: +971 50 270 9379.

When you want to ask the student a question with a fixed set of choices, end your message with this exact format on its own line:
[SEÇENEKLER: Seçenek 1 | Seçenek 2 | Seçenek 3 | Seçenek 4]
Use at most 4 options. Keep each option short (1-5 words). Only use this when a multiple-choice answer is genuinely more helpful than free text — not for every message.`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Get the latest user message for context retrieval
  const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  const query = lastUserMessage?.content ?? "";

  // Retrieve relevant context from the knowledge base
  let systemPrompt = BASE_SYSTEM;
  if (query) {
    try {
      const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), 2500));
      const context = await Promise.race([retrieveContext(query), timeout]);
      if (context) {
        systemPrompt += `\n\n---\nAşağıda bu soruyla ilgili veritabanından çekilen güncel bilgiler var. Yanıt verirken bunları kullan:\n\n${context}`;
      }
    } catch {
      // RAG failure is non-fatal — answer without context
    }
  }

  const stream = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
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
