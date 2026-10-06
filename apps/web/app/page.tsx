import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "SoyGerman",
  description:
    "Tu asistente de WhatsApp para los días ocupados. Agenda un mensaje y se envía a la hora, una sola vez.",
  openGraph: {
    title: "SoyGerman",
    description:
      "Agenda un mensaje de WhatsApp y se envía a la hora, una sola vez.",
    locale: "es_MX",
    type: "website",
  },
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingPage loggedIn={Boolean(user)} />;
}
