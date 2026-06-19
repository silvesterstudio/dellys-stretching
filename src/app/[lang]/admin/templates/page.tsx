import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { TemplatesManager } from "@/components/admin/TemplatesManager";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({
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

  const { data: templates } = await supabase
    .from("weekly_templates")
    .select(
      `id, weekday, start_time, duration_min, capacity, instructor, active,
       class_type:class_types ( name_ro, name_ru, color )`,
    )
    .order("weekday")
    .order("start_time");

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const list = (templates ?? []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    weekday: t.weekday as number,
    start_time: t.start_time as string,
    duration_min: t.duration_min as number,
    capacity: t.capacity as number,
    instructor: (t.instructor as string) ?? null,
    active: t.active as boolean,
    class_type: one(t.class_type) as { name_ro: string; name_ru: string; color: string },
  }));

  return (
    <TemplatesManager
      lang={locale}
      dict={dict}
      classTypes={(classTypes ?? []) as never}
      templates={list}
    />
  );
}
