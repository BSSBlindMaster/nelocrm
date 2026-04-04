# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run Next.js linter
```

No test framework is configured.

## Architecture

**Nelo CRM** — a Next.js 14 (App Router) SaaS CRM for a home services/installation business. TypeScript strict mode, Tailwind CSS for styling, Supabase for database/auth.

### Key Layers

- **`/app`** — Pages and API routes (Next.js App Router). Protected routes live under `/dashboard` layout which validates Supabase sessions.
- **`/components`** — Custom UI components (Sidebar, Topbar, Badge, InstallerView). No component library — everything is built with Tailwind utilities.
- **`/lib`** — Business logic and integrations: Supabase clients, permissions engine, KPI calculations, Twilio SMS, Mapbox geocoding.
- **`/supabase`** — Database migrations (`/migrations`), schema, and seed data.

### Auth Flow

Supabase Auth with email/password. Login at `/`, session validated in `/app/dashboard/layout.tsx`. Users are linked to `app_users` table via `auth_user_id`.

### Permissions System

Role-based access control implemented in `/lib/permissions.ts`. Roles have permissions via `role_permissions` table, with per-user overrides in `user_permission_overrides`. The Sidebar and page components conditionally render based on the current user's permission array.

### State Management

No global state library. Components use React hooks (`useState`/`useEffect`) and fetch data directly from Supabase client-side. User context is resolved per-component via `/lib/current-app-user.ts`.

### Database

PostgreSQL via Supabase. Key tables: `app_users`, `roles`, `permissions`, `customers`, `quotes`, `quote_lines`, `projects`, `project_tasks`, `appointments`, `appointment_slots`, `business_settings`, `pricing_settings`, `manufacturers`, `products`, `fabrics`, `price_grids`.

### External Integrations

- **Supabase** — DB, auth, realtime
- **Twilio** (`/lib/twilio.ts`) — SMS notifications
- **Mapbox** (`/lib/mapbox.ts`) — Address autocomplete/geocoding

### Styling

Tailwind CSS with custom theme colors: primary `#FF4900`, sidebar `#1C1C1C`. Path alias `@/*` maps to project root.

### Environment Variables

See `.env.local.example` for required Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
