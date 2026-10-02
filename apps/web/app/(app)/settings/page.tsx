import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { WhatsAppConnection } from "@/components/whatsapp-connection";
import { formatDate } from "@/lib/format";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const email = profile?.email ?? user.email ?? "";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted">
          Cuenta, apariencia y vinculación de WhatsApp.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cuenta</h2>
        <dl className="flex flex-col gap-3 rounded-lg border border-separator p-4 text-sm">
          <div>
            <dt className="text-muted">Correo</dt>
            <dd>{email}</dd>
          </div>
          {profile?.created_at ? (
            <div>
              <dt className="text-muted">Miembro desde</dt>
              <dd>{formatDate(profile.created_at)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="flex items-center justify-between gap-4 rounded-lg border border-separator p-4">
        <div>
          <h2 className="text-lg font-semibold">Apariencia</h2>
          <p className="text-sm text-muted">
            Claro u oscuro. Se guarda en este dispositivo.
          </p>
        </div>
        <ThemeToggle />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">WhatsApp</h2>
          <p className="text-sm text-muted">
            Al vincular aparece el código QR. El estado se actualiza solo hasta
            que la sesión queda conectada.
          </p>
        </div>
        <WhatsAppConnection />
      </section>
    </div>
  );
}
