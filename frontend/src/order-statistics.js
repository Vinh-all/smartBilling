// Daily employee order statistics UI. Data is loaded only from the Admin-only API.
(function attachOrderStatistics(window) {
  const timezone = 'Asia/Ho_Chi_Minh';
  let selectedDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);

  const money = (value) => new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(Number(value) || 0);

  function view() {
    return `<section class="daily-order-report">
      <div class="heading-row">
        <div class="title-group"><h1>Thống kê đơn hàng theo ngày</h1><p>Đơn hàng được nhân viên xử lý trong ngày đã chọn</p></div>
        <div class="daily-date-controls">
          <button type="button" class="soft-btn" id="stats-previous-day" aria-label="Ngày trước">‹</button>
          <input id="order-stats-date" type="date" value="${selectedDate}" aria-label="Chọn ngày thống kê">
          <button type="button" class="soft-btn" id="stats-next-day" aria-label="Ngày sau">›</button>
          <button type="button" class="refresh-btn" id="stats-refresh" title="Làm mới thống kê">↻</button>
        </div>
      </div>
      <p class="report-timezone">Múi giờ báo cáo: ${timezone}</p>
      <div id="order-stats-content"><div class="empty-state">Đang tải thống kê...</div></div>
    </section>`;
  }

  function renderReport(report) {
    const root = document.querySelector('#order-stats-content');
    if (!root) return;
    const summary = report.summary || {};
    const employeeRows = (report.employees || []).map((employee) => `<tr>
      <td>${escapeHtml(employee.employee_name)}</td><td>${employee.total_orders}</td>
      <td>${money(employee.total_amount)}</td><td>${employee.paid_orders}</td>
    </tr>`).join('') || '<tr><td colspan="4">Ngày này chưa có nhân viên xử lý đơn.</td></tr>';
    const orderRows = (report.orders || []).map((order) => `<tr>
      <td>${escapeHtml(order.invoice_number)}</td><td>${escapeHtml(order.customer_name)}</td>
      <td>${escapeHtml(order.processed_by_name)}</td><td>${money(order.total)}</td>
      <td>${escapeHtml(order.payment_status)}</td><td>${new Date(order.processed_at).toLocaleString('vi-VN', { timeZone: report.timezone })}</td>
    </tr>`).join('') || '<tr><td colspan="6">Không có đơn hàng trong ngày đã chọn.</td></tr>';

    root.innerHTML = `<div class="daily-stat-grid">
      <article class="daily-stat-card"><span>Tổng đơn</span><strong>${summary.total_orders || 0}</strong></article>
      <article class="daily-stat-card"><span>Tổng giá trị đơn</span><strong>${money(summary.total_amount)}</strong></article>
      <article class="daily-stat-card"><span>Đã thanh toán</span><strong>${summary.paid_orders || 0}</strong><small>${money(summary.paid_amount)}</small></article>
      <article class="daily-stat-card"><span>Chờ thanh toán</span><strong>${summary.pending_orders || 0}</strong></article>
    </div>
    <section class="panel table-panel"><div class="panel-head"><h3>Hiệu suất theo nhân viên</h3></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Nhân viên</th><th>Số đơn</th><th>Tổng giá trị</th><th>Đã thanh toán</th></tr></thead><tbody>${employeeRows}</tbody></table></div>
    </section>
    <section class="panel table-panel"><div class="panel-head"><h3>Đơn hàng đã xử lý</h3></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Mã hóa đơn</th><th>Khách hàng</th><th>Nhân viên</th><th>Tổng tiền</th><th>Thanh toán</th><th>Thời gian xử lý</th></tr></thead><tbody>${orderRows}</tbody></table></div>
    </section>`;
  }

  async function load(apiRequest) {
    const root = document.querySelector('#order-stats-content');
    if (!root) return;
    root.innerHTML = '<div class="empty-state">Đang tải thống kê...</div>';
    try {
      const report = await apiRequest(`/admin/statistics/orders/daily?date=${encodeURIComponent(selectedDate)}`);
      renderReport(report);
    } catch (error) {
      root.innerHTML = `<div class="empty-state report-error">${escapeHtml(error.message || 'Không tải được thống kê.')}</div>`;
    }
  }

  function changeDate(value, offset = 0) {
    let date = value || selectedDate;
    if (offset) {
      const parsed = new Date(`${date}T12:00:00`);
      parsed.setDate(parsed.getDate() + offset);
      date = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(parsed);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return selectedDate;
    selectedDate = date;
    const input = document.querySelector('#order-stats-date');
    if (input) input.value = selectedDate;
    return selectedDate;
  }

  window.OrderStatistics = { view, load, changeDate };
})(window);
