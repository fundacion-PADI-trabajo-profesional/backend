# Autoservicio del link de activación

Fecha: 2026-10-30. Pedido de Cata (Fundación PADI) vía Ceci: "que el link de acceso
que se manda no caduque, porque si no lo tiene que volver a mandar".

## Qué pasa hoy

- Al crear un usuario (PADI, encargado o director desde `POST /admin/users`),
  Supabase manda un mail de invitación con un link que lleva a
  `/cambiar-contrasena-temporal` con los tokens en el hash.
- El link vence según "Email OTP expiration" del proyecto Supabase. Estaba en el
  default (1 h); Nish lo subió al tope, 24 h (86400 s). No se puede más: Supabase
  rechaza valores mayores. Vale para invitación y recupero de contraseña por igual.
- Vencido, la pantalla decía "pedile al Equipo PADI que te reenvíe" y solo
  `equipo_padi` podía reenviar (`POST /admin/users/:id/resend-invite`, Gestión de
  usuarios). Una persona en el medio por cada docente que abre el mail tarde.

## Decisión

No se alarga la vida del link (es una credencial de un solo uso que viaja por mail);
se hace barato pedir otro, sin intervención de PADI:

- **Backend**: `POST /auth/reenviar-invitacion` público, con `authLimiter`, body
  `{ email }`. Busca el perfil en `usuarios`; si existe y la cuenta nunca inició
  sesión, reenvía la invitación con el mismo `inviteUserByEmail` que usa PADI.
  Responde **siempre 200 con el mismo mensaje** (exista o no la cuenta, esté o no
  activa) para no revelar qué correos están registrados. 400 solo por email ausente
  o mal formado, o por rate limit de Supabase (mensaje traducido).
  La lógica de reenvío quedó en una función compartida `reenviarInvitacion`
  (`admin.service.ts`), que también usa `AdminService.resendInvite`.
- **Frontend**: `leerHashActivacion` (utils) distingue link vigente / vencido
  (`error_code=otp_expired`) / inválido / sin hash. `CambiarContrasenaTemporal`
  muestra, en vez del formulario de contraseña, el aviso y el formulario
  `FormularioReenvioInvitacion`. Página pública `/reenviar-invitacion` para quien
  no tiene el mail a mano, enlazada desde el login ("¿No pudiste activar tu cuenta?").

## Alternativas descartadas

- Link sin vencimiento: Supabase no lo permite y sería una contraseña en un mail.
- Que las directoras reenvíen desde Docentes: saca a PADI del medio pero sigue
  habiendo una persona; puede sumarse después si hace falta.
- Usar "¿Olvidaste tu contraseña?" para cuentas nunca activadas: no verificado
  que Supabase mande el recupero a un usuario invitado sin confirmar.

## Verificación

- Backend: `test/auth-reenviar-invitacion.test.ts` (servicio + HTTP), suites de
  admin y password reset siguen en verde, contract test nuevo para la función del
  frontend.
- Frontend: `test/utils/activacion.test.ts`, `test/api/auth-reenvio.test.ts`,
  `test/components/reenvio-invitacion.test.ts`.
- Pendiente de probar en prod con un mail real: invitar a un usuario de prueba,
  dejar vencer el link (o abrirlo dos veces) y pedir uno nuevo desde la pantalla.
