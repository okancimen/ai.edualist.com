"use client";

import { login } from "./actions";

export function LoginForm({ error }: { error: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Ela Admin</h1>
        <form action={login} className="flex flex-col gap-3">
          <input
            type="password"
            name="password"
            placeholder="Şifre"
            autoFocus
            required
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#4241db] focus:ring-2 focus:ring-[#4241db]/20"
          />
          {error && (
            <p className="text-xs text-red-500">Şifre hatalı.</p>
          )}
          <button
            type="submit"
            className="rounded-xl bg-[#4241db] px-4 py-3 text-sm font-medium text-white hover:bg-[#3736b8]"
          >
            Giriş
          </button>
        </form>
      </div>
    </div>
  );
}
