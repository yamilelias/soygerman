import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WhatsAppConnection } from "@/components/whatsapp-connection";
import { listLines, activeLine } from "@/lib/lines";
import { createClient } from "@/utils/supabase/server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lines = await listLines();
  if (lines.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="text-center">
          <p className="text-lg font-semibold">Conecta WhatsApp</p>
          <p className="text-sm text-muted">
            Es el primer paso. Después podrás elegir chats y agendar.
          </p>
        </div>
        <WhatsAppConnection start />
      </main>
    );
  }

  const selected = await activeLine();
  return <AppShell lines={lines} activeId={selected?.id ?? lines[0].id}>{children}</AppShell>;
}
