import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export interface RecipeIngredientData {
  name: string;
  amount: number;
  unit: string;
}

export interface RecipeData {
  name: string;
  note?: string | null;
  ingredients: RecipeIngredientData[];
}

const HEADERS = ["Tên món", "Nguyên vật liệu", "Định mức", "ĐVT", "Ghi chú"];

export async function exportRecipesExcel(restaurantName: string, recipes: RecipeData[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Định lượng");

  ws.columns = [
    { width: 30 },
    { width: 30 },
    { width: 14 },
    { width: 12 },
    { width: 30 },
  ];

  const titleRow = ws.addRow([`ĐỊNH LƯỢNG MÓN ĂN — ${restaurantName}`]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, 5);
  titleRow.getCell(1).font = { name: "Arial", bold: true, size: 14 };
  titleRow.getCell(1).alignment = { horizontal: "center" };
  ws.addRow([]);

  const header = ws.addRow(HEADERS);
  header.eachCell((cell) => {
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1A73E8" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  for (const r of recipes) {
    if (r.ingredients.length === 0) {
      const row = ws.addRow([r.name, "", "", "", r.note ?? ""]);
      row.font = { name: "Arial" };
      continue;
    }
    r.ingredients.forEach((ing, idx) => {
      const row = ws.addRow([
        idx === 0 ? r.name : "",
        ing.name,
        ing.amount,
        ing.unit,
        idx === 0 ? r.note ?? "" : "",
      ]);
      row.font = { name: "Arial" };
      row.getCell(3).numFmt = "#,##0.###";
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `dinh-luong-${restaurantName.replace(/\s+/g, "-").toLowerCase()}.xlsx`,
  );
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
  }
  if (typeof v === "object" && "text" in (v as object)) {
    return String((v as { text: string }).text);
  }
  return String(v).trim();
}

export async function parseRecipesExcel(file: File): Promise<RecipeData[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const recipes: RecipeData[] = [];
  let current: RecipeData | null = null;
  let started = false;

  ws.eachRow((row) => {
    const dish = cellText(row.getCell(1).value);
    const ingName = cellText(row.getCell(2).value);
    const amountRaw = cellText(row.getCell(3).value);
    const unit = cellText(row.getCell(4).value) || "g";
    const note = cellText(row.getCell(5).value);

    if (!started) {
      if (dish === "Tên món" && ingName === "Nguyên vật liệu") started = true;
      return;
    }

    if (dish) {
      current = { name: dish, note: note || null, ingredients: [] };
      recipes.push(current);
    }
    if (!current) return;
    if (ingName) {
      const amount = Number(String(amountRaw).replace(/[^\d.,-]/g, "").replace(",", "."));
      current.ingredients.push({
        name: ingName,
        amount: Number.isFinite(amount) ? amount : 0,
        unit,
      });
    }
  });

  return recipes.filter((r) => r.name);
}
