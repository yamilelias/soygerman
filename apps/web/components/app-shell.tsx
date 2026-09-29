"use client";

import { Button } from "@heroui/react";
import {
  CalendarPlus,
  Clock,
  History,
  LogOut,
  MessagesSquare,
  QrCode,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/dashboard", label: "Vinculación", icon: QrCode },
  { href: "/chats", label: "Chats", icon: MessagesSquare },
  { href: "/schedule", label: "Agendar", icon: CalendarPlus },
  { href: "/pending", label: "Pendientes", icon: Clock },
  { href: "/history", label: "Historial", icon: History },
];

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-full md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-separator md:flex md:flex-col md:gap-6 md:p-4">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={40} height={40} />
          <div className="min-w-0">
            <p className="text-lg font-semibold">SoyGerman</p>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-default text-foreground" : "text-muted"
                }`}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-full flex-col">
        <header className="flex items-center justify-between border-b border-separator px-4 py-3">
          <div className="flex items-center gap-2 font-semibold md:hidden">
            <Image src="/logo.png" alt="" width={28} height={28} />
            SoyGerman
          </div>
          <p className="hidden truncate text-sm text-muted md:block">{email}</p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut size={16} />
                Salir
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:pb-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-separator bg-background md:hidden">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${
                active ? "text-foreground" : "text-muted"
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
