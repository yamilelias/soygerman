"use client";

import { Button, Card, Input, Label, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const CODE_LENGTH = 8;
const RESEND_DELAY_MS = 30_000;

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
  const [resendAt, setResendAt] = useState(0);
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);

  useEffect(() => {
    if (!sent || !resendAt) return;
    const updateCountdown = () => {
      setSecondsUntilResend(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    };
    updateCountdown();
    const interval = window.setInterval(() => {
      updateCountdown();
      if (Date.now() >= resendAt) window.clearInterval(interval);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sent, resendAt]);

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
    setResendAt(Date.now() + RESEND_DELAY_MS);
    setSecondsUntilResend(30);
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

  if (sent) {
    return (
      <Card className="w-full max-w-md">
        <Card.Header>
          <Card.Title>Revisa tu correo</Card.Title>
          <Card.Description>
            Enviamos un código y un enlace de acceso a {email.trim()}. Escribe
            el código aquí o abre el enlace del correo.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode();
            }}
          >
            <TextField
              type="text"
              value={code}
              onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
              isRequired
              autoComplete="one-time-code"
            >
              <Label>Código de {CODE_LENGTH} dígitos</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={CODE_LENGTH}
                placeholder="12345678"
              />
            </TextField>
            {codeError ? <p className="text-sm text-danger">{codeError}</p> : null}
            <Button type="submit" isDisabled={pending || code.length !== CODE_LENGTH}>
              {pending ? "Comprobando..." : "Entrar con código"}
            </Button>
            {sendError ? <p className="text-sm text-danger">{sendError}</p> : null}
            <Button
              type="button"
              variant="ghost"
              isDisabled={pending || secondsUntilResend > 0}
              onPress={() => void submit()}
            >
              {secondsUntilResend > 0
                ? `Reenviar correo en ${secondsUntilResend} s`
                : "Reenviar correo"}
            </Button>
            <button
              type="button"
              className="self-center text-sm text-primary underline"
              disabled={pending}
              onClick={() => {
                setSent(false);
                setEmail("");
                setCode("");
                setSendError(null);
                setCodeError(null);
                setResendAt(0);
              }}
            >
              Volver y usar otro correo
            </button>
          </form>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <Card.Header>
        <Card.Title>Entrar</Card.Title>
        <Card.Description>
          Escribe el correo con el que te invitaron. Te enviaremos un código y
          un enlace de acceso.
        </Card.Description>
      </Card.Header>
      <Card.Content>
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
            onChange={setEmail}
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
          <Button type="submit" isDisabled={pending || !email.trim()}>
            {pending ? "Enviando..." : "Enviar código y enlace"}
          </Button>
        </form>
      </Card.Content>
    </Card>
  );
}
