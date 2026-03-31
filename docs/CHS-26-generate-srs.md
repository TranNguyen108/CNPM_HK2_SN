# CHS-26 — Generate SRS (Software Requirements Specification)

## Tổng quan

Tính năng cho phép **Leader** nhóm tạo tài liệu SRS dạng `.docx` trực tiếp từ dữ liệu tasks đã được sync từ Jira, không cần nhập tay, không cần backend riêng.

---

## Luồng sử dụng (3 bước)

```
Bước 1: Chọn nhóm
    ↓
Bước 2: Chọn Sprint / Epic cần đưa vào SRS
    ↓
Bước 3: Nhập thông tin dự án → Preview → Generate Word
```

---

## Các màn hình

### Bước 1 — Chọn nhóm

- Dropdown danh sách nhóm lấy từ `GET /api/my-groups`
- Sau khi chọn, hiển thị số lượng tasks đã sync của nhóm đó
- Dữ liệu tasks tải trước từ `GET /api/sync/tasks/:groupId` (dùng React Query, cache `staleTime` mặc định)

### Bước 2 — Chọn Sprint / Epic

- Danh sách sprint lấy từ `GET /api/sprints/:groupId`
- Mỗi sprint hiển thị dạng card với số lượng task
- Checkbox chọn từng sprint hoặc "Chọn tất cả"
- Alert xanh hiển thị:  
  `Đã chọn X sprint — Y requirements sẽ được đưa vào SRS`

### Bước 3 — Thông tin & Preview

**Form (bắt buộc):**

| Trường | Bắt buộc | Ví dụ |
|---|---|---|
| Tên dự án | ✅ | Hệ thống quản lý dự án SWP391 |
| Phiên bản | ✅ | 1.0.0 |
| Tác giả / Tên nhóm | ✅ | Nhóm 5 - SE1234 |
| Mô tả ngắn | ❌ | Mô tả tổng quan về dự án... |

**Stats summary:**
- Số sprints đã chọn
- Tổng số requirements
- Số sections trong tài liệu

**Preview panel (Accordion):**
- Mỗi section = 1 sprint
- Mỗi task hiển thị: `[JIRA-KEY]` + tiêu đề + status tag + priority tag + story points
- Sticky bên phải, cuộn được nếu nhiều task

---

## Cấu trúc tài liệu Word (.docx)

```
Trang bìa
  ├── Tiêu đề: SOFTWARE REQUIREMENTS SPECIFICATION
  ├── Tên dự án, Phiên bản, Tác giả, Ngày tạo

1. Giới thiệu
  ├── 1.1 Mục đích
  ├── 1.2 Phạm vi
  └── 1.3 Ký hiệu và quy ước

2. Tổng quan dự án
  └── Bảng thông tin: tên, phiên bản, tác giả, ngày, mô tả

3. Yêu cầu chức năng
  ├── 3.1 <Sprint 1> (N yêu cầu)
  │     ├── [JIRA-001] Tên task — trạng thái, ưu tiên, người thực hiện, SP
  │     └── ...
  ├── 3.2 <Sprint 2> ...
  └── ...

4. Yêu cầu phi chức năng
  ├── 4.1 Hiệu năng (Performance)
  ├── 4.2 Bảo mật (Security)
  ├── 4.3 Khả năng sử dụng (Usability)
  └── 4.4 Độ tin cậy (Reliability)
```

---

## Generate Word

- Thư viện: [`docx`](https://docx.js.org/) (client-side, không cần backend)
- File xuất: `SRS_<TênDự_Án>_v<Phiên_bản>.docx`
- Toàn bộ build/download xảy ra trong browser

**Progress bar giả:**
1. Bắt đầu: 5%
2. Tăng ngẫu nhiên ~4–14% mỗi 280ms cho tới 88%
3. Khi `buildDocxBlob()` hoàn tất → nhảy lên 100% (màu xanh, trạng thái `success`)
4. Auto reset sau 1.4 giây

---

## API sử dụng

| API | Mô tả |
|---|---|
| `GET /api/my-groups` | Lấy danh sách nhóm của user |
| `GET /api/sprints/:groupId` | Lấy danh sách sprint của nhóm |
| `GET /api/sync/tasks/:groupId` | Lấy toàn bộ tasks đã sync của nhóm |

> Không có API riêng cho SRS — tài liệu được tạo hoàn toàn phía client.

---

## Phân quyền

| Role | Quyền truy cập |
|---|---|
| LEADER | ✅ Truy cập đầy đủ |
| ADMIN | ❌ Không có trong menu (nhưng có thể thêm) |
| LECTURER | ❌ Không truy cập |
| MEMBER | ❌ Không truy cập |

Route: `/srs` — bảo vệ bởi `ProtectedRoute allowedRoles={['LEADER']}`

---

## File liên quan

| File | Mô tả |
|---|---|
| `frontend/src/pages/leader/GenerateSRS.jsx` | Component chính |
| `frontend/src/App.jsx` | Route `/srs` |
| `frontend/src/layouts/AdminLayout.jsx` | Menu item "Generate SRS" |
| `frontend/src/api/tasksApi.js` | `tasksApi.getMyGroups`, `tasksApi.getSprints`, `syncApi.getGroupTasks` |

---

## Các trạng thái xử lý

| Trạng thái | Hiển thị |
|---|---|
| Đang tải nhóm | `<Spin>` trong bước 1 |
| Đang tải tasks / sprint | `loading` prop trên nút Tiếp theo |
| Nhóm chưa có sprint | `<Empty>` với hướng dẫn sync Jira |
| Không có requirement nào | Nút "Generate Word" bị disable, warning toast |
| Đang generate | Progress bar + loading state trên nút |
| Thành công | Toast "Tải xuống file SRS thành công!" |
| Thất bại | Toast lỗi kèm message chi tiết |
