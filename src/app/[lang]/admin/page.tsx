import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/i18n-data";
import { SessionAdminTools } from "@/components/admin/SessionAdminTools";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  const supabase = await createClient();

  const { data: classTypes } = await supabase
    .from("class_types")
    .select("id, name_ro, name_ru, audience, default_capacity")
    .eq("active", true)
    .order("name_ro");

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      `id, starts_at, capacity, booked_count, status, instructor,
       class_type:class_types ( name_ro, name_ru, color )`,
    )
    .eq("status", "scheduled")
    .gte("starts_at", new Date(Date.now() - 3600000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(200);

  const list = (sessions ?? []).map((s: Record<string, unknown>) => ({
    ...(s as object),
    class_type: Array.isArray(s.class_type) ? s.class_type[0] : s.class_type,
  })) as Array<{
    id: string;
    starts_at: string;
    capacity: number;
    booked_count: number;
    instructor: string | null;
    class_type: { name_ro: string; name_ru: string; color: string };
  }>;

  return (
    <div className="space-y-6">
      <SessionAdminTools
        lang={locale}
        dict={dict}
        classTypes={(classTypes ?? []) as never}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-mauve-800">
          {dict.admin.upcomingSessions}
        </h2>
        {list.length === 0 ? (
          <div className="card p-5 text-sm text-mauve-500">
            {dict.admin.noSessionsToday}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((s) => (
              <Link
                key={s.id}
                href={`/${locale}/admin/sessions/${s.id}`}
                className="card flex items-center justify-between gap-3 p-4 hover:bg-mauve-50"
                style={{ borderLeft: `4px solid ${s.class_type.color}` }}
              >
                <div className="min-w-0">
                  <div className="font-medium text-mauve-900">
                    {localized(s.class_type, "name", locale)}
                    {s.instructor && (
                      <span className="ml-2 text-xs text-mauve-400">
                        · {s.instructor}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-mauve-500">
                    {formatDate(s.starts_at, locale)} · {formatTime(s.starts_at, locale)}
                  </div>
                </div>
                <span className="badge bg-brand-50 text-brand-700">
                  {s.booked_count}/{s.capacity} {dict.admin.participants}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
