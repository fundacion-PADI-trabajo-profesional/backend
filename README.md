# Backend — Fundación PADI

Backend del sistema de evaluación de la Fundación PADI, desarrollado como Trabajo Profesional Final en la Universidad de Buenos Aires.

Expone una API REST construida con **Express** y desplegada como **Firebase Cloud Function**, con autenticación vía **Supabase Auth** y persistencia en **PostgreSQL** a través de **Prisma ORM**.

---

## Tabla de contenidos

1. [Stack tecnológico](#stack-tecnológico)
2. [Arquitectura](#arquitectura)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Configuración del entorno](#configuración-del-entorno)
5. [Desarrollo local](#desarrollo-local)
6. [Testing](#testing)
7. [Deploy](#deploy)
9. [Decisiones de diseño](#decisiones-de-diseño)
10. [Documentación](#documentacion)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 22 |
| Framework HTTP | Express |
| Infraestructura | Firebase Functions (Gen 2) |
| Autenticación | Supabase Auth |
| ORM | Prisma 6 |
| Base de datos | PostgreSQL (Supabase) |
| Testing | Vitest + Supertest |
| CI/CD | GitHub Actions |
| Lenguaje | TypeScript |

---

## Arquitectura

La aplicación adopta una arquitectura en capas con separación explícita de responsabilidades, cuyo objetivo es favorecer la mantenibilidad, la escalabilidad y el desacoplamiento entre componentes. En este enfoque, cada capa interactúa exclusivamente con la capa inmediatamente inferior, evitando dependencias innecesarias y reduciendo el acoplamiento.

El flujo de una solicitud HTTP comienza en la capa de middleware, donde se realiza la validación del token JWT emitido por Supabase y se incorpora la información del usuario al contexto de la request. Posteriormente, la solicitud es enrutada a través de la capa de routing, que define los endpoints y delega la ejecución en los controladores correspondientes.

La capa de controladores actúa como intermediaria entre el protocolo HTTP y la lógica de negocio: se encarga de procesar la request, invocar los servicios apropiados y construir la respuesta. La lógica de negocio se encuentra encapsulada en la capa de servicios, la cual se mantiene independiente de los detalles de transporte, promoviendo así su reutilización y testabilidad.

Finalmente, la capa de repositorios constituye el único punto de acceso a la persistencia de datos, utilizando Prisma como herramienta de mapeo objeto-relacional. Esta capa abstrae los detalles de acceso a la base de datos, garantizando una interfaz consistente hacia las capas superiores.

En cuanto a la infraestructura de ejecución, el archivo index.ts funciona como punto de entrada en Firebase, exponiendo la aplicación como una Cloud Function. Por su parte, server.ts actúa como punto de composición, donde se configuran los middlewares globales (como CORS) y se registran los distintos routers que conforman la API.

---

## Configuración del entorno

### Variables de entorno

El proyecto usa dos archivos de entorno en `functions/`:

**`.env.local`** — para desarrollo local (no se deployea):
```env
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_KEY=<service_role_key>
```

**`.env`** — variables no sensibles que sí se incluyen en el deploy:
```env
FRONTEND_URL=https://fundacionpadi-41cb2.web.app
```

Las variables sensibles de producción se almacenan en **Google Cloud Secret Manager**.
### Prisma

Para sincronizar el esquema con la base de datos (solo necesario la primera vez o tras cambios en `schema.prisma`):

```bash
cd functions

# Generar el cliente de Prisma
npm run prisma:gen

# Aplicar el esquema a la base de datos
npm run prisma:push
```

Ambos comandos toman la `DATABASE_URL` desde `functions/prisma/.env`.

---

## Desarrollo local

### Prerrequisitos

- Node.js 22.x
- Firebase CLI: `npm install -g firebase-tools`
- Credenciales de Supabase y URL de Postgres (ver sección anterior)

### Instalación

```bash
# Desde la raíz del repo backend/
npm install
npm --prefix functions install
```

### Levantar el emulador

```bash
# Desde backend/
npm run dev
```

Esto lanza en paralelo el compilador TypeScript en modo watch y el emulador de Firebase Functions.

| Servicio | URL |
|----------|-----|
| API | `http://127.0.0.1:5001/fundacionpadi-41cb2/us-central1/api` |
| UI del emulador | `http://127.0.0.1:4000/functions` |

El servidor se recompila automáticamente ante cambios en el código fuente, sin necesidad de reiniciarlo.

---

## Testing

```bash
cd functions

# Correr todos los tests
npm run test

# Correr con análisis de cobertura (umbral mínimo: 70%)
npm run test:coverage
```

### Tipos de tests

**Tests unitarios / de integración** (`test/*.test.ts`): cubren controladores y servicios usando mocks de Prisma y Supabase. No requieren conexión a la base de datos.

**Tests de contrato** (`test/contracts/frontend-backend-alignment.test.ts`): verifican que el frontend llama al backend con los nombres de campos y rutas correctas. Leen los archivos fuente del repo del frontend y validan contratos críticos (snake_case vs camelCase, paths de endpoints, etc.).

### Cobertura

El pipeline de CI falla si alguna métrica cae por debajo del **70%** (líneas, funciones, ramas, sentencias). El reporte HTML se genera en `functions/coverage/`.

---

## Deploy

El deploy a producción corre automáticamente en cada push a `main` a través del pipeline de GitHub Actions (`.github/workflows/deploy-functions.yml`).

El pipeline ejecuta los siguientes pasos en orden:

1. Checkout del repo del backend
2. Checkout del repo del frontend (necesario para los tests de contrato)
3. Instalación de dependencias
4. Compilación de TypeScript
5. Ejecución de tests con verificación de cobertura mínima
6. Creación del `.env` de producción con `FRONTEND_URL`
7. Autenticación con Google Cloud
8. Deploy a Firebase Functions

> El deploy solo se ejecuta si todos los pasos anteriores son exitosos.

Para deployar manualmente:

```bash
# Desde backend/
npm run deploy
```

---

## Decisiones de diseño

### Autenticación con middleware global

La autenticación de las rutas protegidas se implementa a través de un middleware global (requireAuth), responsable de validar el token JWT emitido por Supabase y de recuperar el perfil del usuario desde la base de datos. Como resultado, se adjunta al objeto request una representación normalizada del usuario (req.user), que incluye atributos relevantes como identificador, email, rol y datos asociados.

Este enfoque elimina la necesidad de que el cliente envíe información sensible (como el identificador de usuario o su rol) dentro de la request, mitigando así potenciales vectores de suplantación de identidad. Las rutas públicas (por ejemplo, login, registro y recuperación de contraseña) se excluyen explícitamente de este middleware, siendo registradas con anterioridad en la cadena de middlewares.

###  Gestión de secretos con Google Cloud Secret Manager

Las credenciales de producción (tales como DATABASE_URL, SUPABASE_URL y SUPABASE_KEY) se gestionan mediante Google Cloud Secret Manager. Dichos secretos son inyectados en tiempo de ejecución en la Cloud Function a través de la configuración declarativa (secrets: [...] en index.ts).

Este mecanismo evita la exposición de información sensible tanto en variables de entorno persistentes como en el código fuente versionado, alineándose con buenas prácticas de seguridad en entornos cloud.

### Inicialización diferida del cliente Prisma

El cliente de Prisma se instancia bajo un esquema de inicialización diferida (lazy initialization), es decir, únicamente en el momento en que es requerido por primera vez mediante getPrisma(). Esta decisión responde a las características del entorno de ejecución en Firebase, donde una inicialización temprana podría forzar conexiones a la base de datos durante la fase de análisis del despliegue, generando potenciales timeouts o fallos en el proceso.

###  Tests de contrato entre frontend y backend

Dado que el frontend y el backend se desarrollan en repositorios independientes, se implementan tests de contrato orientados a verificar la consistencia entre ambas capas. En particular, estos tests inspeccionan el código fuente del frontend para validar que las rutas y los nombres de los campos utilizados coincidan con los esperados por el backend.

Este enfoque permite detectar de manera temprana desincronizaciones semánticas (por ejemplo, discrepancias en el nombrado de atributos como userId frente a usuario_id), reduciendo el riesgo de errores en tiempo de ejecución y facilitando la evolución independiente de ambos componentes.

Todas las rutas protegidas pasan por `requireAuth`, un middleware que valida el JWT de Supabase y consulta el perfil del usuario en la base de datos, adjuntando `req.user` con `{ id, email, rol, nombre, apellido, escuela_id }`.

Esto elimina la dependencia de que el frontend envíe el rol/usuario_id como parámetros de request, lo cual era un vector de suplantación de identidad. Las rutas públicas (login, register, reset-password) están montadas antes del middleware.

---

## Documentación
La documentacion del servicio de backend se encuentra publicada en: https://fundacionpadi-docs.web.app
