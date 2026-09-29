# PostgreSQL

The PostgreSQL service is defined in the root `docker-compose.yml`.

1. Start PostgreSQL from the project root with `docker compose up -d postgres`.
2. Configure the PostgreSQL connection in `backend/.env` (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
3. Start the API with `cd backend` then `npm run dev` (or `npm start`).
4. Open `http://localhost:3000/api/health`. A successful response reports `"database":"connected"`.

When the API runs inside Docker Compose, use `DB_HOST=postgres` rather than `localhost`.
The backend exposes a shared `pg` pool from `backend/src/config/database.js` for API routes and repositories.

The frontend at `http://localhost:5173` calls the backend at `http://localhost:3000/api`.
The backend creates its required tables automatically at startup. Role permissions are enforced by backend middleware, not just by hiding frontend screens:

- **Admin:** manage registered accounts and assign Admin, Nhân viên, or Khách hàng roles; manage categories.
- **Nhân viên:** view and process all orders, confirm counter payments, print bills, and add merchandise.
- **Khách hàng:** browse active merchandise, create orders, and view only their own orders and invoices. Registration always creates a customer account.

Protected routes include `GET /auth/me`, `GET /admin/users?search=&role=`, `PATCH /admin/users/:id/role`, `DELETE /admin/users/:id`, and Admin-only `GET /admin/statistics/orders/daily?date=YYYY-MM-DD`; category APIs require Admin, product/order APIs are role-limited, and only employees/Admin can update order status. The browser sends the bearer token on API calls; changing a frontend route does not grant API access.

The frontend source is under `frontend/src`; the daily report UI is in `frontend/src/order-statistics.js`. The Admin user-management router is in `backend/src/modules/user-management/routes.js`, and the daily report API is in `backend/src/modules/order-statistics/routes.js`; both are mounted by `backend/src/server.js`.

Login and registration return opaque bearer tokens stored as hashes in `auth_sessions`; passwords are stored as salted hashes. The fixed administrator is `Lý A Vinh` (`Vinhly`), with its password configured privately as `SUPER_ADMIN_PASSWORD` in `backend/.env`. Backend startup enforces this account as the sole Admin, and the account cannot be demoted or deleted through the API. Customers create orders with pending counter payment; staff confirm payment through the order screen. No online payment gateway is configured.
