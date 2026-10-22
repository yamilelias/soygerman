import { ChatExplorer } from "@/components/chat-explorer";
import { CHAT_PAGE_SIZE, searchChats, type ChatKind } from "@/lib/chats";
import { activeLine } from "@/lib/lines";

function kindFrom(value: string | undefined): ChatKind {
  if (value === "groups" || value === "direct") return value;
  return "all";
}

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const kind = kindFrom(params.kind);
  const page = Number(params.page);
  const line = await activeLine();
  const { chats, total } = await searchChats({
    query,
    kind,
    page: Number.isFinite(page) ? page : 1,
    pageSize: CHAT_PAGE_SIZE,
  });

  return (
    <ChatExplorer
      key={line?.id}
      chats={chats}
      total={total}
      query={query}
      kind={kind}
      page={Number.isFinite(page) && page > 0 ? Math.floor(page) : 1}
    />
  );
}
