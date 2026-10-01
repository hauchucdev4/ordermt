# Project Architecture Rules

- Business-day reporting attributes paid revenue to `orders.created_at`, because late payment must not move sales into another day.
- Delete ordered items through `delete_order_item_and_reset(uuid)`, because removing the final item must atomically remove the empty order and reset its table.