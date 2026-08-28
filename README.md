# Azure DevOps Task Editor

Aplicación web (Next.js) para editar en lote las Tasks hijas de un Product Backlog Item (PBI) de Azure DevOps: cambiar estado, reasignar responsable y actualizar horas (Original Estimate / Completed Work) de varias tareas a la vez, sin tener que abrir cada Work Item manualmente.

## Características

- Búsqueda de un PBI por ID y listado automático de sus Tasks hijas.
- Selección múltiple de tareas (con filtro por asignado).
- Actualización masiva de **State** y **Assigned To** para todas las tareas seleccionadas.
- Modo de asignación de horas por tarea (Original Estimate / Completed Work) con reglas de edición según el estado de la task.
- Resultado detallado por tarea tras cada operación (éxito/error).
- Configuración de organización, proyecto, equipo y Personal Access Token (PAT) desde la propia UI, guardada en cookies `httpOnly` (el PAT nunca queda expuesto al JavaScript del cliente).

## Requisitos previos

- Node.js 20+
- Un [Personal Access Token (PAT) de Azure DevOps](https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate) con permisos de lectura/escritura sobre **Work Items**.

## Puesta en marcha

Instalar dependencias y levantar el servidor de desarrollo:

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

En la pantalla principal, completa:

1. **Organization**, **Project** y (opcional) **Team** de Azure DevOps.
2. Tu **Personal Access Token (PAT)**.
3. El **ID del PBI** a editar y presiona "Look up" para cargar sus tareas.

Estos datos se guardan como cookies de sesión (con expiración automática) para no tener que reingresarlos en cada request.

## Scripts disponibles

| Script          | Descripción                                    |
| --------------- | ----------------------------------------------- |
| `npm run dev`   | Levanta el entorno de desarrollo (Turbopack).    |
| `npm run build` | Genera el build de producción.                   |
| `npm run start` | Sirve el build de producción.                    |
| `npm run lint`  | Ejecuta ESLint sobre el proyecto.                |

## Estructura del proyecto

```
app/
  page.tsx              # UI principal (selección y edición masiva de tasks)
  api/
    session/             # Alta/consulta de la sesión (PAT, org, project, team)
    pbi/[id]/             # Consulta de un PBI y sus tasks hijas
    tasks/bulk/           # Actualización masiva de tasks
    assignees/            # Listado de posibles asignados (miembros del team)
    task-states/          # Estados válidos para las tasks
lib/
  api-client.ts          # Cliente HTTP usado desde el frontend
  types.ts               # Tipos compartidos
  azure-devops/          # Config, sesión, cliente y tipos de la API de Azure DevOps
```

## Seguridad

- El PAT se almacena en una cookie `httpOnly`, `sameSite=strict` (y `secure` en producción), por lo que no es accesible desde scripts del cliente.
- Todas las llamadas a la API de Azure DevOps se realizan desde el backend (route handlers de Next.js), nunca directamente desde el navegador.

## Tecnologías

- [Next.js](https://nextjs.org) (App Router)
- React 19 + TypeScript
- Tailwind CSS
