"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

type Session = {
  user_name: string | null;
  user_email: string | null;
  message_count: number;
  created_at: string;
  messages: Message[] | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadsTable({ rows }: { rows: Session[] }) {
  const [selected, setSelected] = useState<Session | null>(null);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Ad</th>
              <th className="px-4 py-3 font-medium">E-posta</th>
              <th className="px-4 py-3 font-medium text-right">Mesaj</th>
              <th className="px-4 py-3 font-medium text-right">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr
                key={i}
                className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelected(s)}
                    className="text-[#4241db] hover:underline font-medium text-left"
                  >
                    {s.user_name ?? "—"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {s.user_email ? (
                    <a
                      href={`mailto:${s.user_email}`}
                      className="text-gray-700 hover:underline"
                    >
                      {s.user_email}
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {s.message_count}
                </td>
                <td className="px-4 py-3 text-right text-gray-400 whitespace-nowrap">
                  {formatDate(s.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Conversation modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">
                  {selected.user_name ?? "—"}
                </p>
                {selected.user_email && (
                  <p className="text-sm text-gray-400">{selected.user_email}</p>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
              {!selected.messages?.length ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Bu oturum için sohbet geçmişi kaydedilmemiş.
                </p>
              ) : (
                selected.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-[#4241db] text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-800 rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
