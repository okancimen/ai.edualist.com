"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { MarkdownMessage } from "@/components/MarkdownMessage";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;

    const updated: Message[] = [...messages, { role: "user", content }];
    setMessages(updated);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStreaming(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: updated }),
    });

    if (!res.ok || !res.body) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
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

    setStreaming(false);
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 bg-white">
        <span className="text-lg font-semibold text-gray-900">Edualist</span>
        <span className="text-sm text-gray-400">Yurt dışı eğitim danışmanın</span>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="text-center mt-20">
              <p className="text-xl font-medium text-gray-700 mb-2">
                Yurt dışında okumak mı istiyorsun?
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Okul seçiminden vize sürecine, burslardan dil sınavlarına kadar sana yardımcı olabilirim.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Hangi ülkede okusam?",
                  "IELTS için ne yapmalıyım?",
                  "Öğrenci vizesi nasıl alınır?",
                  "Burs imkânları neler?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
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
                  i === messages.length - 1 &&
                  msg.role === "assistant" &&
                  !msg.content && (
                    <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse rounded-sm align-middle" />
                  )}
              </div>
            </div>
          ))}

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
            disabled={streaming}
            placeholder="Sorunuzu yazın..."
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 max-h-40 bg-white disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
        <p className="max-w-2xl mx-auto mt-2 text-xs text-gray-400 text-center">
          Shift + Enter for new line
        </p>
      </div>
    </div>
  );
}
