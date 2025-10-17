Backend (Firebase Functions)
============================

Resumen
- Stack: Firebase Functions (Node 22), Express, TypeScript, Vitest, Firebase Emulator.
- Proyecto del front vive aparte; en dev el front consume este backend vía URL del emulador.

Prerrequisitos
- Node.js 22.x
- Firebase CLI (instalar: `curl -sL https://firebase.tools | bash`)

Instalación
```bash
cd /home/nishy/TPP-PADI/backend
npm install
npm --prefix functions install
```

Desarrollo (watch + emulador)
```bash
npm run dev
```
- UI del emulador: http://127.0.0.1:4000/functions
- Base URL API local: http://127.0.0.1:5001/fundacionpadi-41cb2/us-central1/api
  - Healthcheck: GET /health → http://127.0.0.1:5001/fundacionpadi-41cb2/us-central1/api/health

Integración con frontend (dev)
- Define la base en tu front (ej. Vite): `frontend/.env.local`
```
VITE_API_BASE=http://127.0.0.1:5001/fundacionpadi-41cb2/us-central1/api
```
- Consumo ejemplo (TS):
```ts
const res = await fetch(`${import.meta.env.VITE_API_BASE}/health`);
```

Build
```bash
npm --prefix functions run build
```

Tests
```bash
npm --prefix functions run test
```

Deploy (solo Functions)
```bash
cd /home/nishy/TPP-PADI/backend
firebase deploy --only functions
```

Estructura
```
backend/
  .firebaserc
  firebase.json              # runtime nodejs22, emuladores, functions
  package.json               # orquesta dev/build/test
  functions/
    package.json             # proyecto de Cloud Functions
    tsconfig.json
    src/index.ts             # Express + rutas (api)
    test/*.test.ts           # Vitest
    lib/                     # (salida build)
```

Troubleshooting
- Tipos TS ("Cannot find type definition file for 'node'"):
  1) `npm --prefix functions i -D @types/node@^22`
  2) En `functions/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "types": ["node"],
      "typeRoots": ["./node_modules/@types"]
    }
  }
  ```
  3) Limpiar y reconstruir: `cd functions && rm -rf lib node_modules && npm install && npm run build`

- Emulador runtime:
  - `backend/firebase.json` contiene `"runtime": "nodejs22"`. Actualiza Firebase CLI si ves advertencias.

- Git: no versionar artefactos
  - `node_modules/`, `functions/lib/`, `.firebase/` están en `.gitignore`.
  - Comitea los `package-lock.json`.

# backend
repositorio con la logica de backend para la plataforma web PADI
