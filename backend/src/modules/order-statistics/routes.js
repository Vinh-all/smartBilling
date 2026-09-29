const express = require('express');

// Validate ISO calendar dates before they reach PostgreSQL.
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function createOrderStatisticsRouter({ pool, authenticate, allowRoles, timezone }) {
  const router = express.Router();
  router.use(authenticate, allowRoles('admin'));

  // Report orders last processed by an employee during one local calendar day.
  router.get('/daily', async (request, response, next) => {
    const date = String(request.query.date || '');
    if (!isValidDate(date)) {
      return response.status(400).json({ error: 'Ngày cần có định dạng YYYY-MM-DD.' });
    }

    try {
      const summaryResult = await pool.query(
        `SELECT COUNT(*)::integer AS total_orders,
           COALESCE(SUM(total), 0)::numeric(14, 2) AS total_amount,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::integer AS paid_orders,
           COUNT(*) FILTER (WHERE payment_status = 'pending')::integer AS pending_orders,
           COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0)::numeric(14, 2) AS paid_amount
         FROM orders
         WHERE processed_by_name IS NOT NULL
           AND processed_at >= ($1::date::timestamp AT TIME ZONE $2::text)
           AND processed_at < (($1::date + 1)::timestamp AT TIME ZONE $2::text)`,
        [date, timezone],
      );

      const employeesResult = await pool.query(
        `SELECT COALESCE(processed_by_name, 'Nhân viên') AS employee_name,
           COUNT(*)::integer AS total_orders,
           COALESCE(SUM(total), 0)::numeric(14, 2) AS total_amount,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::integer AS paid_orders
         FROM orders
         WHERE processed_by_name IS NOT NULL
           AND processed_at >= ($1::date::timestamp AT TIME ZONE $2::text)
           AND processed_at < (($1::date + 1)::timestamp AT TIME ZONE $2::text)
         GROUP BY COALESCE(processed_by_name, 'Nhân viên')
         ORDER BY total_orders DESC, employee_name ASC`,
        [date, timezone],
      );

      const ordersResult = await pool.query(
        `SELECT o.id, o.invoice_number, o.status, o.payment_status, o.total, o.processed_by_name,
           o.processed_at, COALESCE(u.display_name, 'Khách hàng') AS customer_name
         FROM orders o LEFT JOIN users u ON u.id = o.customer_id
         WHERE o.processed_by_name IS NOT NULL
           AND o.processed_at >= ($1::date::timestamp AT TIME ZONE $2::text)
           AND o.processed_at < (($1::date + 1)::timestamp AT TIME ZONE $2::text)
         ORDER BY o.processed_at DESC, o.id DESC
         LIMIT 500`,
        [date, timezone],
      );

      response.json({
        date,
        timezone,
        summary: summaryResult.rows[0],
        employees: employeesResult.rows,
        orders: ordersResult.rows,
      });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createOrderStatisticsRouter };
