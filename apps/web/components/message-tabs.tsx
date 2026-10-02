"use client";

import { Tabs } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";

const tabs = [
  {
    id: "/schedule",
    label: "Agendar",
    description:
      "El envío ocurre en el minuto elegido. Puede tardar hasta un minuto después de esa hora.",
  },
  {
    id: "/pending",
    label: "Pendientes",
    description:
      "Ordenados por la hora de envío más cercana. Cancelar evita que el worker los procese.",
  },
  {
    id: "/history",
    label: "Historial",
    description: "Mensajes enviados, fallidos y cancelados.",
  },
];

export function MessageTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const current = tabs.find((tab) => tab.id === pathname) ?? tabs[0];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Mensajes</h1>
        <p className="text-sm text-muted">{current.description}</p>
      </div>
      <Tabs
        selectedKey={current.id}
        onSelectionChange={(key) => {
          const href = String(key);
          if (href !== pathname) router.push(href);
        }}
      >
        <Tabs.List aria-label="Secciones de mensajes">
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.id} id={tab.id}>
              {tab.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </div>
  );
}
