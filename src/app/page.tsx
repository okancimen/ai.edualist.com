"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { MarkdownMessage } from "@/components/MarkdownMessage";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const QUESTIONS = [
  {
    id: "level",
    text: "Hangi eğitim seviyesini planlıyorsun?",
    options: ["Lisans", "Yüksek Lisans", "Lise", "Dil Okulu / Hazırlık"],
  },
  {
    id: "grade",
    text: "Şu an hangi sınıftasın?",
    options: ["9. Sınıf", "10. Sınıf", "11. Sınıf", "12. Sınıf / Mezun"],
  },
  {
    id: "budget",
    text: "Yıllık eğitim bütçen ne kadar?",
    options: ["5.000$ altı", "5.000–15.000$", "15.000–25.000$", "25.000$+"],
  },
  {
    id: "english",
    text: "İngilizce seviyeni nasıl değerlendirirsin?",
    options: ["Başlangıç", "Orta seviye", "İleri seviye", "IELTS / TOEFL var"],
  },
  {
    id: "region",
    text: "Hangi bölgeyi / ülkeyi düşünüyorsun?",
    options: ["Avrupa", "Amerika & Kanada", "Dubai & BAE", "Henüz bilmiyorum"],
  },
];

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed bg-white text-gray-800 border border-gray-200 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed bg-blue-600 text-white whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [followUpOptions, setFollowUpOptions] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, step, answers]);

  async function streamMessage(chatMessages: Message[]) {
    setStreaming(true);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatMessages }),
    });

    if (!res.ok || !res.body) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Bir hata oluştu, lütfen tekrar dene." },
      ]);
      setStreaming(false);
      return;
    }

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
      });
    }

    // Parse [SEÇENEKLER: ...] tag from the final assistant message
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role !== "assistant") return prev;
      const match = last.content.match(/\[SEÇENEKLER:\s*([^\]]+)\]/);
      if (!match) return prev;
      const opts = match[1].split("|").map((s) => s.trim()).filter(Boolean);
      setFollowUpOptions(opts);
      const cleaned = last.content.replace(/\[SEÇENEKLER:[^\]]+\]/, "").trimEnd();
      return [...prev.slice(0, -1), { ...last, content: cleaned }];
    });

    setStreaming(false);
  }

  const SKIP_GRADE = new Set(["Lisans", "Yüksek Lisans"]);

  async function handleOptionClick(option: string) {
    let newAnswers = [...answers, option];

    // If education level doesn't have school grades, skip the grade question
    if (newAnswers.length === 1 && SKIP_GRADE.has(option)) {
      newAnswers = [...newAnswers, "—"]; // sentinel so indices stay aligned
    }

    setAnswers(newAnswers);

    if (newAnswers.length < QUESTIONS.length) {
      setStep(newAnswers.length);
      return;
    }

    // All questions answered — kick off chat
    setStep(QUESTIONS.length);
    const gradeText = newAnswers[1] !== "—" ? `Şu an ${newAnswers[1].toLowerCase()} öğrencisiyim ve ` : "";
    const summary =
      `Merhaba! ${gradeText}yurt dışında ${newAnswers[0].toLowerCase()} okumayı planlıyorum. ` +
      `Yıllık bütçem ${newAnswers[2].toLowerCase()} civarı, İngilizce seviyem ${newAnswers[3].toLowerCase()}. ` +
      `${newAnswers[4]} bölgesini düşünüyorum. Bana ne tavsiye edersin?`;
    const initial: Message[] = [{ role: "user", content: summary }];
    setMessages(initial);
    isAtBottomRef.current = true;
    await streamMessage(initial);
  }

  async function sendText(content: string) {
    if (!content || streaming) return;
    setFollowUpOptions([]);
    const updated: Message[] = [...messages, { role: "user", content }];
    setMessages(updated);
    isAtBottomRef.current = true;
    await streamMessage(updated);
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendText(content);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function onChangeTextarea(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.currentTarget.style.height = "auto";
    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
  }

  const chatStarted = step >= QUESTIONS.length;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 bg-white">
        <span className="text-lg font-semibold text-gray-900">Edualist</span>
        <span className="text-sm text-gray-400">Yurt dışı eğitim danışmanın</span>
      </header>

      <main
        ref={scrollContainerRef as React.RefObject<HTMLElement>}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {/* Greeting */}
          <AssistantBubble>
            Merhaba! 👋 Yurt dışı eğitim planlamanında sana yardımcı olmak için birkaç soru sormak istiyorum.
          </AssistantBubble>

          {/* Onboarding Q&A */}
          {QUESTIONS.map((q, i) => {
            const answered = i < answers.length;
            const isCurrent = i === step && !chatStarted;

            // Hide the grade question when it was auto-skipped
            if (i === 1 && answers[1] === "—") return null;

            if (i > step && !chatStarted) return null;

            return (
              <div key={q.id} className="flex flex-col gap-2">
                <AssistantBubble>{q.text}</AssistantBubble>

                {answered ? (
                  <UserBubble content={answers[i]} />
                ) : isCurrent ? (
                  <div className="flex flex-wrap gap-2 pl-1">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleOptionClick(opt)}
                        disabled={streaming}
                        className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Chat messages (after onboarding) */}
          {chatStarted &&
            messages.map((msg, i) => {
              const isLastAssistant =
                i === messages.length - 1 && msg.role === "assistant";
              return (
                <div key={i} className="flex flex-col gap-2">
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap"
                          : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
                      }`}
                    >
                      {msg.role === "user" ? (
                        msg.content
                      ) : (
                        <MarkdownMessage content={msg.content} />
                      )}
                      {streaming &&
                        isLastAssistant &&
                        !msg.content && (
                          <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse rounded-sm align-middle" />
                        )}
                    </div>
                  </div>

                  {/* Follow-up option buttons below last assistant message */}
                  {isLastAssistant && !streaming && followUpOptions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-1">
                      {followUpOptions.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => sendText(opt)}
                          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          <div ref={bottomRef} />
        </div>
      </main>

      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <form
          className="max-w-2xl mx-auto flex items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={onChangeTextarea}
            onKeyDown={onKeyDown}
            disabled={streaming || !chatStarted}
            placeholder={chatStarted ? "Sorunuzu yazın..." : "Yukarıdaki seçeneklerden birini seç..."}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 max-h-40 bg-white disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming || !chatStarted}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Gönder
          </button>
        </form>
        <p className="max-w-2xl mx-auto mt-2 text-xs text-gray-400 text-center">
          Shift + Enter yeni satır
        </p>
      </div>
    </div>
  );
}
