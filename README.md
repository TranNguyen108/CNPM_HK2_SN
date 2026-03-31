# Công cụ Hỗ trợ Quản lý Yêu cầu & Tiến độ Dự án Phần mềm
Supporting Tool for Requirements and Project Progress Management — SWP391
@2025

## Quy tắc

### 1. Ngôn ngữ & Công nghệ
- Commit message, branch name, PR title: **Tiếng Anh**
- Tài liệu nội bộ, comment, báo cáo: **Tiếng Việt**
---

**Frontend** - React + Vite + Ant Design + RechartsB
**Backend** Node.js + Express 
**Database** MySQLA
---

### 2. Quy tắc Commit

- **Định dạng:** `type(CNPM-<số_issue>): commit message`
- **Các loại type:**
  - `feat`: Thêm tính năng mới
  - `fix`: Sửa lỗi
  - `chore`: Cấu hình, build, bảo trì
  - `docs`: Cập nhật tài liệu
  - `refactor`: Tái cấu trúc code (không thêm tính năng, không sửa lỗi)
  - `test`: Thêm hoặc cập nhật test
- **Ví dụ:**
  - `feat(CNPM-12): add JWT authentication for login`
  - `fix(CNPM-15): correct task status update response`
  - `docs(CNPM-3): update SRS requirement specification`
  - `refactor(CNPM-20): restructure commit statistics service`

---

### 3. Quy tắc Branch

- **Tuyệt đối không** commit/push trực tiếp lên `main` 
- **Định dạng:** `type/CNPM-<số_issue>/branch-name`
- **Các loại type:**
  - `feature/` – Phát triển tính năng mới
  - `bugfix/` – Sửa lỗi thông thường
  - `hotfix/` – Sửa lỗi khẩn cấp trên production
  - `chore/` – Cấu hình, bảo trì hệ thống
- **Ví dụ:**
  - `feature/CNPM-12/login-api`
  - `feature/CNPM-25/export-srs-document`
  - `bugfix/CNPM-30/fix-commit-statistics`
  - `hotfix/CNPM-33/critical-jira-sync-error`

---

### 4. Quy trình Làm việc

1. Tạo branch mới từ `develop` theo đúng định dạng đặt tên.
2. Thực hiện thay đổi và commit theo đúng quy tắc commit.
3. Khi hoàn thành, tạo **Pull Request (PR)** để merge vào `develop`.
4. **Team Leader / Reviewer** review PR:
   - Nếu approved → merge vào `develop`.
   - Nếu cần chỉnh sửa → reviewer để lại comment, member sửa và push lại.
5. Để **release / deployment**:
   - Tạo PR từ `develop` → `main`.
   - Chỉ **Team Leader** mới được merge vào `main`.

---

### 6. Lưu ý bổ sung

- Kiểm tra kỹ code trước khi push.
- Mỗi PR chỉ tập trung vào **một tính năng hoặc một bug** để dễ review.
- Trạng thái Jira issue phải được cập nhật **tương ứng** với tiến độ code thực tế.

---

## Backend Production Deployment

### 1. Mục tiêu

Backend đã được chuẩn bị để deploy lên **Railway** hoặc **Render** với các yêu cầu production cơ bản:
- Hỗ trợ `DATABASE_URL`
- Hỗ trợ SSL cho cloud database
- CORS chỉ cho phép frontend domain
- Không dùng AES secret mặc định trong production
- Có health check endpoint: `GET /health`

### 2. Environment Variables cần cấu hình

Tham khảo file `backend/.env.example`.

- `PORT=3000`
- `NODE_ENV=production`
- `DATABASE_URL=...`
- `DB_DIALECT=mysql`
- `DB_SSL=true`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=1d`
- `JWT_REFRESH_SECRET=...`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `AES_KEY=...`
- `CORS_ORIGIN=https://your-frontend.vercel.app`

Ghi chú:
- Nếu không dùng `DATABASE_URL`, backend vẫn hỗ trợ bộ biến `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- Không commit secret thật lên GitHub.

### 3. Checklist deploy trên Railway/Render

1. Tạo service database MySQL hoặc PostgreSQL trên Railway/Render.
2. Tạo web service mới từ GitHub repo.
3. Chọn Root Directory là `backend`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Thêm toàn bộ Environment Variables ở mục trên.
7. Cấu hình `CORS_ORIGIN` bằng đúng URL frontend trên Vercel.
8. Sau khi deploy xong, kiểm tra:
   - `GET /`
   - `GET /health`
   - các API auth
   - các API tasks, stats, sync, notification

### 4. Auto deploy

- Railway/Render đều có thể bật auto deploy khi có push mới lên `main`.
- Khuyến nghị:
  - merge code vào `main`
  - để platform tự redeploy
  - theo dõi log boot để chắc chắn bước connect DB và schema sync thành công

### 5. Production URL

- Backend production URL: `TODO`
- Frontend production URL: `TODO`

### 6. Acceptance mapping

- `Backend có URL public, gọi được từ Postman`
  - sau deploy sẽ dùng domain Railway/Render
- `Database migrate thành công trên production`
  - app tự `connectDB`, `ensureSchema`, và `sync` khi boot
- `Không có secret key nào commit lên GitHub`
  - dùng env vars, không commit secret thật
- `CORS không block frontend Vercel`
  - backend đã đọc `CORS_ORIGIN` để whitelist domain frontend

