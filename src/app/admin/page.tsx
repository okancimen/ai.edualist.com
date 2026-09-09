import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { LoginForm } from "./LoginForm";
import { logout } from "./actions";
import { LeadsTable } from "./LeadsTable";

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
    .select("user_name, user_email, message_count, created_at, messages, utm_source")
    .not("user_email", "is", null)
    .order("created_at", { ascending: false });

  const { count: totalSessions } = await getSupabase()
    .from("sessions")
    .select("*", { count: "exact", head: true });

  const rows = (leads ?? []) as Parameters<typeof LeadsTable>[0]["rows"];

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
            <LeadsTable rows={rows} />
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
