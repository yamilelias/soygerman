"use client";

import { Button, Card, Input, Label, TextField } from "@heroui/react";
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
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
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

  if (sent) {
    return (
      <Card className="w-full max-w-md">
        <Card.Header>
          <Card.Title>Revisa tu correo</Card.Title>
          <Card.Description>
            Te enviamos un enlace de acceso a {email.trim()}. Ábrelo en este
            dispositivo para entrar.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <Card.Header>
        <Card.Title>Entrar</Card.Title>
        <Card.Description>
          Escribe el correo con el que te invitaron. Te enviaremos un enlace,
          sin contraseña.
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
            {pending ? "Enviando..." : "Enviar enlace"}
          </Button>
        </form>
      </Card.Content>
    </Card>
  );
}
