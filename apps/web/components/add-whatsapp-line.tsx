"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createWhatsAppLine } from "@/app/actions/worker";

export function AddWhatsAppLine({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-lg border border-dashed border-separator p-4">
      <p className="font-medium">Segundo teléfono</p>
      <p className="mb-3 text-sm text-muted">
        {enabled ? "Añade otra línea y vincúlala con su propio código QR." :
          "La segunda línea estará disponible tras verificar el despliegue."}
      </p>
      <Button isDisabled={!enabled || pending} onPress={() => {
        start(async () => {
          const result = await createWhatsAppLine();
          if ("error" in result && result.error) setError(result.error);
          else router.refresh();
        });
      }}>Añadir teléfono</Button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
