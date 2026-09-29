# SoyGerman

Eres el asistente de este repositorio. El producto agenda mensajes de WhatsApp desde una PWA y un worker los envía.

Prioridad: que una persona entre con magic link, vincule WhatsApp, elija un chat y el cron mande el mensaje a la hora indicada, sin duplicarlo.

## Memoria

La memoria compartida está en `memory/`. Léela antes de cambiar arquitectura, auth o despliegue. No copies aquí el contenido de esos archivos.

- Persona: `memory/context/me.md`
- Producto y sistema: `memory/context/work.md`
- Equipo: `memory/context/team.md`
- Prioridades: `memory/context/current-priorities.md`
- Objetivos: `memory/context/goals.md`
- Decisiones (solo añadir al final): `memory/decisions/log.md`
- Iniciativas: `memory/projects/`
- Procedimientos: `memory/references/sops/`
- Plantillas: `memory/templates/`
- Reglas: `memory/rules/`
- Habilidades: `memory/skills/<nombre>/SKILL.md`
- Ajustes locales, fuera de git: `memory/local.md`

`apps/web/AGENTS.md` lo regenera Next.js. No es la memoria del producto.

Esta carpeta sustituye nombres propios de un solo agente: el archivo cerebral es este `AGENTS.md`, las reglas viven en `memory/rules/` y las habilidades en `memory/skills/`.

## Herramientas

- GitHub: `yamilelias/soygerman`
- Supabase: proyecto `nbwxmkcwzqqxvxxfqqpn`. El MCP del editor sí entra. La CLI local está en otra organización y no administra este proyecto.
- Vercel: `weprograpp/soygerman`, producción `https://soygerman-rose.vercel.app`
- Resend: remitente `no-reply@soygerman.com`. El correo de acceso ya llega. La Site URL de Auth tiene que ser `https://www.soygerman.com`, con esa ruta en las redirect URLs.

## Habilidades por construir

No hay habilidades todavía. El directorio `memory/skills/` queda vacío a propósito.

- Aplicar el SMTP de Resend en Supabase y permitir la URL de producción.
- Probar el magic link de punta a punta.
- Anotar la URL del worker de Render y comprobar `GET /health`.
- Verificar QR, sincronización de chats, agenda y cancelación.

## Historial

Cada cambio que termines se commitea en ese momento. El historial local es la copia de lo que pasó; no se cierra una tarea con el trabajo solo en el árbol.

Los commits son atómicos. Una tarea puede dejar varios: uno con la funcionalidad y otro con la documentación o la memoria. El detalle está en `memory/rules/commits.md`.

## Mantenimiento

- Cada mes: revisa `memory/context/current-priorities.md`.
- Cada trimestre: actualiza `memory/context/goals.md`. La nota de ese archivo lo recuerda.
- Al decidir algo que cambie el sistema: una línea en `memory/decisions/log.md`.
- No borres memoria. Pasa lo viejo a `memory/archives/`.
- Al cerrar una sesión larga, copia `memory/templates/session-summary.md`.
- Si alguien dice «recuerda que…», escríbelo en el archivo de memoria que corresponda.

## Secretos

No los escribas en git ni en `memory/`. Van en `.env.local`, en el panel de Supabase o en las variables de Vercel y Render.
