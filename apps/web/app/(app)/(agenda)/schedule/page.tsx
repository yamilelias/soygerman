import { ScheduleForm } from "@/components/schedule-form";
import { byDestination, listChats } from "@/lib/chats";

export default async function SchedulePage() {
  const chats = (await listChats()).sort(byDestination);

  return (
    <div className="w-full max-w-xl">
      <ScheduleForm chats={chats} />
    </div>
  );
}
