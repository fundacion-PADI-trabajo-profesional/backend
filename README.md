Backend (Firebase Functions)
============================

flujo:

functions/src/index.ts: expone la Cloud Function api con functions.https.onRequest(app).
functions/src/server.ts: define createApp() (Express), configura CORS/JSON y monta routers.
functions/src/routes/health.router.ts: registra GET /health y lo dirige al controlador.
functions/src/controllers/health.controller.ts: maneja la request/response; delega en el servicio.
functions/src/services/health.service.ts: contiene la lógica de negocio; delega en el repo.
functions/src/repositories/health.repository.ts: acceso a datos (por ahora, stub que devuelve { ok: true }).


Rol de cada carpeta/archivo:


index.ts: punto de entrada Firebase (infra).
server.ts: composición de la app Express (middlewares + montaje de routers).
routes/*: define rutas y las asocia a controladores (no lógica).
controllers/*: traduce HTTP ↔ casos de uso (lee req, valida, llama servicio, arma res).
services/*: reglas de negocio/casos de uso (no HTTP, no DB directo).
repositories/*: acceso a datos/APIs/SDKs (DB, externos).
interfaces/*: contratos y tipos compartidos (e.g., CommonResponse<T>).


Resumen
- Stack: Firebase Functions (Node 22), Express, TypeScript, Prisma (Postgres), Vitest, Firebase Emulator.
- El frontend vive aparte; en dev el front consume este backend vía la URL del emulador.

Prerrequisitos
- Node.js 22.x
- Firebase CLI (instalar: `curl -sL https://firebase.tools | bash`)
- URL de Postgres (p. ej., Supabase). Recomendado usar Session Pooler.

1) Instalación
```bash
cd /TPP-PADI/backend
npm install
npm --prefix functions install
```

2) Configurar base de datos (Prisma)
- Te voy a enviar el archivo `.env` por WhatsApp.
- Ubícalo exactamente en: `/home/nishy/TPP-PADI/backend/functions/prisma/.env` (mismo nombre, sin comillas en el valor y en una sola línea).
- No lo comitees.
- Generar cliente y sincronizar schema:
```bash
cd /home/nishy/TPP-PADI/backend/functions
export NODE_OPTIONS=--dns-result-order=ipv4first
set -a; source prisma/.env; set +a
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
```


3) Tests
```bash
npm --prefix TPP-PADI/backend/functions run test
```

5) Levantar en desarrollo (emulador + watcher)
```bash
cd /home/nishy/TPP-PADI/backend
# exporta DB si vas a usar Prisma en dev
set -a; source functions/prisma/.env; set +a
npm run dev
# UI emulador: http://127.0.0.1:4000/functions
# Base API:    http://127.0.0.1:5001/fundacionpadi-41cb2/us-central1/api
```

Endpoints actuales
- GET `/health` → `{ success: true, message: "ok", data: null }`
- GET `/evaluaciones` → lista (Prisma si hay DB, caso contrario fallback → array vacío)
- GET `/evaluaciones/:id` → 200 con objeto o 404 con `{ success: false, error: { code: "NOT_FOUND" } }`

Estructura
```
backend/
  .firebaserc
  firebase.json              # runtime nodejs22, emuladores, functions
  package.json               # orquesta dev/build/test
  functions/
    package.json             # proyecto Cloud Functions
    tsconfig.json
    prisma/
      schema.prisma
      .env                   # DATABASE_URL (no commitear)
    src/
      index.ts               # entrypoint Firebase
      server.ts              # Express app (middlewares + routers)
      routes/
      controllers/
      services/
      repositories/
      interfaces/
      config/
        prismaClient.ts      # Prisma singleton
        supabaseClient.ts    # Supabase (opcional)
    test/*.test.ts           # Vitest
```

Troubleshooting
- Prisma P1001 (no conecta):
  - Usa el Session Pooler de Supabase (`...pooler.supabase.com:5432`) y `sslmode=require`.
  - Asegúrate de exportar `DATABASE_URL`: `set -a; source prisma/.env; set +a`.

- Módulo faltante `@supabase/supabase-js`
  - Instalar en Functions: `npm --prefix /home/nishy/TPP-PADI/backend/functions i @supabase/supabase-js`


