import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { LoginForm } from "./LoginForm";
import { logout } from "./actions";

type Session = {
  user_name: string | null;
  user_email: string | null;
  message_count: number;
  created_at: string;
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const { error } = await searchParams;
  const authed =
    !!process.env.ADMIN_PASSWORD &&
    cookieStore.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;

  if (!authed) {
    return <LoginForm error={!!error} />;
  }

  const { data: leads } = await getSupabase()
    .from("sessions")
    .select("user_name, user_email, message_count, created_at")
    .not("user_email", "is", null)
    .order("created_at", { ascending: false });

  const { count: totalSessions } = await getSupabase()
    .from("sessions")
    .select("*", { count: "exact", head: true });

  const rows = (leads ?? []) as Session[];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <span className="text-lg font-semibold text-gray-900">Ela Admin</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Çıkış
          </button>
        </form>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Toplam sohbet" value={totalSessions ?? 0} />
          <StatCard label="E-posta veren" value={rows.length} />
          <StatCard
            label="Dönüşüm oranı"
            value={
              totalSessions
                ? `${Math.round((rows.length / totalSessions) * 100)}%`
                : "—"
            }
          />
        </div>

        {/* Leads table */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Leads — e-posta verenler
          </h2>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400">Henüz lead yok.</p>
          ) : (
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
                      <td className="px-4 py-3 text-gray-900">
                        {s.user_name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${s.user_email}`}
                          className="text-[#4241db] hover:underline"
                        >
                          {s.user_email}
                        </a>
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
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
