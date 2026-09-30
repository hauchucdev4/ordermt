const BUSINESS_DAY_START_HOUR = 4;

export function isOrderOverdue(createdAt: string, now = new Date()) {
  const created = new Date(createdAt);
  const cutoff = new Date(created);
  cutoff.setDate(cutoff.getDate() + 1);
  cutoff.setHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);
  return now >= cutoff;
}

export function formatOrderDate(createdAt: string) {
  return new Date(createdAt).toLocaleDateString("vi-VN");
}