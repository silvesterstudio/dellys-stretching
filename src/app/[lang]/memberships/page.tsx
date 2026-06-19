import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { localized } from "@/lib/i18n-data";

export const dynamic = "force-dynamic";

type Plan = {
  id: string;
  audience: "adult" | "child";
  name_ro: string;
  name_ru: string;
  session_count: number;
  price: number;
  currency: string;
  validity_days: number;
};

export default async function MembershipsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  const supabase = await createClient();
  const { data } = await supabase
    .from("membership_plans")
    .select("id, audience, name_ro, name_ru, session_count, price, currency, validity_days")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const plans = (data ?? []) as Plan[];
  const groups: { audience: "adult" | "child"; items: Plan[] }[] = [
    { audience: "adult", items: plans.filter((p) => p.audience === "adult") },
    { audience: "child", items: plans.filter((p) => p.audience === "child") },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-mauve-900">
          {dict.memberships.title}
        </h1>
        <p className="mt-1 text-mauve-500">{dict.memberships.subtitle}</p>
      </div>

      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.audience}>
              <h2 className="mb-3 text-lg font-semibold text-mauve-800">
                {dict.audience[g.audience]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => (
                  <div key={p.id} className="card flex flex-col p-5">
                    <div className="text-lg font-semibold text-mauve-900">
                      {localized(p, "name", locale)}
                    </div>
                    <div className="mt-2 text-3xl font-bold text-brand-600">
                      {formatPrice(p.price, p.currency, locale)}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-mauve-500">
                      <div>
                        {p.session_count} {dict.memberships.sessions}
                      </div>
                      <div>
                        {dict.memberships.validity}: {p.validity_days}{" "}
                        {dict.memberships.days}
                      </div>
                    </div>
                    <p className="mt-4 rounded-xl bg-mauve-50 px-3 py-2 text-xs text-mauve-600">
                      {dict.memberships.buyNote}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}
