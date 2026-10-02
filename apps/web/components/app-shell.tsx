"use client";

import { Button } from "@heroui/react";
import {
  CalendarPlus,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

const desktopLinks = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/chats", label: "Chats", icon: MessagesSquare },
  { href: "/schedule", label: "Agendar", icon: CalendarPlus },
  { href: "/settings", label: "Configuración", icon: Settings },
];

const mobileLinks = [
  { href: "/chats", label: "Chats", icon: MessagesSquare },
  { href: "/schedule", label: "Agendar", icon: CalendarPlus },
  { href: "/settings", label: "Configuración", icon: Settings },
];

const agendaPaths = ["/schedule", "/pending", "/history"];

function isActive(pathname: string, href: string) {
  if (href === "/schedule") return agendaPaths.includes(pathname);
  return pathname === href;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-separator md:flex md:flex-col md:gap-6 md:p-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={40} height={40} />
          <p className="text-lg font-semibold">SoyGerman</p>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {desktopLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href);
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
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold md:hidden"
          >
            <Image src="/logo.png" alt="" width={28} height={28} />
            SoyGerman
          </Link>
          <form action={signOut} className="ml-auto">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut size={16} />
              Salir
            </Button>
          </form>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:pb-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-separator bg-background md:hidden">
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(pathname, link.href);
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
