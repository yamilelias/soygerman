import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <LoginForm authError={params.error === "auth"} />
    </main>
  );
}
