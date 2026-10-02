import { MessageTabs } from "@/components/message-tabs";

export default function AgendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <MessageTabs />
      {children}
    </div>
  );
}
