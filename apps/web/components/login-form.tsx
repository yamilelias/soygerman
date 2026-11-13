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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
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
      setError(accessMessage(signInError.message));
      return;
    }
    setSent(true);
  }

  async function verifyCode() {
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setPending(false);
    if (verifyError) {
      setError("El código no es válido o venció. Revisa el correo o pide uno nuevo.");
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
            el código aquí para entrar en esta misma ventana, o abre el enlace
            del correo.
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
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" isDisabled={pending || code.length !== 6}>
              {pending ? "Comprobando..." : "Entrar con código"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              isDisabled={pending}
              onPress={() => {
                setSent(false);
                setCode("");
                setError(null);
              }}
            >
              Cambiar correo o pedir otro código
            </Button>
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
          un enlace, sin contraseña.
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
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" isDisabled={pending || !email.trim()}>
            {pending ? "Enviando..." : "Enviar código y enlace"}
          </Button>
        </form>
      </Card.Content>
    </Card>
  );
}
