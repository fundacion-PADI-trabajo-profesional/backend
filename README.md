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
- generacion de archivo .env con los datos necesarios
- Generar cliente y sincronizar schema:
```bash
cd backend/functions
export NODE_OPTIONS=--dns-result-order=ipv4first
set -a; source prisma/.env; set +a
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
```


3) Tests
```bash
npm --prefix backend/functions run test
```
4) Crear un cliente de Prisma al correr el proyecto por primera vez
```bash
cd backend/fuctions/prisma
npx dotenv -e .env -- npx prisma generate
```

5) Incializar el cliente de Supabase al correr el proyecto por primera vez
```bash
cd backend/functions
```
Crear un archivo .env.local con el siguiente contenido:
```bash
SUPABASE_URL= url
SUPABASE_KEY= key de supabase
```

Luego, correr desde /backend:
```bash
npm install && npm --prefix functions install
```

6) Levantar en desarrollo (emulador + watcher)
```bash
cd backend
# exporta DB si vas a usar Prisma en dev
set -a; source functions/prisma/.env; set +a
npm run dev
# UI emulador: http://127.0.0.1:4000/functions
# Base API:    http://127.0.0.1:5001/fundacionpadi-41cb2/us-central1/api
```
Frente a cambios en el backend no es necesario volver a levantar el sistema con npm run dev. Si el sistema esta corriendo, se recompila automaticamente.


Troubleshooting
- Prisma P1001 (no conecta):
  - Usa el Session Pooler de Supabase (`...pooler.supabase.com:5432`) y `sslmode=require`.
  - Asegúrate de exportar `DATABASE_URL`: `set -a; source prisma/.env; set +a`.

- Módulo faltante `@supabase/supabase-js`
  - Instalar en Functions: `npm --prefix /home/nishy/TPP-PADI/backend/functions i @supabase/supabase-js`

# DECICIONES DE DISEÑO
## Creación de un Middleware

Se agregó este componente que verifica el token de Supabase en cada request y extrae el rol directamente de la base de datos. Esto resuelve el problema de que hoy cualquiera puede pasarse por otro usuario cambiando los query params. Se aplica como middleware global en server.ts para todas las rutas excepto login y reset-password


# Para evitar caches de las librerias:
```bash
cd backend/functions
npm install
npm run prisma:gen
npm run build
```bash