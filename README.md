## Thông tin sinh viên

- Họ và tên: Lý A Vinh
- Mã sinh viên:DTC245200194
- GitHub:Vinh-all
- Dự án: SmartBilling


 1. Giới thiệu

**SmartBilling** là hệ thống quản lý bán hàng và hóa đơn, hỗ trợ quản lý tài khoản, sản phẩm, danh mục, tồn kho, đơn hàng, thanh toán và báo cáo.

Hệ thống được phát triển với kiến trúc Backend – Frontend – Database:

- **Backend:** Node.js + Express.js
- **Frontend:** JavaScript thuần, HTML, CSS
- **Database:** PostgreSQL
- **Container:** Docker / Docker Compose
- **Web Server / Reverse Proxy:** Nginx
- **Monitoring:** Prometheus
- **Quản lý mã nguồn:** Git / GitHub
- **Môi trường phát triển:** Windows
- **Môi trường triển khai:** Ubuntu Linux

Mã nguồn được phát triển trên Windows, quản lý phiên bản bằng Git và lưu trữ trên GitHub. Sau đó mã nguồn được triển khai trên máy chủ Ubuntu Linux để chạy hệ thống thực tế.

---

## 2. Kiến trúc hệ thống

```text
                         ┌─────────────────────┐
                         │      Người dùng      │
                         │ Admin / Nhân viên    │
                         │     / Khách hàng     │
                         └──────────┬──────────┘
                                    │
                                    │ HTTP/HTTPS
                                    ▼
                         ┌─────────────────────┐
                         │        Nginx        │
                         │  Web Server / Proxy  │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
          ┌─────────────────┐             ┌─────────────────┐
          │    Frontend     │             │     Backend     │
          │ JavaScript/HTML │             │ Node.js/Express │
          └─────────────────┘             └────────┬────────┘
                                                   │
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │   PostgreSQL    │
                                          │    Database     │
                                          └─────────────────┘

                         ┌─────────────────────┐
                         │     Prometheus      │
                         │      Monitoring     │
                         └─────────────────────┘
```

---

## 3. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Container | Docker |
| Container Management | Docker Compose |
| Web Server | Nginx |
| Monitoring | Prometheus |
| Version Control | Git |
| Source Repository | GitHub |
| Development OS | Windows |
| Deployment OS | Ubuntu Linux |

---

## 4. Các vai trò trong hệ thống

### Admin

Admin có quyền:

- Quản lý tài khoản
- Quản lý nhân viên
- Quản lý danh mục
- Quản lý sản phẩm
- Quản lý tồn kho
- Xem báo cáo
- Quản lý và xử lý các yêu cầu liên quan đến hệ thống

### Nhân viên

Nhân viên có thể:

- Đăng nhập hệ thống
- Xem và xử lý đơn hàng
- Xác nhận thanh toán tại quầy
- Quản lý các nghiệp vụ bán hàng được phân quyền

### Khách hàng

Khách hàng có thể:

- Đăng ký tài khoản
- Đăng nhập
- Xem sản phẩm
- Đặt hàng
- Theo dõi đơn hàng
- Thực hiện các chức năng dành cho khách hàng

---

## 5. Cấu trúc thư mục

```text
SmartBilling/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── modules/
│   │   └── server.js
│   │
│   ├── .env
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app.js
│   │   └── order-statistics.js
│   │
│   ├── build.mjs
│   ├── index.html
│   └── package.json
│
├── database/
│   └── README.md
│
├── nginx/
│   └── nginx.conf
│
├── prometheus/
│   └── prometheus.yml
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

> Cấu trúc trên cần được điều chỉnh theo đúng các thư mục thực tế đang có trong repository.

---

## 6. Backend

Backend được xây dựng bằng **Node.js và Express.js**.

File khởi tạo chính:

```text
backend/src/server.js
```

Backend chịu trách nhiệm:

- Xác thực người dùng
- Phân quyền
- Quản lý tài khoản
- Quản lý sản phẩm
- Quản lý danh mục
- Quản lý tồn kho
- Quản lý đơn hàng
- Xử lý thanh toán
- Thông báo
- Hỗ trợ khách hàng
- Cung cấp REST API cho frontend

Các chức năng được tổ chức thành các module/router trong:

```text
backend/src/modules/
```

---

## 7. Database

Hệ thống sử dụng **PostgreSQL**.

Cấu hình kết nối database được thực hiện trong:

```text
backend/src/config/database.js
```

Ứng dụng hỗ trợ cấu hình thông qua:

```env
DATABASE_URL=
```

hoặc các biến:

```env
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
```

### Lưu ý bảo mật

Không đưa thông tin database thật, mật khẩu hoặc secret lên GitHub.

Sử dụng:

```text
.env
```

để lưu thông tin môi trường thực tế và:

```text
.env.example
```

để cung cấp mẫu cấu hình.

---

## 8. Frontend

Frontend được xây dựng bằng JavaScript thuần.

File chính:

```text
frontend/src/app.js
```

Frontend chịu trách nhiệm:

- Hiển thị giao diện
- Đăng nhập / đăng ký
- Hiển thị sản phẩm
- Quản lý đơn hàng
- Hiển thị chức năng theo vai trò
- Giao tiếp với Backend API

Chức năng báo cáo đơn hàng được thực hiện tại:

```text
frontend/src/order-statistics.js
```

---

## 9. Build Frontend

File:

```text
frontend/build.mjs
```

được sử dụng để đóng gói frontend.

Quá trình build tạo thư mục:

```text
frontend/dist/
```

và cập nhật:

```text
frontend/index.html
```

---

## 10. Chạy hệ thống trên môi trường Development

### Backend

Di chuyển vào thư mục backend:

```bash
cd backend
```

Cài đặt dependencies:

```bash
npm install
```

Cấu hình file:

```text
backend/.env
```

Sau đó chạy:

```bash
npm run dev
```

Backend mặc định chạy tại:

```text
http://localhost:3000
```

### Frontend

Mở terminal khác:

```bash
cd frontend
npm install
```

Chạy frontend:

```bash
npm start
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

---

## 11. Triển khai trên Ubuntu Linux

Quy trình triển khai:

```text
Windows Development
        │
        │ Git commit
        ▼
      GitHub
        │
        │ git clone / git pull
        ▼
   Ubuntu Linux Server
        │
        ├── Docker
        ├── PostgreSQL
        ├── Backend
        ├── Frontend
        ├── Nginx
        └── Prometheus
```

### Clone repository

Trên Ubuntu:

```bash
git clone <GITHUB_REPOSITORY_URL>
cd SmartBilling
```

Ví dụ:

```bash
git clone https://github.com/<USERNAME>/smartBilling.git
cd smartBilling
```

---

## 12. Triển khai bằng Docker Compose

Nếu repository có file:

```text
docker-compose.yml
```

có thể khởi động hệ thống bằng:

```bash
docker compose up -d
```

Kiểm tra container:

```bash
docker compose ps
```

Xem log:

```bash
docker compose logs
```

Xem log của từng service:

```bash
docker compose logs <service-name>
```

Dừng hệ thống:

```bash
docker compose down
```

Build lại image:

```bash
docker compose up -d --build
```

> Nếu `docker-compose.yml` chưa được đưa lên repository hoặc đang được thay đổi, cần cập nhật README theo cấu hình Docker thực tế trước khi triển khai.

---

## 13. Cấu hình Nginx

Nginx được sử dụng làm Web Server và Reverse Proxy.

File cấu hình:

```text
nginx/nginx.conf
```

Luồng request:

```text
Client
   │
   ▼
Nginx
   │
   ├── Frontend
   │
   └── Backend API
```

Kiểm tra cấu hình Nginx:

```bash
sudo nginx -t
```

Khởi động lại:

```bash
sudo systemctl restart nginx
```

Kiểm tra trạng thái:

```bash
sudo systemctl status nginx
```

---

## 14. Monitoring với Prometheus

Prometheus được sử dụng để theo dõi và thu thập metrics của hệ thống.

File cấu hình:

```text
prometheus/prometheus.yml
```

Kiểm tra Prometheus:

```bash
docker compose ps
```

Xem log:

```bash
docker compose logs prometheus
```

Nếu Prometheus được cấu hình sử dụng cổng mặc định:

```text
http://<SERVER_IP>:9090
```

---

## 15. Cập nhật hệ thống

Sau khi thay đổi mã nguồn trên Windows:

```bash
git status
git add .
git commit -m "Update <chuc-nang>"
git push origin main
```

Trên Ubuntu:

```bash
git pull origin main
```

Nếu sử dụng Docker:

```bash
docker compose up -d --build
```

Kiểm tra lại:

```bash
docker compose ps
```

---

## 16. Quy ước Commit

Commit phải mô tả rõ nội dung thay đổi.

Ví dụ:

```text
Initial SmartBilling project
Add backend authentication
Add product management
Add order management
Add inventory management
Add PostgreSQL configuration
Add Docker Compose configuration
Add Nginx configuration
Add Prometheus monitoring
Update frontend order statistics
Fix authentication API
Update README documentation
```

Không sử dụng commit không rõ nội dung như:

```text
test
abc
update
fix
```

---

## 17. Git Workflow

Quy trình quản lý mã nguồn:

```text
Code trên Windows
       │
       ▼
git status
       │
       ▼
git add .
       │
       ▼
git commit -m "Mô tả thay đổi"
       │
       ▼
git push
       │
       ▼
GitHub
       │
       ▼
Ubuntu Linux
       │
       ▼
git pull
       │
       ▼
Deploy / Restart
```

---

## 18. Bảo mật

Không commit các thông tin nhạy cảm lên GitHub.

Các thông tin không được đưa lên repository:

- Database password
- API key
- Access token
- Secret key
- Thông tin đăng nhập máy chủ
- File `.env` chứa thông tin thực tế

Ví dụ `.gitignore`:

```gitignore
.env
node_modules/
*.log
dist/
```

Tùy yêu cầu triển khai, có thể điều chỉnh `.gitignore` để không loại bỏ các file build cần thiết cho production.

---

## 19. Kiểm tra hệ thống sau triển khai

### Kiểm tra Docker

```bash
docker ps
```

### Kiểm tra Nginx

```bash
sudo systemctl status nginx
```

### Kiểm tra PostgreSQL

```bash
docker compose ps
```

### Kiểm tra log Backend

```bash
docker compose logs backend
```

### Kiểm tra website

```text
https://172.172.1.244:8443
```

### Kiểm tra Prometheus

```text
https://172.172.1.244:9090
```

---

## 20. Repository

Source code được quản lý tập trung trên GitHub:

```text
https://github.com/<GITHUB_USERNAME>/<REPOSITORY>](https://github.com/Vinh-all/smartBilling.git
```

GitHub Repository bao gồm:

- Backend source code
- Frontend source code
- Database configuration
- Docker configuration
- Nginx configuration
- Prometheus configuration
- README documentation

---
The End
