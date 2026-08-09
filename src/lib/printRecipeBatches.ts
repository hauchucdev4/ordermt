export interface BatchIngredient {
  name: string;
  amount: number;
  unit: string;
  total: number;
}

export interface BatchPrintData {
  recipe_name: string;
  quantity: number;
  note?: string | null;
  created_by_name?: string | null;
  created_at: string;
  ingredients: BatchIngredient[];
}

const fmt = (n: number) => Number(Number(n).toFixed(3)).toLocaleString("vi-VN");

const dt = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function printRecipeBatches(restaurantName: string, batches: BatchPrintData[]) {
  const blocks = batches
    .map(
      (b) => `
    <section class="batch">
      <h2>${esc(b.recipe_name)} <span class="qty">× ${fmt(b.quantity)} phần</span></h2>
      <p class="meta">Người tạo: <b>${esc(b.created_by_name || "Không rõ")}</b> — ${dt(b.created_at)}</p>
      ${b.note ? `<p class="meta">Ghi chú: ${esc(b.note)}</p>` : ""}
      <table>
        <thead>
          <tr><th>Nguyên vật liệu</th><th class="r">Định mức/phần</th><th class="r">Tổng cần</th><th class="r">ĐVT</th></tr>
        </thead>
        <tbody>
          ${b.ingredients
            .map(
              (i) =>
                `<tr><td>${esc(i.name)}</td><td class="r">${fmt(i.amount)}</td><td class="r b">${fmt(
                  i.total,
                )}</td><td class="r">${esc(i.unit)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8" /><title>Bản thành phần món</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12pt; margin: 0; }
  h1 { font-size: 17pt; margin: 0 0 2mm; text-align: center; }
  .sub { text-align: center; font-size: 10pt; color: #555; margin: 0 0 8mm; }
  .batch { margin-bottom: 8mm; page-break-inside: avoid; }
  h2 { font-size: 13pt; margin: 0 0 1mm; border-bottom: 1px solid #111; padding-bottom: 1mm; }
  .qty { font-weight: normal; font-size: 11pt; }
  .meta { font-size: 10pt; color: #444; margin: 1mm 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  th, td { border: 1px solid #999; padding: 1.5mm 2mm; font-size: 10.5pt; }
  th { background: #eee; }
  .r { text-align: right; }
  .b { font-weight: bold; }
</style></head>
<body>
  <h1>BẢN THÀNH PHẦN MÓN</h1>
  <p class="sub">${esc(restaurantName)} — In lúc ${dt(new Date().toISOString())}</p>
  ${blocks}
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
