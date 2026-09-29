import { ScheduleForm } from "@/components/schedule-form";
import type { Chat } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chats")
    .select("id, user_id, wa_id, name, is_group, updated_at")
    .order("is_group", { ascending: false })
    .order("name");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Agendar mensaje</h1>
        <p className="text-sm text-muted">
          El envío ocurre en el minuto elegido. Puede tardar hasta un minuto
          después de esa hora.
        </p>
      </div>
      <ScheduleForm chats={(data ?? []) as Chat[]} />
    </div>
  );
}
