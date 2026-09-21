# AGENTS.md

Guía para agentes de IA que trabajen en este repositorio (LTI - Sistema de
Seguimiento de Talento). Complementa `README.md` (setup detallado) y
`backend/ManifestoBuenasPracticas.md` (DDD, SOLID, DRY).

## Estructura del proyecto

- `backend/`: API Express + TypeScript, ORM Prisma, arquitectura DDD.
  - `src/domain/models/`: entidades de dominio (Candidate, Position, Interview...).
  - `src/application/services/`: lógica de aplicación / casos de uso.
  - `src/presentation/controllers/`: controladores HTTP.
  - `src/routes/`: definición de rutas Express.
  - `prisma/schema.prisma`: esquema de base de datos; `prisma/seed.ts` datos de ejemplo.
  - `api-spec.yaml`: contrato OpenAPI de la API — mantenlo sincronizado con cambios de rutas.
  - `ModeloDatos.md`: diagrama/descripción del modelo de datos.
- `frontend/`: React (Create React App), JS y algo de TSX/TS mixto.
  - `src/components/`: componentes de UI (mayoría `.js`, nuevos en `.tsx` si aplica).
  - `src/services/`: llamadas a la API backend.
- Raíz: `docker-compose.yml` levanta Postgres; `.env` (raíz y `backend/.env`)
  contienen `DATABASE_URL`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`.

No existe carpeta `src/infrastructure/` pese a que el README la menciona;
no asumas su existencia.

## Comandos de setup

```sh
docker-compose up -d              # Postgres en background
cd backend && npm install
cd frontend && npm install
```

Backend (desde `backend/`):
```sh
npx prisma generate
npx prisma migrate dev
npx ts-node prisma/seed.ts        # datos de ejemplo (opcional)
npm run dev                       # ts-node-dev con hot reload, puerto 3010
```

Frontend (desde `frontend/`):
```sh
npm start                         # puerto 3000
```

## Comandos de test

Ejecuta SIEMPRE los tests del paquete que modificaste antes de dar por
terminada una tarea.

```sh
cd backend && npm test            # jest (ts-jest), tests junto al código: *.test.ts
cd frontend && npm test           # jest vía react-scripts/testing-library
```

No hay Cypress configurado todavía (aunque está como devDependency en el
`package.json` raíz) — no inventes comandos ni archivos de configuración de
Cypress que no existen.

## Estilo de código

- Backend: TypeScript estricto según `tsconfig.json`; lint/format con ESLint
  + Prettier (`.eslintrc.js`, `.prettierrc`: comillas simples, trailing
  comma `all`). No hay script `lint` en `package.json`; usa `npx eslint src`
  si necesitas verificar.
- Sigue DDD: la lógica de negocio va en `domain`/`application`, no en
  controladores. Ver `backend/ManifestoBuenasPracticas.md` para el
  razonamiento (DDD, SOLID, DRY) antes de añadir abstracciones nuevas.
- Frontend: componentes funcionales de React; el proyecto está migrando
  gradualmente de `.js` a `.ts`/`.tsx` — si tocas un archivo `.js` no lo
  migres a menos que se pida explícitamente.
- Nombres, mensajes de commit y comentarios de código en inglés, salvo que
  el archivo ya esté en español (p.ej. `ModeloDatos.md`).

## Flujo de trabajo esperado

1. Antes de cambios de esquema, revisa `backend/prisma/schema.prisma` y
   `ModeloDatos.md`; toda migración se crea con
   `npx prisma migrate dev --name <descripcion>`, nunca editando migraciones
   ya aplicadas a mano.
2. Si cambias una ruta o payload de la API, actualiza `backend/api-spec.yaml`
   en el mismo cambio.
3. Añade o actualiza el test junto al archivo modificado
   (`<archivo>.test.ts`) siguiendo el patrón ya usado en
   `candidateService.test.ts` / `positionController.test.ts`.
4. No añadas dependencias nuevas sin confirmar antes con el usuario (regla
   explícita del proyecto).
5. Nunca hagas commit, push ni acciones destructivas sobre el repo sin
   confirmación previa.

## PRs y CI

Este repo es parte de un curso (AI4Devs); el README define un flujo de PR
basado en forks con despliegue a EC2 vía GitHub Actions y una checklist
antes de abrir PR (build sin errores, tests en verde, pipeline CI/CD
exitoso, evidencia de despliegue). Revisa la sección "Development Workflow"
del `README.md` antes de proponer un PR real contra el repo principal.

## Seguridad

- Nunca incluyas credenciales/secretos en código o commits; usa `.env`
  (ya ignorado por git) y GitHub Secrets para CI.
- No modifiques `.env` con valores reales de producción.
