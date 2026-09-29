import { WhatsAppConnection } from "@/components/whatsapp-connection";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="text-2xl font-semibold">Vinculación</h1>
        <p className="text-sm text-muted">
          El código QR aparece aquí cuando el worker lo genera y desaparece al
          conectar.
        </p>
      </div>
      <WhatsAppConnection />
    </div>
  );
}
