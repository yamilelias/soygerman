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
    <div className="w-full max-w-xl">
      <ScheduleForm chats={(data ?? []) as Chat[]} />
    </div>
  );
}
