# Activar dos teléfonos sin perder la línea actual

Estado verificado al 2026-11-09: ambas migraciones se aplicaron al proyecto remoto el 2026-10-22; el último GitHub Action confirmó «Remote database is up to date». Una consulta de solo lectura con el service role del proyecto correcto halló 2 sesiones en slot 1, 0 en slot 2, 2644 chats, 59 mensajes y 50 resúmenes; ninguna referencia `session_id` nula en chats, credenciales, mensajes o resúmenes, y ninguna copia de remitente nula en mensajes. Desde la migración hay 18 mensajes nuevos, 1 enviado, 0 fallidos y 0 pendientes vencidos. El worker responde `GET /health`; la web responde y protege Configuración con redirección a login. **Aún no se verificaron las versiones exactas desplegadas, el flag en ambos servicios, la vinculación de dos teléfonos ni la RAM de Render. No habilitar la segunda línea hasta hacerlo.** El conector de Supabase aún carece de permisos, aunque el service role local permite lecturas del proyecto correcto.

Las etapas 1 a 3 de abajo describen el despliegue inicial y ya no deben ejecutarse como instrucciones pendientes. Para continuar, verificar los despliegues activos de Render y Vercel y seguir la etapa 4 con el flag apagado hasta iniciar una prueba controlada. El workflow de migraciones usa Supabase CLI `latest`; al 2026-11-09 la CLI v3 aceptó `--db-url` con una advertencia de deprecación y completó el `db push` sin cambios. Actualizar ese flag antes de que se retire en v4.

## 1. Preflight

Usar el proyecto `nbwxmkcwzqqxvxxfqqpn`. Comparar el esquema real con las migraciones: tablas `whatsapp_sessions`, `whatsapp_auth_files`, `chats`, `scheduled_messages`, `daily_digests`; restricciones `whatsapp_sessions_user_id_key`, `chats_user_id_wa_id_key`, `whatsapp_auth_files_pkey`, `daily_digests_user_id_digest_date_key`; RPC `claim_due_messages(integer)` y publicación Realtime. Guardar conteos e IDs de sesiones, chats y mensajes antes de modificar datos. Confirmar que no hay cambios remotos que falten en git.

## 2. Ampliar sin habilitar

Aplicar `20261022120000_multi_phone_expand.sql` con una herramienta que registre la versión en el historial de migraciones. No aplicar todavía `20261022130000_multi_phone_enable.sql` ni ejecutar un `db push` que incluya ambas. Validar que todas las filas de chats, credenciales, mensajes y resúmenes tienen `session_id`, que los IDs y conteos previos se conservan, y que cada fila antigua apunta a `slot = 1`. Comprobar un insert de prueba con la forma antigua en un entorno de prueba: los triggers deben asignar la línea 1.

Mantener `MULTI_PHONE_ENABLED=false` en Vercel y Render. Comprobar la línea actual: sesión persistente, QR si necesita reconectar, sync de chats, agenda, cancelación, envío del cron y resumen. El nuevo worker usa `claim_due_messages_v2`; confirmar que la RPC devuelve el `session_id` de la línea 1.

## 3. Cambiar worker y web

Desplegar el commit de código con el flag apagado. En Render, verificar el despliegue activo, una sola instancia, el disco `/data/baileys`, el arranque de la sesión antigua desde `session-<user_id>` y los logs `capacidad` cada minuto. En Vercel, comprobar que Configuración muestra la línea actual, que Chats y Agendar conservan los datos, y que «Añadir teléfono» sigue deshabilitado. Esperar a que ambas versiones estén sirviendo antes de retirar las restricciones antiguas.

Aplicar `20261022130000_multi_phone_enable.sql`. Repetir los controles de la línea 1. Desde este paso **no volver a ejecutar el worker antiguo**, porque sus `ON CONFLICT (user_id, …)` ya no tienen las restricciones antiguas.

## 4. Probar y activar la segunda línea

Con dos teléfonos de prueba, habilitar `MULTI_PHONE_ENABLED=true` en Render y Vercel para una prueba controlada. Crear `slot = 2`, escanear su QR y comprobar que aparece el número correcto. Verificar que ambos sockets siguen conectados tras reiniciar Render, que el mismo JID puede existir en ambas líneas, que Inicio, Chats, Agendar, Pendientes, Historial y el resumen siguen el selector, y que una agenda de cada línea sale por su número. Desconectar la segunda y confirmar que solo sus chats y pendientes cambian. Intentar agendar un chat de la otra línea: debe rechazarse.

Observar los logs `capacidad` y las métricas de memoria y reinicios de Render durante las dos conexiones, la vinculación y el sync. Si el RSS se acerca a 400 MB en la instancia de 512 MB, o hay reinicios por memoria, aumentar la capacidad antes de dejar la función disponible. Mantener una sola instancia del worker; la sesión en memoria y el cron no tienen coordinación entre instancias.

## Vuelta atrás

Apagar `MULTI_PHONE_ENABLED` en ambos servicios impide crear otra línea sin borrar datos. Si aún no se aplicó la migración de activación, conservar la ampliación y volver a la versión compatible del worker o de la web. Si ya se aplicó, volver solo a un despliegue que entienda `session_id`. No borrar columnas, sesiones, credenciales ni la carpeta antigua como parte de la reversión.
