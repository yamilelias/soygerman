import {
  CalendarClock,
  Check,
  Clock3,
  ShieldCheck,
  SunMedium,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const features = [
  {
    title: "Agenda",
    text: "Elige el chat, escribe el mensaje y fija el día y la hora.",
    icon: CalendarClock,
  },
  {
    title: "A su hora",
    text: "Cuando llega el momento, el mensaje sale sin que tengas que estar pendiente.",
    icon: Clock3,
  },
  {
    title: "Una sola vez",
    text: "Si ya se envió, no vuelve a salir. Cancelarlo también lo saca de la fila.",
    icon: ShieldCheck,
  },
  {
    title: "El resumen",
    text: "Por la mañana ves lo que sigue sin leer y qué conviene hacer.",
    icon: SunMedium,
  },
];

const checks = ["A la hora que eliges", "Sin duplicarlo", "Con tu WhatsApp"];

export function LandingPage({ loggedIn }: { loggedIn: boolean }) {
  const enterHref = loggedIn ? "/dashboard" : "/login";
  const enterLabel = loggedIn ? "Ir al panel" : "Entrar";

  return (
    <div
      className="min-h-dvh scroll-smooth bg-white text-[#1C1C1C]"
      style={{ colorScheme: "light" }}
    >
      <header className="sticky top-0 z-30 border-b border-[#1C1C1C]/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <a href="#inicio" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt=""
              width={48}
              height={48}
              priority
              className="h-12 w-12 shrink-0"
            />
            <span className="font-display text-lg font-semibold tracking-tight">
              Soy German
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#1C1C1C]/75 sm:flex">
            <a href="#inicio" className="hover:text-[#7A0505]">
              Inicio
            </a>
            <a href="#funciones" className="hover:text-[#7A0505]">
              Funciones
            </a>
          </nav>
          <Link
            href={enterHref}
            className="rounded-full bg-[#7A0505] px-4 py-2 text-sm font-medium text-white hover:bg-[#5C0404]"
          >
            {enterLabel}
          </Link>
        </div>
      </header>

      <main>
        <section
          id="inicio"
          className="relative overflow-hidden px-5 pb-16 pt-12 sm:pt-16 lg:pb-24"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-[#7A0505]/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-1/3 h-56 w-56 rounded-full bg-[#7A0505]/[0.08]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#7A0505]">
                ASISTENTE DE WHATSAPP
              </p>
              <h1 className="font-display mt-4 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Agenda el mensaje,
                <span className="mt-1 block text-[#7A0505]">
                  a la hora justa.
                </span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-[#1C1C1C]/75 sm:text-lg">
                SoyGerman deja listo el texto, el chat y la hora. Cuando toca,
                se envía una sola vez.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={enterHref}
                  className="rounded-full bg-[#7A0505] px-5 py-3 text-sm font-medium text-white hover:bg-[#5C0404]"
                >
                  {enterLabel}
                </Link>
                <a
                  href="#funciones"
                  className="rounded-full px-5 py-3 text-sm font-medium text-[#1C1C1C]/80 hover:text-[#7A0505]"
                >
                  Ver funciones
                </a>
              </div>
              <ul className="mt-8 flex flex-col gap-2 text-sm text-[#1C1C1C]/80 sm:flex-row sm:flex-wrap sm:gap-x-5">
                {checks.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check size={16} className="text-[#7A0505]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto flex w-full max-w-xl items-end justify-center">
              <Image
                src="/logo.png"
                alt="Mascota de Soy German con el teléfono y el pulgar arriba"
                width={420}
                height={420}
                priority
                className="relative z-10 w-[48%] max-w-[260px]"
              />
              <PhoneMock />
            </div>
          </div>
        </section>

        <section id="funciones" className="bg-[#F8F1F1] px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-xs font-semibold tracking-[0.18em] text-[#7A0505]">
              POR QUÉ SOYGERMAN
            </p>
            <h2 className="font-display mx-auto mt-3 max-w-xl text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Lo que hace por ti
            </h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.title}
                    className="rounded-3xl bg-white px-5 py-6"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7A0505]/10 text-[#7A0505]">
                      <Icon size={22} aria-hidden />
                    </span>
                    <h3 className="font-display mt-4 text-lg font-semibold">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#1C1C1C]/70">
                      {feature.text}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      <footer className="px-5 py-8 text-center text-sm text-[#1C1C1C]/60">
        SoyGerman · Tu asistente de WhatsApp
      </footer>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="relative z-0 -ml-6 mb-8 w-[56%] max-w-[280px] rounded-[2rem] border-[7px] border-[#1C1C1C] bg-[#1C1C1C] shadow-[0_24px_50px_-24px_rgba(28,28,28,0.45)]">
      <div className="overflow-hidden rounded-[1.4rem] bg-[#161616] text-white">
        <div className="flex items-center justify-between px-4 pt-3 text-[10px] text-white/70">
          <span>9:41</span>
          <span className="h-1.5 w-10 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
          <Image src="/logo.png" alt="" width={28} height={28} />
          <div>
            <p className="text-sm font-medium leading-none">SoyGerman</p>
            <p className="mt-1 text-[10px] text-white/55">Mensaje agendado</p>
          </div>
        </div>
        <div className="space-y-3 px-3 pb-4">
          <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-[#7A0505] px-3 py-2 text-[13px] leading-snug">
            <p>Listo. Te escribo mañana a las 9.</p>
            <p className="mt-1 text-right text-[10px] text-white/70">9:00</p>
          </div>
          <p className="text-center text-[10px] tracking-wide text-white/45">
            Sale mañana · una sola vez
          </p>
        </div>
        <div className="mx-3 mb-3 rounded-full bg-white/10 px-3 py-2 text-[11px] text-white/40">
          Escribe un mensaje…
        </div>
      </div>
    </div>
  );
}
