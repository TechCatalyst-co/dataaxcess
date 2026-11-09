# DataAxcess

Vehicle data validation and compliance portal for public VIN decoding and authenticated invoice workflows.

## What it does

DataAxcess provides a public VIN decoder and a protected portal for invoice and compliance activity.

| Access | Focus |
| --- | --- |
| Public visitor | Validate a VIN’s format, decode vehicle specifications through NHTSA vPIC, and follow the NICB VINCheck link for a separate stolen vehicle lookup |
| Signed-in user | Create and search invoice records; review personal compliance and invoice activity |
| Admin | Manage user accounts and access admin functions |
| Sales API client | Look up invoice data by VIN using API credentials and receive XML or JSON |

## Modules

- **Public VIN check** — validates 17-character VIN format in the browser and requests vehicle details from NHTSA vPIC. NICB VINCheck is an external link; stolen status is not checked by the local application.
- **Authentication** — sign-in and sign-out, eight-hour database-backed sessions, HTTP-only cookies, Argon2 password verification, and role-based access checks.
- **Invoice ledger** — authenticated invoice creation and searchable, paginated records.
- **Compliance activity** — per-user session status and invoice counts, verification totals, and most recent VIN activity.
- **User management** — admin routes and UI for managing agent accounts and credentials.
- **Sales lookup API** — VIN-based lookup of invoice data for authenticated users; supports XML and JSON responses.

## Tech stack

- React 19 + TypeScript
- Vite 8
- React Router 7 and TanStack Query
- Tailwind CSS 4
- Fastify 5 API with TypeScript
- MySQL with Drizzle ORM and checked-in SQL migrations
- Shared validation schemas built with Zod

## Project structure

```text
apps/
  api/
    src/routes/       authentication, invoices, users, and sales API
    src/db/           Drizzle schema, connection, and admin seed command
    drizzle/          SQL migrations and migration metadata
  web/
    src/features/     landing, authentication, dashboard, invoices, users, compliance
packages/
  shared/src/         validation schemas and shared types
```

## Local development

Requires Node.js 22 or later, npm 10 or later, and MySQL 8.0 or compatible.

```sh
git clone <repository-url>
cd dataaxcess
npm install
```

Create a MySQL database and application user. For a local MySQL instance, for example:

```sql
CREATE DATABASE dataaxcess CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dataaxcess'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON dataaxcess.* TO 'dataaxcess'@'localhost';
FLUSH PRIVILEGES;
```

Copy `apps/api/.env.example` to `apps/api/.env` and set the local connection string and admin credentials:

```dotenv
DATABASE_URL=mysql://dataaxcess:replace-with-a-strong-password@localhost:3306/dataaxcess
WEB_ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-unique-password-at-least-12-chars
```

If the database password contains reserved URL characters, URL-encode them in `DATABASE_URL`. Keep `.env` files and secrets out of version control. The configured admin password must contain at least 12 characters.

Apply migrations and create the initial admin account:

```sh
npm run db:migrate -w @dataaxcess/api
npm run db:seed -w @dataaxcess/api
```

The seed command creates the configured admin when absent. If the username already exists, it resets its password and promotes that account to admin.

Run the API and frontend in separate terminals from the repository root:

```sh
npm run dev:api
```

```sh
npm run dev:web
```

The API listens at `http://localhost:3000`; Vite prints the frontend URL, normally `http://localhost:5173`. Check `GET http://localhost:3000/health` for API status, then sign in with the seeded admin credentials.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev:api` | Start API in watch mode |
| `npm run dev:web` | Start Vite development server |
| `npm run build -w @dataaxcess/api` | Compile API TypeScript |
| `npm run start -w @dataaxcess/api` | Run compiled API |
| `npm run typecheck -w @dataaxcess/api` | Type-check API |
| `npm run build -w @dataaxcess/web` | Type-check and build frontend |
| `npm run lint -w @dataaxcess/web` | Lint frontend |
| `npm run preview -w @dataaxcess/web` | Preview built frontend |
| `npm run db:generate -w @dataaxcess/api` | Generate Drizzle migration from schema changes |
| `npm run db:migrate -w @dataaxcess/api` | Apply pending migrations |
| `npm run db:seed -w @dataaxcess/api` | Create or reset the configured admin account |

For schema changes, update `apps/api/src/db/schema.ts`, generate and review the SQL migration in `apps/api/drizzle/`, then apply it with `db:migrate`.

### Importing the legacy live-site CSVs

The two source files are kept in the project root's ignored `private-migration-data` folder:

- `private-migration-data/tbl_user.csv`
- `private-migration-data/tbl_product.csv`

That folder is excluded by `.gitignore`; do not remove the ignore rule or commit these files. The user CSV contains plaintext passwords. The importer hashes each password with Argon2 and does not log or store plaintext passwords.

When preparing the production import:

1. Set `DATABASE_URL` to the **production MySQL database** in the deployment environment. Do not use your local `.env` unless you intentionally want to import into the local database.
2. Back up the target database and apply the project's migrations:

```powershell
npm run db:migrate -w @dataaxcess/api
```

3. From the project root, run a target check. This reads the CSVs and checks for duplicate usernames/invoice numbers in the target database; it does not write imported records:

```powershell
npm run db:import-live-csv -w @dataaxcess/api -- --users ".\private-migration-data\tbl_user.csv" --products ".\private-migration-data\tbl_product.csv" --check-target
```

4. Confirm the report shows 8 users and 4,352 invoices importable, with no failures or existing-record conflicts. If the target check reports conflicts, stop and resolve them before importing.
5. To perform the import, run the same command with `--apply` added:

```powershell
npm run db:import-live-csv -w @dataaxcess/api -- --users ".\private-migration-data\tbl_user.csv" --products ".\private-migration-data\tbl_product.csv" --check-target --apply
```

The import writes users and invoices in one database transaction. Do not run the seed command afterward for an imported admin account, because the seed command resets that account's password. Afterward, verify the imported counts and test a user login. Keep the CSVs restricted until the migration is verified and any required retention is complete, then remove them securely. Never put production database credentials or these CSVs in Git.

## API

Protected endpoints use the session cookie created by login. The sales lookup endpoint uses separate username/password API credentials.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Health check |
| `POST` | `/api/auth/login` | Public | Sign in |
| `POST` | `/api/auth/logout` | Signed in | End session |
| `GET` | `/api/auth/me` | Signed in | Current user |
| `GET` | `/api/admin/check` | Admin | Verify administrator access |
| `GET` | `/api/compliance/audit` | Signed in | Current user's session and invoice activity |
| `GET`, `POST` | `/api/invoices` | Signed in | Search/list and create invoice records |
| `/api/users` | Admin | User management; see `apps/api/src/routes/users.ts` for supported methods |
| `GET`, `POST` | `/api/sales-api` | API credentials | VIN lookup; `format=xml` or `format=json` |

The sales API accepts HTTP Basic authentication or credentials in a form/request body. Do not send passwords in query parameters. Its request and response details are implemented in `apps/api/src/routes/sales-api.ts`.

## Environment

API settings are read from `apps/api/.env` during local development:

- `DATABASE_URL` — MySQL connection URI.
- `WEB_ORIGIN` — allowed frontend origin for credentialed CORS; defaults to `http://localhost:5173`.
- `PORT` — API port; defaults to `3000`.
- `NODE_ENV` — set to `production` for secure production cookie behavior.
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` — required by the admin seed command; password minimum is 12 characters.

## Security and deployment

- Use HTTPS and deployment-managed secrets in production. Set `WEB_ORIGIN` to the exact frontend origin and `NODE_ENV=production`.
- Production session cookies are secure and use the `__Host-` prefix.
- Run database migrations before starting a version that requires them.
- The API binds to `0.0.0.0`; protect it with deployment network controls.
- The landing page describes some integrations as planned or available. In the current implementation, NHTSA vPIC provides the public vehicle decode and NICB is linked as an external lookup.

## Troubleshooting

- **Cannot connect to MySQL:** Check that the server is running and that `DATABASE_URL`, database name, and grants are correct.
- **Cannot sign in:** Apply migrations and seed the admin using the intended environment values.
- **CORS error:** Match `WEB_ORIGIN` to the frontend's exact scheme, hostname, and port, then restart the API.
- **VIN lookup fails:** The browser calls NHTSA vPIC directly, so check browser internet access and the external service.

