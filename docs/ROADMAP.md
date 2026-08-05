# LỘ TRÌNH DỰ ÁN ORDERMASTER — Bản đồ bàn giao

Phiên bản: React 18 + Vite + TypeScript + Tailwind | Backend: Lovable Cloud (Postgres + Auth + Realtime + Edge Functions) | Không dùng Docker

File này viết cho bất kỳ agent/dev nào tiếp tục dự án. Đọc theo đúng thứ tự bên dưới **trước khi code bất kỳ dòng nào**.

Dự án chia làm **2 hệ thống con**:

| Mã | Tên | Phạm vi |
|---|---|---|
| **OD** | Order & Vận hành nhà hàng | Toàn bộ tính năng: tài khoản, nhà hàng, bàn, menu, đặt món, bếp, hóa đơn, báo cáo, realtime |
| **DL** | Công thức & Định lượng | Chỉ tính năng công thức/định lượng nguyên vật liệu + xuất/nhập Excel |

---

## 0. Thứ tự đọc bắt buộc trước khi code

1. **`docs/ROADMAP.md`** (file này) — trạng thái hiện tại + lộ trình + quy ước.
2. **`docs/DATABASE.md`** — mô tả toàn bộ bảng/cột/enum bằng tiếng Việt.
3. **`supabase/schema.sql`** — snapshot schema gộp để tra nhanh.
4. **`supabase/migrations/*.sql`** — schema "thật", đọc theo thứ tự thời gian.
5. **`src/contexts/AuthContext.tsx` + `src/components/ProtectedRoute.tsx`** — cơ chế phân quyền phía client.
6. **Báo cáo phiên gần nhất** trong `docs/work_reports/` — biết chính xác code đang ở đâu.

---

## 1. Nguyên lý kiến trúc (KHÔNG thay đổi nếu không có lý do chính đáng)

### 1.1 Multi-tenant
- Mỗi **nhà hàng = 1 tenant**, cô lập bằng cột `restaurant_id`.
- **MỌI** truy vấn phải bị RLS chặn theo `restaurant_id`. Không tin client.
- Không bao giờ lọc tenant chỉ ở tầng React — luôn có policy tương ứng ở DB.

### 1.2 Phân quyền
- 5 vai trò: `superadmin > admin > manager > staff / chef`.
- Role lưu ở `profiles.role` (enum `app_role`), **không lưu ở localStorage**.
- Kiểm tra quyền trong policy qua các security-definer function: `get_user_role()`, `get_user_restaurant()`, `has_role()`, `can_access_recipes()`.
- Client chỉ **điều hướng** theo role (`ProtectedRoute`), không coi đó là bảo mật.

### 1.3 Quy ước đặt tên module
```text
<HỆ THỐNG><NHÓM>_<SỐ>   ví dụ: ODA3_0100, DLA1_0100
```
- `OD` / `DL` = hệ thống con.
- `A1..An` = nhóm chức năng (xem mục 3).
- `_0100` = chức năng trong nhóm, bước 100.

### 1.4 Kết cấu file cho MỖI chức năng
```text
src/pages/<role>/<Tên>Page.tsx        → chỉ layout + chọn tenant + gọi component
src/components/<domain>/<Tên>.tsx     → UI + state của chức năng
src/hooks/use<Tên>.ts                 → data-fetch, realtime, optimistic update
src/lib/<tên>.ts                      → logic thuần (tính toán, export, format)
supabase/migrations/*.sql             → bảng + GRANT + RLS + policy
supabase/functions/<tên>/index.ts     → chỉ khi cần service-role (quản lý user)
```
Quy tắc:
- **Không** gọi `supabase` trực tiếp trong file `pages/*` — đẩy xuống hook hoặc component domain.
- **Không** viết logic tính toán trong component — đẩy vào `src/lib/`.
- Màu sắc/khoảng cách chỉ dùng semantic token trong `src/index.css`, không hardcode `text-white`, `bg-[#...]`.
- Realtime luôn kèm **polling fallback** + snapshot-diff để phát âm thanh (xem `src/lib/realtimeAlerts.ts`).

---

## 2. Đã hoàn thành

| Hạng mục | Mã | Trạng thái |
|---|---|---|
| Auth + Profile + 5 role + RLS đa tenant | OD/A1 | Hoàn thành |
| Superadmin: quản lý/duyệt/tạo Admin, reset mật khẩu | OD/A2 | Hoàn thành |
| Admin: nhà hàng, bàn, menu, nhân viên | OD/A3 | Hoàn thành |
| Manager: menu, bàn, nhân viên, hóa đơn | OD/A4 | Hoàn thành |
| Staff: đặt món (dialog, sticky footer) | OD/A5 | Hoàn thành |
| Chef: màn bếp 3 cột FIFO, undo có xác nhận | OD/A6 | Hoàn thành |
| Thanh toán + in bill K80 + cảnh báo món `new` | OD/A7 | Hoàn thành |
| Báo cáo doanh thu + export PDF/Excel | OD/A8 | Hoàn thành |
| Realtime + polling fallback + chuông + âm thanh | OD/A9 | Hoàn thành |
| Công thức & Định lượng (CRUD, tính toán, Excel in/out) | DL/A1 | Hoàn thành |

### Hạ tầng dùng chung (ZZ)
- `src/lib/realtimeAlerts.ts` — Web Audio API, unlock audio khi user tương tác, tone riêng cho món mới / đổi trạng thái.
- `src/contexts/NotificationContext.tsx` + `src/components/NotificationBell.tsx` — danh sách thông báo + badge, dùng ở mọi layout.
- `src/components/restaurant/RestaurantRealtimeNotifier.tsx` — listener toàn app cấp nhà hàng.
- `src/lib/searchUtils.ts` — tìm kiếm tiếng Việt không phân biệt dấu (**bắt buộc dùng cho mọi ô tìm kiếm**).
- `src/lib/exportRevenue{PDF,Excel}.ts`, `src/lib/recipeExcel.ts`, `src/lib/printReceipt.ts`.
- Edge functions: `admin-create-user`, `admin-reset-password`, `admin-reset-all-passwords`, `setup-superadmins`.
- Storage bucket: `avatars`, `menu-images`.

---

## 3. Bản đồ hệ thống con

```text
OD  Order & Vận hành nhà hàng
  OD/A1  Tài khoản & Phân quyền                     [HOÀN THÀNH]
    ├─ ODA1_0100  Đăng nhập / phiên đăng nhập
    ├─ ODA1_0200  Hồ sơ cá nhân + đổi mật khẩu
    └─ ODA1_0300  Trạng thái tài khoản (pending/active/locked, lock_until)
  OD/A2  Superadmin                                 [HOÀN THÀNH]
    ├─ ODA2_0100  Quản lý Admin
    ├─ ODA2_0200  Duyệt đăng ký
    ├─ ODA2_0300  Tạo Admin
    └─ ODA2_0400  Impersonation
  OD/A3  Nhà hàng (Admin)                           [HOÀN THÀNH]
    ├─ ODA3_0100  Nhà hàng của tôi
    ├─ ODA3_0200  Bàn ăn
    ├─ ODA3_0300  Menu + ảnh món
    └─ ODA3_0400  Nhân viên
  OD/A4  Manager                                    [HOÀN THÀNH]
  OD/A5  Đặt món (Staff/Manager)                    [HOÀN THÀNH]
  OD/A6  Bếp (Chef)                                 [HOÀN THÀNH]
  OD/A7  Hóa đơn & Thanh toán                       [HOÀN THÀNH]
  OD/A8  Báo cáo doanh thu                          [HOÀN THÀNH]
  OD/A9  Realtime & Thông báo                       [HOÀN THÀNH]
  OD/A10 Kho & Tồn nguyên vật liệu                  (CHƯA LÀM — ƯU TIÊN 2)
  OD/A11 Nhật ký hệ thống (audit log)               (CHƯA LÀM)
  OD/A12 Dashboard tổng quan Admin                  (CHƯA LÀM)

DL  Công thức & Định lượng
  DL/A1  Công thức món                              [HOÀN THÀNH]
    ├─ DLA1_0100  CRUD công thức + nguyên liệu (định mức + ĐVT)
    ├─ DLA1_0200  Nhập số lượng → tự tính tổng NVL
    ├─ DLA1_0300  Xuất Excel toàn bộ định lượng
    └─ DLA1_0400  Import Excel → chọn món → Duyệt
  DL/A2  Gộp NVL nhiều món (phiếu chuẩn bị bếp)     (CHƯA LÀM — ƯU TIÊN 1)
  DL/A3  Liên kết công thức ↔ menu_items            (CHƯA LÀM)
  DL/A4  Giá thành & Food cost theo công thức       (CHƯA LÀM)
  DL/A5  Trừ kho tự động theo món đã bán            (CHƯA LÀM — phụ thuộc OD/A10)
```

Quyền truy cập DL: **chỉ `admin` và `chef`** (đảm bảo bởi `can_access_recipes()`).

---

## 4. Checklist bắt buộc cho MỖI chức năng mới

1. Xác nhận với người yêu cầu: hệ thống (`OD`/`DL`) + nhóm + mã chức năng + role nào được thấy.
2. **Migration**: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY` (đúng thứ tự này, thiếu GRANT là lỗi).
3. Policy luôn ràng buộc `restaurant_id` qua `get_user_restaurant()` / `admin_id = auth.uid()`.
4. Tạo/ sửa file theo đúng kết cấu ở mục 1.4.
5. Thêm route trong `src/App.tsx` bọc `ProtectedRoute allowedRoles={[...]}`.
6. Thêm nav item vào layout của role tương ứng (`AdminLayout`, `ManagerLayout`, `ChefLayout`, `StaffLayout`).
7. Nếu dữ liệu thay đổi theo thời gian thực: bật realtime cho bảng + polling fallback + âm thanh + push vào `NotificationContext`.
8. Ô tìm kiếm dùng `src/lib/searchUtils.ts`.
9. Cập nhật `supabase/schema.sql`, `docs/DATABASE.md` và file này.
10. Viết báo cáo phiên vào `docs/work_reports/report_<YYYY-MM-DD>_session<N>.md`.

---

## 5. Rủi ro / Vấn đề kỹ thuật còn tồn tại

| # | Vấn đề | Ảnh hưởng |
|---|---|---|
| 1 | Chưa có audit log — không truy được ai sửa/xoá món, ai thanh toán | Trung bình |
| 2 | `orders.total` tính ở client khi thanh toán, không có trigger DB xác thực | Cao |
| 3 | Không có transaction: tạo order + order_items là 2 request rời | Trung bình |
| 4 | Polling 2.5s song song realtime → tốn request khi nhiều tab | Thấp |
| 5 | Công thức chưa liên kết `menu_items` (khớp bằng tên món) | Trung bình |
| 6 | Chưa có kiểm tra tồn kho → không chặn bán khi hết NVL | Chờ OD/A10 |
| 7 | Import Excel chưa validate ĐVT theo danh mục chuẩn | Thấp |

---

## 6. Việc cần làm ngay khi agent tiếp theo bắt đầu

1. Đọc mục 0 → 5 của file này, rồi báo cáo phiên gần nhất trong `docs/work_reports/`.
2. Xử lý rủi ro **#2** — thêm trigger/function DB tính `orders.total` từ `order_items` để client không thể gửi số tiền sai.
3. Xử lý rủi ro **#5** — thêm `recipes.menu_item_id` (nullable, FK) và UI gán công thức cho món.
4. **DL/A2** — phiếu chuẩn bị bếp: chọn nhiều món + số lượng → gộp NVL cùng tên/ĐVT → xuất Excel/in.
5. **OD/A10** — Kho & tồn NVL (bảng `inventory_items`, `inventory_transactions`), là tiền đề cho DL/A5.
6. **OD/A11** — audit log (`activity_logs`) cho các hành động: thanh toán, xoá món, sửa menu, thay đổi tài khoản.
7. **OD/A12** — Dashboard tổng quan Admin (doanh thu hôm nay, bàn đang mở, món bán chạy).
8. Cuối cùng: **DL/A4** (food cost) rồi **DL/A5** (trừ kho tự động).
