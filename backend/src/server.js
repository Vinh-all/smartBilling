require('dotenv').config();

const express = require('express');
const cors = require('cors');
const {
  randomBytes,
  createHash,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require('node:crypto');
const { promisify } = require('node:util');
const { pool, checkDatabaseConnection } = require('./config/database');
const { createUserManagementRouter } = require('./modules/user-management/routes');
const { createOrderStatisticsRouter } = require('./modules/order-statistics/routes');

const scrypt = promisify(scryptCallback);
const app = express();
const port = Number(process.env.PORT || 3000);
const SUPER_ADMIN = Object.freeze({ username: 'Vinhly', displayName: 'Lý A Vinh', email: 'vinhly@smartbilling.local' });

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const schemaReady = pool.query(`
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    display_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'employee', 'customer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'employee', 'customer')),
    identity JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  );
  ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS identity JSONB NOT NULL DEFAULT '{}'::jsonb;
  CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'paid', 'completed', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    invoice_number TEXT NOT NULL UNIQUE DEFAULT ('INV-' || upper(substr(md5(random()::text), 1, 10))),
    processed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    processed_by_name TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  -- Keep the most recent employee handler and timestamp for daily Admin reporting.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS processed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS processed_by_name TEXT;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
  CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0)
  );
  CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS orders_processed_at_idx ON orders(processed_at) WHERE processed_at IS NOT NULL;
`).then(() => true).catch((error) => {
  console.error('Could not initialize database schema:', error.message);
  return false;
});

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
async function requireDatabase(_request, _response, next) {
  if (!(await bootstrapReady)) return next(Object.assign(new Error('Database or fixed administrator is unavailable'), { status: 503 }));
  next();
}
async function authenticate(request, response, next) {
  try {
    if (!(await bootstrapReady)) return response.status(503).json({ error: 'Database or fixed administrator unavailable.' });
    const token = request.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return response.status(401).json({ error: 'Vui lòng đăng nhập.' });
    const result = await pool.query(
      `SELECT s.user_id, COALESCE(u.role, s.role) AS role, COALESCE(u.display_name, s.identity->>'displayName') AS display_name,
        COALESCE(u.username, s.identity->>'username') AS username, COALESCE(u.email, s.identity->>'email') AS email
       FROM auth_sessions s LEFT JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [hashToken(token)],
    );
    if (!result.rowCount) return response.status(401).json({ error: 'Phiên đăng nhập đã hết hạn.' });
    request.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}
const allowRoles = (...roles) => (request, response, next) => {
  if (!roles.includes(request.user.role)) return response.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
  next();
};
async function createSession(userId, role, identity = {}) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    'INSERT INTO auth_sessions (token_hash, user_id, role, identity, expires_at) VALUES ($1, $2, $3, $4::jsonb, NOW() + INTERVAL \'7 days\')',
    [hashToken(token), userId, role, JSON.stringify(identity)],
  );
  return token;
}
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
const bootstrapReady = schemaReady.then(async (ready) => {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!ready || !password) {
    console.error('Database initialization or SUPER_ADMIN_PASSWORD configuration is missing.');
    return false;
  }
  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users (display_name, username, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name,
       email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, role = 'admin'`,
    [SUPER_ADMIN.displayName, SUPER_ADMIN.username, SUPER_ADMIN.email, passwordHash],
  );
  await pool.query("UPDATE users SET role = 'customer' WHERE username <> $1 AND role = 'admin'", [SUPER_ADMIN.username]);
  await pool.query("DELETE FROM auth_sessions WHERE user_id IS NULL AND role = 'admin'");
  return true;
}).catch((error) => {
  console.error('Could not initialize fixed administrator:', error.message);
  return false;
});
async function passwordMatches(password, savedHash) {
  const [salt, hex] = savedHash.split(':');
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

app.post('/api/auth/register', requireDatabase, async (request, response, next) => {
  const { displayName, username, email, password } = request.body || {};
  if (!displayName?.trim() || !username?.trim() || !email?.trim() || !password) {
    return response.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin.' });
  }
  if (password.length < 8 || username.trim().length < 3) {
    return response.status(400).json({ error: 'Tên đăng nhập cần ít nhất 3 ký tự, mật khẩu cần ít nhất 8 ký tự.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO users (display_name, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'customer') RETURNING id, display_name, username, email, role`,
      [displayName.trim(), username.trim(), email.trim().toLowerCase(), await hashPassword(password)],
    );
    const user = result.rows[0];
    response.status(201).json({ user, token: await createSession(user.id, user.role, { displayName: user.display_name, username: user.username, email: user.email }) });
  } catch (error) {
    if (error.code === '23505') return response.status(409).json({ error: 'Tên đăng nhập hoặc email đã được sử dụng.' });
    next(error);
  }
});

app.post('/api/auth/login', requireDatabase, async (request, response, next) => {
  const { username, password } = request.body || {};
  try {
    const result = await pool.query(
      'SELECT id, display_name, username, email, password_hash, role FROM users WHERE username = $1',
      [username || ''],
    );
    const user = result.rows[0];
    if (!user || !(await passwordMatches(password || '', user.password_hash))) {
      return response.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }
    delete user.password_hash;
    response.json({ user, token: await createSession(user.id, user.role, { displayName: user.display_name, username: user.username, email: user.email }) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', authenticate, (request, response) => {
  const { user_id, role, display_name, username, email } = request.user;
  response.json({ user: { id: user_id, role, displayName: display_name, username, email } });
});
app.post('/api/auth/logout', authenticate, async (request, response, next) => {
  try {
    await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(request.get('authorization').slice(7))]);
    response.json({ ok: true });
  } catch (error) { next(error); }
});

// Only administrators can edit site categories or manage account roles.
app.get('/api/categories', authenticate, allowRoles('admin'), async (_request, response, next) => {
  try {
    const result = await pool.query("SELECT data FROM app_state WHERE key = 'categories'");
    response.json(result.rows[0]?.data || []);
  } catch (error) { next(error); }
});
app.put('/api/categories', authenticate, allowRoles('admin'), async (request, response, next) => {
  if (!Array.isArray(request.body)) return response.status(400).json({ error: 'Dữ liệu danh mục không hợp lệ.' });
  try {
    const result = await pool.query(
      `INSERT INTO app_state (key, data) VALUES ('categories', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW() RETURNING data`,
      [JSON.stringify(request.body)],
    );
    response.json(result.rows[0].data);
  } catch (error) { next(error); }
});

app.use('/api/admin/users', createUserManagementRouter({ pool, authenticate, allowRoles, superAdminUsername: SUPER_ADMIN.username }));
// Daily employee order reports are isolated in their own Admin-only module.
app.use('/api/admin/statistics/orders', createOrderStatisticsRouter({
  pool,
  authenticate,
  allowRoles,
  timezone: process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh',
}));

// Employees manage orders and payments; customers can only see and create their own orders.
app.get('/api/products', authenticate, allowRoles('admin', 'employee', 'customer'), async (_request, response, next) => {
  try {
    const result = await pool.query('SELECT id, name, description, price, stock FROM products WHERE active = TRUE ORDER BY name');
    response.json(result.rows);
  } catch (error) { next(error); }
});
app.post('/api/products', authenticate, allowRoles('admin', 'employee'), async (request, response, next) => {
  const { name, description = '', price, stock = 0 } = request.body || {};
  if (!name?.trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
    return response.status(400).json({ error: 'Thông tin mặt hàng không hợp lệ.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4) RETURNING id, name, description, price, stock',
      [name.trim(), description, price, stock],
    );
    response.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});
app.post('/api/orders', authenticate, allowRoles('customer'), async (request, response, next) => {
  const items = request.body?.items;
  if (!Array.isArray(items) || !items.length || items.length > 50) return response.status(400).json({ error: 'Giỏ hàng không hợp lệ.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let total = 0;
    const verifiedItems = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw Object.assign(new Error('Số lượng mặt hàng không hợp lệ.'), { status: 400 });
      const product = await client.query('SELECT id, name, price, stock FROM products WHERE id = $1 AND active = TRUE FOR UPDATE', [item.productId]);
      if (!product.rowCount || product.rows[0].stock < quantity) throw Object.assign(new Error('Mặt hàng không tồn tại hoặc không đủ hàng.'), { status: 400 });
      total += Number(product.rows[0].price) * quantity;
      verifiedItems.push({ ...product.rows[0], quantity });
    }
    const order = await client.query('INSERT INTO orders (customer_id, total) VALUES ($1, $2) RETURNING id, invoice_number, status, payment_status, total, created_at', [request.user.user_id, total]);
    for (const item of verifiedItems) {
      await client.query('INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)', [order.rows[0].id, item.id, item.name, item.quantity, item.price]);
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
    }
    await client.query('COMMIT');
    response.status(201).json({ ...order.rows[0], items: verifiedItems });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) return response.status(error.status).json({ error: error.message });
    next(error);
  } finally { client.release(); }
});
app.get('/api/orders', authenticate, async (request, response, next) => {
  if (!['admin', 'employee', 'customer'].includes(request.user.role)) return response.status(403).json({ error: 'Không có quyền.' });
  try {
    const params = [];
    let where = '';
    if (request.user.role === 'customer') { params.push(request.user.user_id); where = 'WHERE o.customer_id = $1'; }
    const result = await pool.query(
      `SELECT o.id, o.customer_id, u.display_name AS customer_name, o.invoice_number, o.status, o.payment_status, o.total, o.created_at,
        COALESCE(json_agg(json_build_object('name', i.product_name, 'quantity', i.quantity, 'price', i.unit_price)) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
       FROM orders o JOIN users u ON u.id = o.customer_id LEFT JOIN order_items i ON i.order_id = o.id
       ${where} GROUP BY o.id, u.display_name ORDER BY o.created_at DESC`, params,
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});
app.patch('/api/orders/:id/status', authenticate, allowRoles('admin', 'employee'), async (request, response, next) => {
  const { status, paymentStatus } = request.body || {};
  const validStatus = ['new', 'processing', 'paid', 'completed', 'cancelled'];
  const validPayment = ['pending', 'paid', 'refunded'];
  if ((!status && !paymentStatus) || (status && !validStatus.includes(status)) || (paymentStatus && !validPayment.includes(paymentStatus))) {
    return response.status(400).json({ error: 'Trạng thái đơn hàng hoặc thanh toán không hợp lệ.' });
  }
  try {
    // Only employee updates enter the daily employee report; Admin changes do not.
    const updateSql = request.user.role === 'employee'
      ? `UPDATE orders SET status = CASE WHEN $2 = 'paid' THEN 'paid' ELSE COALESCE($1, status) END,
           payment_status = COALESCE($2, payment_status), processed_by = $3, processed_by_name = $4, processed_at = NOW()
         WHERE id = $5 RETURNING id, invoice_number, status, payment_status, total, created_at`
      : `UPDATE orders SET status = CASE WHEN $2 = 'paid' THEN 'paid' ELSE COALESCE($1, status) END,
           payment_status = COALESCE($2, payment_status)
         WHERE id = $3 RETURNING id, invoice_number, status, payment_status, total, created_at`;
    const values = request.user.role === 'employee'
      ? [status || null, paymentStatus || null, request.user.user_id, request.user.display_name, request.params.id]
      : [status || null, paymentStatus || null, request.params.id];
    const result = await pool.query(updateSql, values);
    if (!result.rowCount) return response.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    response.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.get('/api/health', async (_request, response) => {
  try {
    const database = await checkDatabaseConnection();
    response.json({ status: 'ok', database: 'connected', databaseTime: database.database_time });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    response.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use((error, _request, response, _next) => {
  console.error('API error:', error.message);
  response.status(error.status || 500).json({ error: error.status ? error.message : 'Lỗi máy chủ.' });
});

const server = app.listen(port, () => console.log(`SmartBilling API listening on http://localhost:${port}`));
async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => { await pool.end(); process.exit(0); });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
