"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { MarkdownMessage } from "@/components/MarkdownMessage";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="w-full rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed bg-white text-gray-800 border border-gray-200 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed bg-[#4241db] text-white whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [followUpOptions, setFollowUpOptions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const isAtBottomRef = useRef(true);
  const sessionId = useRef(crypto.randomUUID());
  const utmRef = useRef<{ source?: string; medium?: string; campaign?: string }>({});

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    utmRef.current = {
      source: p.get("utm_source") ?? undefined,
      medium: p.get("utm_medium") ?? undefined,
      campaign: p.get("utm_campaign") ?? undefined,
    };
  }, []);

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
      const container = scrollContainerRef.current;
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  // Send email transcript when user leaves the page (Supabase already updated mid-chat)
  useEffect(() => {
    const handlePageHide = () => {
      if (!messages.length) return;
      const payload = JSON.stringify({ messages, userName, userEmail });
      navigator.sendBeacon(
        "/api/session/end",
        new Blob([payload], { type: "application/json" })
      );
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [messages, userName, userEmail]);

  function saveSession(msgs: Message[], name: string, email: string) {
    fetch("/api/session/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId.current, messages: msgs, userName: name, userEmail: email, utm: utmRef.current }),
    }).catch(() => {});
  }

  async function streamMessage(chatMessages: Message[], name: string, email: string) {
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
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
      });
    }

    // Parse [SEÇENEKLER: ...] tag from the final assistant message
    let finalContent = fullContent;
    const match = fullContent.match(/\[SEÇENEKLER:\s*([^\]]+)\]/);
    if (match) {
      const opts = match[1].split("|").map((s) => s.trim()).filter(Boolean);
      setFollowUpOptions(opts);
      finalContent = fullContent.replace(/\[SEÇENEKLER:[^\]]+\]/, "").trimEnd();
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: finalContent }];
      });
    }

    // Persist session after each assistant response
    saveSession(
      [...chatMessages, { role: "assistant", content: finalContent }],
      name,
      email
    );

    setStreaming(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function sendText(content: string, name = userName, email = userEmail) {
    if (!content || streaming) return;
    setFollowUpOptions([]);
    const updated: Message[] = [...messages, { role: "user", content }];
    setMessages(updated);
    isAtBottomRef.current = true;
    await streamMessage(updated, name, email);
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

  const chatStarted = !!userName;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">Ela by Edualist</span>
          <span className="text-sm text-gray-400 hidden sm:inline">Yurt dışı eğitim danışmanın</span>
        </div>
        <a
          href="https://wa.me/971502709379"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:bg-[#1fb855] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
      </header>

      <main
        ref={scrollContainerRef as React.RefObject<HTMLElement>}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {/* Greeting + name step */}
          <AssistantBubble>
            Merhaba! Ben Ela, Edualist'in AI asistanıyım. 🎓 Dünyanın herhangi bir yerinde doğru okulu bulmak için buradayım — başlamak için önce adınızı öğrenebilir miyim?
          </AssistantBubble>

          {!userName && (
            <form
              className="flex flex-col gap-2 pl-1"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = nameInput.trim();
                const email = emailInput.trim();
                if (!trimmed) return;
                setUserName(trimmed);
                setUserEmail(email);
                const initial: Message[] = [{ role: "user", content: trimmed }];
                setMessages(initial);
                isAtBottomRef.current = true;
                streamMessage(initial, trimmed, email);
              }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Adın *"
                  autoFocus
                  className="w-36 rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-[#4241db] focus:ring-2 focus:ring-[#4241db]/20 bg-white"
                />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="E-posta (isteğe bağlı)"
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-[#4241db] focus:ring-2 focus:ring-[#4241db]/20 bg-white"
                />
                <button
                  type="submit"
                  disabled={!nameInput.trim()}
                  className="rounded-xl bg-[#4241db] px-4 py-2 text-sm font-medium text-white hover:bg-[#3736b8] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Devam
                </button>
              </div>
            </form>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => {
            const isLastAssistant =
              i === messages.length - 1 && msg.role === "assistant";
            return (
              <div key={i} className="flex flex-col gap-2">
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "max-w-[80%] bg-[#4241db] text-white rounded-br-sm whitespace-pre-wrap"
                        : "w-full bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
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
                        className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:border-[#4241db] hover:text-[#4241db] hover:bg-[#4241db]/10 transition-colors"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

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
            placeholder="Sorunuzu yazın..."
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 leading-relaxed outline-none focus:border-[#4241db] focus:ring-2 focus:ring-[#4241db]/20 max-h-40 bg-white disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming || !chatStarted}
            className="rounded-xl bg-[#4241db] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#3736b8] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Gönder
          </button>
        </form>
        <p className="max-w-2xl mx-auto mt-2 text-xs text-gray-400 text-center">
          Powered by{" "}
          <a href="https://www.edubot.com.tr" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline underline-offset-2">
            edubot.com.tr
          </a>
        </p>
      </div>
    </div>
  );
}
