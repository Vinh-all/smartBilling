const express = require('express');

const MANAGED_ROLES = new Set(['employee', 'customer']);

function createUserManagementRouter({ pool, authenticate, allowRoles, superAdminUsername }) {
  const router = express.Router();
  router.use(authenticate, allowRoles('admin'));

  // Search and role filters are optional; results never include password hashes.
  router.get('/', async (request, response, next) => {
    const search = String(request.query.search || '').trim().slice(0, 100);
    const role = String(request.query.role || '').trim();
    if (role && role !== 'all' && !['admin', ...MANAGED_ROLES].includes(role)) {
      return response.status(400).json({ error: 'Bộ lọc vai trò không hợp lệ.' });
    }
    try {
      const result = await pool.query(
        `SELECT id, display_name, username, email, role, created_at
         FROM users
         WHERE ($1 = '' OR display_name ILIKE '%' || $1 || '%' OR username ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
           AND ($2 = '' OR $2 = 'all' OR role = $2)
         ORDER BY CASE WHEN username = $3 THEN 0 ELSE 1 END, created_at DESC`,
        [search, role, superAdminUsername],
      );
      response.json(result.rows);
    } catch (error) { next(error); }
  });

  router.patch('/:id/role', async (request, response, next) => {
    const { role } = request.body || {};
    if (!MANAGED_ROLES.has(role)) {
      return response.status(403).json({ error: 'Admin cố định; chỉ có thể gán vai trò Nhân viên hoặc Khách hàng.' });
    }
    if (String(request.user.user_id) === String(request.params.id)) {
      return response.status(400).json({ error: 'Không thể tự đổi vai trò tài khoản đang đăng nhập.' });
    }
    try {
      const account = await pool.query('SELECT username FROM users WHERE id = $1', [request.params.id]);
      if (!account.rowCount) return response.status(404).json({ error: 'Không tìm thấy tài khoản.' });
      if (account.rows[0].username === superAdminUsername) {
        return response.status(403).json({ error: 'Tài khoản Admin cố định không thể đổi vai trò.' });
      }
      const result = await pool.query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, display_name, username, email, role, created_at',
        [role, request.params.id],
      );
      response.json(result.rows[0]);
    } catch (error) { next(error); }
  });

  router.delete('/:id', async (request, response, next) => {
    if (String(request.user.user_id) === String(request.params.id)) {
      return response.status(400).json({ error: 'Không thể tự xóa tài khoản đang đăng nhập.' });
    }
    try {
      const account = await pool.query('SELECT username FROM users WHERE id = $1', [request.params.id]);
      if (!account.rowCount) return response.status(404).json({ error: 'Không tìm thấy tài khoản.' });
      if (account.rows[0].username === superAdminUsername) {
        return response.status(403).json({ error: 'Tài khoản Admin cố định không thể bị xóa.' });
      }
      await pool.query('DELETE FROM users WHERE id = $1', [request.params.id]);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createUserManagementRouter };
