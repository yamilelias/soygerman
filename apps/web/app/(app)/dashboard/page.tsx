import { WhatsAppConnection } from "@/components/whatsapp-connection";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="text-2xl font-semibold">Vinculación</h1>
        <p className="text-sm text-muted">
          Al vincular aparece el código QR. El estado se actualiza solo hasta
          que la sesión queda conectada.
        </p>
      </div>
      <WhatsAppConnection />
    </div>
  );
}
