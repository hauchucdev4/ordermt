# 📊 Tài liệu Database — OrderMaster

> File này mô tả toàn bộ cấu trúc DB của hệ thống bằng tiếng Việt để dễ quản lý và onboarding. Schema "thật" nằm trong `supabase/migrations/*.sql`, bản gộp xem nhanh ở `supabase/schema.sql`.

---

## 1. Tổng quan kiến trúc

```
auth.users (Supabase Auth)
     │
     ▼
 profiles ──────────► restaurants ──┬──► tables ──► orders ──► order_items
 (role, status,        (admin_id)   │                              │
  restaurant_id)                    └──► menu_items ◄──────────────┘
```

- **Multi-tenant**: mỗi nhà hàng cô lập qua `restaurant_id`.
- **Phân quyền 5 cấp**: `superadmin > admin > manager > staff / chef`.
- **RLS**: mọi truy cập đi qua Row Level Security, không có "bypass" từ client.

---

## 2. Enums

| Enum | Giá trị | Dùng ở |
|---|---|---|
| `app_role` | `superadmin`, `admin`, `manager`, `staff`, `chef` | `profiles.role` |
| `profile_status` | `active`, `pending`, `locked` | `profiles.status` |
| `table_status` | `empty`, `occupied` | `tables.status` |
| `order_status` | `open`, `paid` | `orders.status` |
| `order_item_status` | `new`, `preparing`, `done` | `order_items.status` |

---

## 3. Các bảng

### 🧑 `profiles` — Hồ sơ người dùng
Mở rộng `auth.users`. Tự sinh khi user đăng ký qua trigger `handle_new_user`.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid (PK) | = `auth.users.id` |
| `email` | text | |
| `full_name` | text | |
| `phone` | text | |
| `avatar_url` | text | Lưu trong bucket `avatars` |
| `role` | app_role | mặc định `admin` |
| `status` | profile_status | `pending` chờ duyệt, `locked` bị khoá |
| `restaurant_id` | uuid → restaurants | NULL với superadmin/admin chưa gán |
| `lock_until` | timestamptz | Hết hạn thì tự mở khoá |
| `created_at` | timestamptz | |

### 🏪 `restaurants` — Nhà hàng
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid (PK) | |
| `admin_id` | uuid → profiles | Chủ sở hữu |
| `name` | text | |
| `address` | text | |

### 🪑 `tables` — Bàn ăn
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid (PK) | |
| `restaurant_id` | uuid → restaurants | |
| `name` | text | VD: "Bàn 1", "VIP 2" |
| `status` | table_status | `occupied` khi có order `open` |

### 🍜 `menu_items` — Món trong menu
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid (PK) | |
| `restaurant_id` | uuid → restaurants | |
| `name` | text | |
| `category` | text | Mặc định `'Khác'` |
| `price` | numeric | VND |
| `image_url` | text | Bucket `menu-images` |
| `available` | bool | Tắt là ẩn khỏi order |

### 🧾 `orders` — Hoá đơn theo bàn
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid (PK) | |
| `restaurant_id` | uuid → restaurants | |
| `table_id` | uuid → tables | |
| `status` | order_status | `open` đang ăn, `paid` đã thanh toán |
| `total` | numeric | Tổng tiền lúc thanh toán |
| `paid_at` | timestamptz | |

### 🍽 `order_items` — Món trong hoá đơn
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid (PK) | |
| `order_id` | uuid → orders (CASCADE) | |
| `menu_item_id` | uuid → menu_items | |
| `quantity` | int | |
| `status` | order_item_status | `new` → `preparing` → `done` |
| `note` | text | Ghi chú bếp |

---

## 4. Quyền truy cập (RLS) — tóm tắt

| Bảng | Superadmin | Admin (chủ) | Manager | Staff | Chef |
|---|---|---|---|---|---|
| `profiles` | Xem/sửa/xoá tất cả | Quản lý nhân viên nhà hàng mình | Quản lý staff/chef cùng NH | Xem/sửa của mình | Xem/sửa của mình |
| `restaurants` | Xem tất cả | CRUD nhà hàng mình | Xem NH mình | Xem NH mình | Xem NH mình |
| `tables` | Xem tất cả | CRUD bàn | CRUD bàn | Đổi trạng thái | Đổi trạng thái |
| `menu_items` | Xem tất cả | CRUD | CRUD | Xem | Xem |
| `orders` | Xem tất cả | CRUD trong NH mình | Tạo/sửa | Tạo/sửa | Xem/sửa status món |
| `order_items` | Xem tất cả | Mọi quyền | Mọi quyền | Tạo, xoá món `new`, sửa | Sửa status |

> Chi tiết policy đầy đủ trong `supabase/migrations/*.sql`.

---

## 5. Functions hỗ trợ

| Hàm | Mục đích |
|---|---|
| `get_user_role(uid)` | Trả về role — dùng trong policy, tránh đệ quy RLS |
| `get_user_restaurant(uid)` | Trả về `restaurant_id` của user |
| `has_role(uid, role)` | Check role + status=`active` |
| `handle_new_user()` | Trigger sinh `profiles` khi có user mới ở `auth.users` |

---

## 6. Storage Buckets

| Bucket | Public | Dùng cho |
|---|---|---|
| `avatars` | ✅ | Ảnh đại diện user |
| `menu-images` | ✅ | Ảnh món ăn |

---

## 7. Mẹo quản lý nhanh

- **Xem dữ liệu**: Lovable Cloud → View Backend → Table Editor.
- **Chạy SQL**: Backend → SQL Editor. Ví dụ kiểm tra user khoá:
  ```sql
  SELECT email, role, status, lock_until FROM profiles
   WHERE status = 'locked' OR lock_until IS NOT NULL;
  ```
- **Reset 1 nhà hàng demo**:
  ```sql
  DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = '<rid>');
  DELETE FROM orders     WHERE restaurant_id = '<rid>';
  UPDATE tables SET status = 'empty' WHERE restaurant_id = '<rid>';
  ```
- **Cấp superadmin** cho 1 email có sẵn:
  ```sql
  UPDATE profiles SET role = 'superadmin', status = 'active'
   WHERE email = 'you@example.com';
  ```

---

## 8. Khi thêm bảng mới — checklist

1. Tạo qua migration tool (không sửa DB tay).
2. `GRANT` cho `authenticated` và `service_role` ngay trong migration.
3. `ENABLE ROW LEVEL SECURITY` + viết policy theo `restaurant_id`.
4. Cập nhật `supabase/schema.sql` và `docs/DATABASE.md` này.
