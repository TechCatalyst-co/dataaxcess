# DataAxcess

Vehicle data validation and compliance portal for public VIN decoding and authenticated invoice workflows.

## What it does

DataAxcess provides a public VIN decoder and a protected portal for invoice and compliance activity.

| Access | Focus |
| --- | --- |
| Public visitor | Validate a VIN’s format, decode vehicle specifications through NHTSA vPIC, and follow the NICB VINCheck link for a separate stolen vehicle lookup |
| Signed-in user | Create and search invoice records; review personal compliance and invoice activity |
| Admin | Manage user accounts and review archived invoices |
| Sales API client | Look up invoice data by VIN using API credentials and receive XML or JSON |

## Modules

- **Public VIN check** — validates 17-character VIN format in the browser and requests vehicle details from NHTSA vPIC. NICB VINCheck is an external link; stolen status is not checked by the local application.
- **Authentication** — sign-in and sign-out, eight-hour database-backed sessions, HTTP-only cookies, Argon2 password verification, and role-based access checks.
- **Invoice ledger** — authenticated invoice creation and searchable, paginated active records. Invoices expire after 30 days by default; admins can change the expiration period for all invoices from the archived view.
- **Compliance activity** — per-user session status and invoice counts, verification totals, and most recent VIN activity.
- **User management** — admin routes and UI for managing agent accounts and credentials.
- **Sales lookup API** — VIN-based lookup of invoice data for authenticated users; supports XML and JSON responses.

## Tech stack

- React 19 + TypeScript
- Vite 8
- React Router 7 and TanStack Query
- Tailwind CSS 4
- Fastify 5 API with TypeScript
- MongoDB with Mongoose
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

Requires Node.js 22 or later, npm 10 or later, and MongoDB 7.0 or compatible.

```sh
git clone <repository-url>
cd dataaxcess
npm install
```

Start a local MongoDB instance (e.g. `mongod` or MongoDB Compose) and create the `dataaxcess` database. No schema setup is required; collections and indexes are initialized on seed/start.

Copy `apps/api/.env.example` to `apps/api/.env` and set the local connection string and admin credentials:

```dotenv
MONGODB_URI=mongodb://localhost:27017/dataaxcess
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
| `npm run db:seed -w @dataaxcess/api` | Create or reset the configured admin account |
| `npm run db:import-live-csv -w @dataaxcess/api` | Import legacy live-site CSVs into MongoDB |

Collections and indexes are initialized automatically on seed/startup; there are no SQL migrations to generate or apply. For schema changes, update `apps/api/src/db/schema.ts` (Mongoose schemas) and restart the API.

### Importing the legacy live-site CSVs

The two source files are kept in the project root's ignored `private-migration-data` folder:

- `private-migration-data/tbl_user.csv`
- `private-migration-data/tbl_product.csv`

That folder is excluded by `.gitignore`; do not remove the ignore rule or commit these files. The user CSV contains plaintext passwords. The importer hashes each exact password with Argon2id, preserving the user's ability to sign in with the same password; plaintext values are never logged or stored.

The importer requires the `user`, `pass`, and `status` user columns and the `Invoice`, `VIN`, `Year`, `Make`, and `Model` product columns. It accepts duplicate VINs, but duplicate invoice numbers and usernames are reported and skipped because they cannot be represented safely. Missing or invalid optional dates are omitted. Missing required vehicle text uses `Unassigned`; missing or invalid year and odometer values use `0`; missing verified status uses `No`. Every invoice receives the same import-time `reportDate`, which makes it recent for the application's expiration rules. Invalid or overlong optional text is reported and uses a fallback or is truncated to the schema limit. Rows with unusable usernames/passwords or invoice numbers are skipped, while other valid rows continue to import. Review the report's `skipped` and `warnings` entries before and after applying.

When preparing the production import:

1. Set `MONGODB_URI` to the **production MongoDB database** in the deployment environment. Do not use your local `.env` unless you intentionally want to import into the local database.
2. Back up the target database.
3. From the project root, run a target check. This validates CSV structure and checks for existing usernames/invoice numbers in the target database; it does not write imported records:

```powershell
npm run db:import-live-csv -w @dataaxcess/api -- --users ".\private-migration-data\tbl_user.csv" --products ".\private-migration-data\tbl_product.csv" --check-target
```

4. Review the importable counts, warnings, and skipped rows. Confirm the destination is the intended empty database and decide how to handle any reported skips before applying. The command can still import valid rows when other rows are skipped.
5. To perform the import, run the same command with `--apply` added:

```powershell
npm run db:import-live-csv -w @dataaxcess/api -- --users ".\private-migration-data\tbl_user.csv" --products ".\private-migration-data\tbl_product.csv" --check-target --apply
```

The import writes users and invoices without a multi-document transaction (standalone MongoDB does not support them). Existing records are not overwritten; a rerun skips records that were already inserted and continues with the remaining rows. Review the final imported counts and skipped rows. Do not run the seed command afterward for an imported admin account, because the seed command resets that account's password. Verify imported counts, run `npm run db:validate-mongo -w @dataaxcess/api`, and test a user login with their original password. Keep the CSVs restricted until the migration is verified and any required retention is complete, then remove them securely. Never put production database credentials or these CSVs in Git.

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
| `GET`, `POST` | `/api/invoices` | Signed in | Search/list active invoices and create invoice records |
| `GET` | `/api/invoices/archived` | Admin | Search and paginate archived invoices, including the current expiration period |
| `PUT` | `/api/invoices/expiration-threshold` | Admin | Set the expiration period in days for all invoices |
| `GET` | `/api/users/count` | Signed in | Read the aggregate registered-user count for the dashboard |
| `/api/users` and `/api/users/:id` | Admin | View and manage user accounts; see `apps/api/src/routes/users.ts` for supported methods |
| `GET`, `POST` | `/api/sales-api` | API credentials | VIN lookup; `format=xml` or `format=json` |

The sales API accepts HTTP Basic authentication or credentials in a form/request body. Do not send passwords in query parameters. Its request and response details are implemented in `apps/api/src/routes/sales-api.ts`.

## Environment

API settings are read from `apps/api/.env` during local development:

- `MONGODB_URI` — MongoDB connection URI; defaults to `mongodb://localhost:27017/dataaxcess`.
- `WEB_ORIGIN` — allowed frontend origin for credentialed CORS; defaults to `http://localhost:5173`.
- `PORT` — API port; defaults to `3000`.
- `NODE_ENV` — set to `production` for secure production cookie behavior.
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` — required by the admin seed command; password minimum is 12 characters.

## Security and deployment

- Use HTTPS and deployment-managed secrets in production. Set `WEB_ORIGIN` to the exact frontend origin and `NODE_ENV=production`.
- Production session cookies are secure and use the `__Host-` prefix.
- Seed the admin account (`db:seed`) before starting a version that requires it.
- The API binds to `0.0.0.0`; protect it with deployment network controls.
- The landing page describes some integrations as planned or available. In the current implementation, NHTSA vPIC provides the public vehicle decode and NICB is linked as an external lookup.

## Troubleshooting

- **Cannot connect to MongoDB:** Check that the server is running and that `MONGODB_URI`, database name, and credentials are correct.
- **Cannot sign in:** Seed the admin using the intended environment values (`npm run db:seed -w @dataaxcess/api`).
- **CORS error:** Match `WEB_ORIGIN` to the frontend's exact scheme, hostname, and port, then restart the API.
- **VIN lookup fails:** The browser calls NHTSA vPIC directly, so check browser internet access and the external service.

