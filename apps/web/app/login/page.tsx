import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="" width={80} height={80} priority />
          <div>
            <p className="text-2xl font-semibold tracking-tight">SoyGerman</p>
            <p className="text-sm text-muted">Agenda mensajes de WhatsApp</p>
          </div>
        </div>
        <LoginForm authError={params.error === "auth"} />
      </div>
    </main>
  );
}
