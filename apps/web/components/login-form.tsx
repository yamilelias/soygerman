"use client";

import { Button, Card, Input, Label, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

function accessMessage(message: string) {
  const text = message.toLowerCase();
  if (
    text.includes("signups not allowed") ||
    text.includes("user not found") ||
    text.includes("otp_disabled")
  ) {
    return "Este correo no tiene acceso. Solo entra quien recibió una invitación.";
  }
  return message;
}

export function LoginForm({ authError }: { authError: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setSendError(null);
    setPending(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    setPending(false);
    if (signInError) {
      setSendError(accessMessage(signInError.message));
      return;
    }
    setCode("");
    setCodeError(null);
    setSent(true);
  }

  async function verifyCode() {
    setCodeError(null);
    setPending(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setPending(false);
    if (verifyError) {
      setCodeError("El código no es válido o venció. Revisa el correo o pide uno nuevo.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <Card.Header>
        <Card.Title>{sent ? "Revisa tu correo" : "Entrar"}</Card.Title>
        <Card.Description>
          Escribe el correo con el que te invitaron. Puedes entrar con el código
          en esta ventana o con el enlace del correo.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="flex flex-col gap-6">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <TextField
              type="email"
              value={email}
              onChange={(value) => {
                setEmail(value);
                setSent(false);
                setSendError(null);
                setCodeError(null);
              }}
              isRequired
              autoComplete="email"
            >
              <Label>Correo</Label>
              <Input placeholder="tu@correo.com" />
            </TextField>
            {authError ? (
              <p className="text-sm text-danger">
                No se pudo confirmar el enlace. Pide uno nuevo.
              </p>
            ) : null}
            {sendError ? <p className="text-sm text-danger">{sendError}</p> : null}
            {sent ? (
              <p className="text-sm text-success" role="status">
                Te enviamos un código y un enlace a {email.trim()}.
              </p>
            ) : null}
            <Button type="submit" isDisabled={pending || !email.trim()}>
              {pending ? "Enviando..." : sent ? "Pedir otro código" : "Enviar código y enlace"}
            </Button>
          </form>
          <form
            className="flex flex-col gap-4 border-t border-separator pt-5"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode();
            }}
          >
            <TextField
              type="text"
              value={code}
              onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
              isRequired
              autoComplete="one-time-code"
            >
              <Label>Código de 6 dígitos</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
              />
            </TextField>
            {codeError ? <p className="text-sm text-danger">{codeError}</p> : null}
            <Button type="submit" isDisabled={pending || !email.trim() || code.length !== 6}>
              {pending ? "Comprobando..." : "Entrar con código"}
            </Button>
          </form>
        </div>
      </Card.Content>
    </Card>
  );
}
