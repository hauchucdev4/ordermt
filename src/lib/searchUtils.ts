export function removeDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function matchSearch(text: string, query: string): boolean {
  if (!query.trim()) return true;
  const norm = removeDiacritics(text).toLowerCase();
  const q = removeDiacritics(query).toLowerCase();
  return norm.includes(q);
}
