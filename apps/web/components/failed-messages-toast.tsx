"use client";

import { AlertCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { countFailedMessages } from "@/app/actions/messages";

const POLL_INTERVAL_MS = 60_000;

export function FailedMessagesToast({
  userId,
  sessionId,
  initialCount,
}: {
  userId: string;
  sessionId: string;
  initialCount: number;
}) {
  const router = useRouter();
  const [newFailures, setNewFailures] = useState(0);

  useEffect(() => {
    const key = `soygerman-seen-failures-${userId}-${sessionId}`;
    let seenInMemory = 0;
    let active = true;

    function check(count: number) {
      let seen = seenInMemory;
      try {
        const stored = window.localStorage.getItem(key);
        if (stored !== null) seen = Number(stored) || 0;
      } catch {
        // Keep the current visit working when storage is unavailable.
      }
      if (count > seen) {
        setNewFailures(count - seen);
      }
      seenInMemory = Math.max(seen, count);
      try {
        window.localStorage.setItem(key, String(seenInMemory));
      } catch {
        // The in-memory value still prevents repeated notices this visit.
      }
    }

    const initialTimer = window.setTimeout(() => check(initialCount), 0);
    const interval = window.setInterval(async () => {
      const result = await countFailedMessages();
      if (active && "count" in result) check(result.count ?? 0);
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [userId, sessionId, initialCount]);

  if (newFailures === 0) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-lg border border-danger bg-background p-3 shadow-lg"
    >
      <AlertCircle className="mt-0.5 shrink-0 text-danger" size={20} aria-hidden />
      <button
        type="button"
        className="min-w-0 flex-1 text-left text-sm"
        onClick={() => {
          setNewFailures(0);
          router.push("/history");
        }}
      >
        <span className="font-semibold">
          {newFailures === 1
            ? "Falló el envío de un mensaje"
            : `Falló el envío de ${newFailures} mensajes`}
        </span>
        <span className="block text-muted">Ver fallidos en el historial</span>
      </button>
      <button
        type="button"
        aria-label="Cerrar aviso de mensajes fallidos"
        className="rounded p-1 text-muted hover:text-foreground"
        onClick={() => setNewFailures(0)}
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
