# PADI – Backend API

API REST del sistema de evaluaciones del Programa de Atención al Desarrollo Infantil (PADI), desarrollada como Trabajo Práctico Profesional de la Universidad de Buenos Aires.

Construida con Node.js + Express + TypeScript, desplegada como Firebase Cloud Function v2 y conectada a una base de datos PostgreSQL alojada en Supabase.  

**Documento de decisiones de arquitectura (ADR):** `https://fundacion-padi-trabajo-profesional.github.io/documentacion-ADR/`  
**Documentación de código:** [https://fundacionpadi-docs.web.app](https://fundacionpadi-docs.web.app)  
**Swagger UI:** `http://localhost:8080/docs`

---

## Índice

1. [Contexto y propósito](#-contexto-y-propósito)
2. [Features principales](#-features-principales)
3. [Stack tecnológico](#️-stack-tecnológico)
4. [Arquitectura y estructura del proyecto](#️-arquitectura-y-estructura-del-proyecto)
5. [Guía para desarrolladores](#-guía-para-desarrolladores)
6. [Variables de entorno y secrets](#-variables-de-entorno-y-secrets)
7. [Seguridad](#-seguridad)
8. [Testing](#-testing)
9. [Documentación de la API](#-documentación-de-la-api)
10. [CI/CD y despliegue](#️-cicd-y-despliegue)
11. [Decisiones de diseño](#-decisiones-de-diseño)

---

## Contexto y propósito

El backend de PADI expone una API REST que da soporte a la plataforma web utilizada por la Fundación PADI para gestionar evaluaciones del desarrollo infantil. Provee los servicios necesarios para:

- Gestionar y aplicar evaluaciones a estudiantes por área de desarrollo.
- Administrar usuarios con roles diferenciados.
- Organizar escuelas, aulas, zonas y estudiantes.
- Consultar estadísticas de resultados por estudiante, sala, escuela, y zona.
- Garantizar que cada usuario accede únicamente a los datos de su ámbito mediante una combinación de medidas de seguridad.

---

## Features principales

### Autenticación y autorización
- Validación de tokens JWT mediante Supabase Auth.
- Middleware `requireAuth` que protege todas las rutas privadas.
- Factory `requireRole(...roles)` para autorización granular por endpoint.
- Propagación del contexto RLS por request usando `AsyncLocalStorage`.

### Evaluaciones
- Creación, consulta y corrección de evaluaciones por área de desarrollo.
- Cálculo de puntaje total y por area de cada evaluación
- Manejo de estados de evaluación y área: No iniciada / En progreso / Aprobada / Desaprobada.

### Gestión de usuarios y estructuras
- CRUD completo de escuelas, aulas, zonas, docentes, directivos y encargados.
- Asignación de docentes y estudiantes a aulas con manejo de fechas de vigencia.

### Estadísticas
- Consultas agregadas de resultados por escuela y zona.
- Filtrado por sala, área y tipo de evaluación.

### Documentación interactiva
- Swagger UI disponible en `/docs` (entornos locales y Docker).

---

## Stack tecnológico

### Stack principal

| Tecnología | Rol |
|---|---|
| **Node.js 22 + TypeScript** | Runtime y tipado estático |
| **Express** | Framework HTTP |
| **Firebase Cloud Functions v2** | Entorno serverless de producción |
| **Prisma ORM 6** | Acceso a base de datos con tipado |
| **PostgreSQL (Supabase)** | Base de datos relacional con RLS |
| **Supabase Auth** | Validación de tokens JWT |

---

## Arquitectura y estructura del proyecto

La aplicación adopta una **arquitectura en capas** con separación explícita de responsabilidades: cada capa interactúa únicamente con la inmediatamente inferior, reduciendo el acoplamiento y favoreciendo la testabilidad.

```
backend/
├── Makefile                   # Comandos de desarrollo, test y Docker
├── docker-compose.yaml        # Configuración Docker para dev local
├── Dockerfile                 # Imagen de producción
├── swagger.yaml               # Especificación OpenAPI 3.0
└── functions/
    ├── prisma/
    │   ├── schema.prisma      # Modelos de base de datos
    │   └── .env               # DATABASE_URL para Prisma CLI (local, no se commitea)
    ├── src/
    │   ├── index.ts           # Entrypoint Firebase Functions
    │   ├── server.ts          # Fábrica de la app Express (middlewares + rutas)
    │   ├── server.local.ts    # Entrypoint standalone para Docker
    │   ├── config/
    │   │   ├── prismaClient.ts    # Singleton Prisma + helpers withRLSContext
    │   │   ├── supabaseClient.ts  # Singleton Supabase
    │   │   └── rlsContext.ts      # AsyncLocalStorage para claims RLS por request
    │   ├── middlewares/
    │   │   └── auth.middleware.ts # requireAuth + requireRole
    │   ├── routes/            # Un router por dominio de negocio
    │   ├── controllers/       # Lógica de request/response
    │   ├── repositories/      # Acceso a datos con Prisma
    │   ├── services/          # Lógica de negocio
    │   └── interfaces/        # Tipos y DTOs compartidos
    ├── test/                  # Tests unitarios y de contratos
    ├── .env                   # Variables no sensibles (ej: FRONTEND_URL)
    ├── .env.local             # Variables locales para el emulador (no se commitea)
    └── .secret.local          # Secrets para el emulador Firebase (no se commitea)
```

### Flujo de una request

```mermaid
sequenceDiagram
    autonumber
    actor Cliente
    participant FF as Firebase Function (onRequest)
    participant Exp as Express App
    participant MW as Middlewares (Helmet/CORS/JSON)
    participant AuthMW as requireAuth (JWT & RLS Claims)
    participant CSR as Controller → Service → Repository
    participant DB as Postgres (withRLSContext + Prisma)

    Cliente->>FF: 1. Envía HTTP Request
    activate FF
    FF->>Exp: Enruta la request
    activate Exp
    
    Exp->>MW: Pasa por Middlewares globales
    activate MW
    MW-->>Exp: Request parseada y segura
    deactivate MW

    alt ¿Es Ruta Pública? (/health, /auth/login)
        Exp->>CSR: Procesa directamente
        activate CSR
        CSR->>DB: Query estándar
        activate DB
        DB-->>CSR: Datos
        deactivate DB
        CSR-->>Cliente: HTTP Response 200 OK
    else ¿Es Ruta Protegida?
        Exp->>AuthMW: Ejecuta requireAuth
        activate AuthMW
        
        alt JWT Inválido o Expirado
            AuthMW-->>Cliente: HTTP 401 Unauthorized
        else JWT Válido
            AuthMW->>AuthMW: Carga perfil & Setea RLS claims
            AuthMW->>CSR: Continúa a Rutas Protegidas
            deactivate AuthMW
            
            CSR->>DB: Ejecuta transacción (withRLSContext)
            activate DB
            Note over DB: Prisma aplica claims de RLS<br/>en la sesión de Postgres antes de la query
            DB-->>CSR: Datos filtrados por RLS
            deactivate DB
            
            CSR-->>Cliente: HTTP Response 200 OK
            deactivate CSR
        end
    end

    deactivate Exp
    deactivate FF
```
---

## Guía para desarrolladores

### Prerrequisitos

- Docker Desktop
- Node.js 22+ (solo si se corre sin Docker)
- Firebase CLI: `npm install -g firebase-tools` (solo para el emulador)

### Opción A — Docker

```bash
# Levantar la API en http://localhost:8080
make up-backend

# Ver logs en tiempo real
make logs

# Detener
make down

# Reconstruir imagen (tras cambios en dependencias o Dockerfile)
make build && make up-backend
```

| Servicio | URL |
|---|---|
| API | `http://localhost:8080` |
| Swagger / Docs | `http://localhost:8080/docs` |

> Requiere el archivo `backend/.env` con las variables de entorno. Ver sección [Variables de entorno](#-variables-de-entorno-y-secrets).

### Opción B — Firebase Emulator

```bash
# Desde la raíz del repo (backend/)
npm run dev
```

Lanza en paralelo el compilador TypeScript en modo watch y el emulador de Firebase Functions.

| Servicio | URL |
|---|---|
| API | `http://127.0.0.1:5001/fundacionpadi-41cb2/us-central1/api` |
| UI del emulador | `http://127.0.0.1:4000/functions` |

> Requiere `functions/.env.local` y `functions/.secret.local`. Ver sección [Variables de entorno](#-variables-de-entorno-y-secrets).

### Comandos adicionales

```bash
cd functions

# Compilar TypeScript (una vez)
npm run build

# Compilar en modo watch
npm run build:watch

# Generar cliente Prisma (tras cambios en schema.prisma)
npm run prisma:gen

# Sincronizar schema con la base de datos
npm run prisma:push
```

---

## Variables de entorno y secrets

### `backend/.env` — Para Docker

```env
DATABASE_URL=postgresql://usuario:password@host:5432/postgres
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_KEY=<service-role-key>
```

### `functions/.env` — Variables no sensibles (se incluyen en el deploy)

```env
FRONTEND_URL=https://fundacionpadi-41cb2.web.app
```

### `functions/.env.local` — Para el emulador Firebase (debe incluirse en el .gitignore)

```env
DATABASE_URL=postgresql://usuario:password@host:5432/postgres
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_KEY=<service-role-key>
```

### `functions/.secret.local` — Secrets del emulador (debe incluirse en el .gitignore)

```env
DATABASE_URL=postgresql://usuario:password@host:5432/postgres
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_KEY=<service-role-key>
```

> ⚠️ Este archivo es necesario porque sin él, el emulador busca los secrets directamente en Google Cloud Secret Manager y trae las credenciales de **producción**.

### `functions/prisma/.env` — Para Prisma CLI (no se commitea)

```env
DATABASE_URL=postgresql://usuario:password@host:5432/postgres
```

### Producción — Google Cloud Secret Manager

Los secrets nunca residen en el código fuente. Se gestionan mediante Firebase CLI:

```bash
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set SUPABASE_URL
firebase functions:secrets:set SUPABASE_KEY
```

> Los archivos `.env.local`, `.secret.local` y `prisma/.env` están incluidos en `.gitignore` y **no deben subirse al repositorio bajo ninguna circunstancia**.

---

## Seguridad

### Autenticación JWT

Todas las rutas (excepto `/health` y `/auth/login`) requieren un token JWT válido:

```
Authorization: Bearer <token>
```

El middleware `requireAuth`:
1. Extrae el token del header `Authorization`.
2. Lo valida con `supabase.auth.getUser(token)`.
3. Carga el perfil del usuario desde la tabla `usuarios` vía Prisma.
4. Inyecta `req.user` con `{ id, email, rol, nombre, apellido, escuela_id }`.
5. Setea el contexto RLS en `AsyncLocalStorage` para el ciclo de vida del request.

Este diseño elimina la dependencia de que el cliente envíe el rol o el `usuario_id` como parámetros en la request, mitigando vectores de suplantación de identidad.

### Row Level Security (RLS)

Cada query a la base de datos se ejecuta dentro de `withRLSContext`, que:
1. Abre una transacción Prisma interactiva.
2. Setea `request.jwt.claims` con los claims del usuario (`sub`, `email`, `role`).
3. Ejecuta `SET LOCAL ROLE authenticated` para activar las policies RLS de PostgreSQL.

Esto garantiza que las policies filtren automáticamente los datos según el rol del usuario, sin necesidad de lógica de filtrado adicional en el código de aplicación. Para operaciones que requieren bypass de RLS se usa `withRLSContextAsAdmin`.

### Headers de seguridad

[Helmet](https://helmetjs.github.io/) aplica automáticamente `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` y otros headers en todas las respuestas.

### Rate limiting

Los endpoints sensibles (`/auth/refresh-token`, `/auth/update-password`) tienen límite de tasa configurado mediante `express-rate-limit`.

---

## Testing

El proyecto usa [Vitest](https://vitest.dev/) con un umbral mínimo de cobertura del **70%** en líneas, funciones, ramas y sentencias. El pipeline de CI falla si alguno de los umbrales no se alcanza.

### Comandos

```bash
# Correr todos los tests
make test

# Tests con reporte de cobertura
make coverage

# Tests de contratos frontend ↔ backend
make test-contracts

# Modo watch (durante desarrollo)
cd functions && npm run test:watch
```

### Tipos de tests

**Tests unitarios/de integración** (`test/**/*.test.ts`): cubren controllers y servicios usando mocks de Prisma y Supabase. No requieren conexión a la base de datos.

**Tests de contrato** (`test/contracts/frontend-backend-alignment.test.ts`): inspeccionan el código fuente del frontend para verificar que las rutas y nombres de campos utilizados coincidan con los esperados por el backend. Detectan de forma temprana desincronizaciones semánticas (por ejemplo, `userId` vs `usuario_id`) entre repositorios independientes.

### Reporte de cobertura

El reporte HTML se genera en `functions/coverage/` tras correr `make coverage`. Incluye desglose por archivo con líneas cubiertas e ignoradas.

---

## Documentación de la API

| Entorno | URL |
|---|---|
| Docker local | `http://localhost:8080/docs` |
| Firebase Emulator | `http://127.0.0.1:5001/fundacionpadi-41cb2/us-central1/api/docs` |
| Publicada | [https://fundacionpadi-docs.web.app](https://fundacionpadi-docs.web.app) |

La especificación completa está en `backend/swagger.yaml` (formato OpenAPI 3.0).

Para regenerar la documentación del código fuente (TypeDoc):

```bash
cd functions && npm run docs
```

---

## CI/CD y despliegue

El deploy a producción corre automáticamente en cada push a `main` mediante el pipeline de GitHub Actions (`.github/workflows/deploy-functions.yml`).

### Pipeline de CI/CD

1. Checkout del repositorio backend
2. Checkout del repositorio frontend (necesario para los tests de contrato)
3. Instalación de dependencias
4. Compilación de TypeScript
5. Ejecución de tests con verificación de umbrales de cobertura
6. Creación del `.env` de producción
7. Autenticación con Google Cloud
8. Deploy a Firebase Cloud Functions

> El deploy solo se ejecuta si todos los pasos anteriores son exitosos.

### Deploy manual

```bash
cd functions
npm run deploy
# equivale a: firebase deploy --only functions
```

La función se despliega con:
- **Runtime:** Node.js 22
- **Memoria:** 256 MiB
- **Secrets:** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY` desde GCP Secret Manager

### Separación de entornos

| Entorno | Base de datos | Cómo levantar |
|---|---|---|
| **Producción** | Supabase PROD | `npm run deploy` |
| **Desarrollo (Docker)** | Supabase DEV | `make up-backend` |
| **Desarrollo (Emulador)** | Supabase DEV | `npm run dev` |

---

## Decisiones de diseño

### Autenticación con middleware global
La autenticación se implementa a través de un middleware global (`requireAuth`) que valida el JWT, recupera el perfil del usuario y lo adjunta al objeto `req`. Esto elimina la necesidad de que el cliente envíe información sensible (rol, identificador) en el cuerpo o query de cada request, reduciendo la superficie de ataque. Las rutas públicas se montan explícitamente antes del middleware.

### Gestión de secrets con Google Cloud Secret Manager
Las credenciales de producción (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`) se gestionan mediante GCP Secret Manager e inyectadas en tiempo de ejecución. Ningún secret reside en variables de entorno persistentes ni en el código versionado, alineándose con buenas prácticas de seguridad en entornos cloud.

### Inicialización diferida del cliente Prisma
Firebase Functions analiza el módulo antes de ejecutarlo. Una instancia de `PrismaClient` en el scope global del módulo generaría conexiones a la base de datos durante el análisis en frío (*cold start*), provocando timeouts. La inicialización diferida en `getPrisma()` resuelve este problema: el cliente se crea únicamente ante la primera request real.

### RLS mediante AsyncLocalStorage
El contexto RLS (claims del usuario JWT) se propaga a través de `AsyncLocalStorage` en lugar de pasarse como parámetro a través de toda la cadena de llamadas. Esto desacopla los repositorios de la capa de autenticación, manteniendo firmas de función limpias y sin dependencias cruzadas entre capas.

### Timeout extendido en transacciones Prisma
Las transacciones interactivas tienen un timeout configurado en 30 segundos (`timeout: 30000, maxWait: 10000`), por encima del default de 5 segundos. Esto es necesario para tolerar la latencia de red hacia Supabase Cloud, que puede superar el umbral default desde entornos de desarrollo.

### Tests de contrato entre repositorios
Dado que el frontend y el backend se desarrollan en repositorios independientes, los tests de contrato inspeccionan el código fuente del frontend para validar que las rutas y nombres de campos utilizados coincidan con los definidos en el backend. Esto permite detectar desincronizaciones semánticas de forma temprana y facilita la evolución independiente de ambos componentes.
