import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface TableDetail {
  tableName: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  orderId: string;
  paidAt: string;
}

interface ExportParams {
  restaurantName: string;
  filterLabel: string;
  totalRevenue: number;
  totalOrders: number;
  totalTables: number;
  tableDetails: TableDetail[];
}

const PRIMARY = "1A73E8";
const PRIMARY_LIGHT = "E8F0FE";
const HEADER_BG = "F1F3F4";
const BORDER_COLOR = "DADCE0";
const WHITE = "FFFFFF";
const HIGHLIGHT_BG = "FFF3E0";

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: BORDER_COLOR } },
  left: { style: "thin", color: { argb: BORDER_COLOR } },
  right: { style: "thin", color: { argb: BORDER_COLOR } },
};

const moneyFmt = '#,##0" VND"';

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col <= colCount) {
      cell.font = { name: "Arial", bold: true, size: 11, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = thinBorder;
    }
  });
  row.height = 28;
}

export async function exportRevenueExcel(params: ExportParams) {
  const { restaurantName, filterLabel, totalRevenue, totalOrders, totalTables, tableDetails } = params;
  const avgPerBill = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const wb = new ExcelJS.Workbook();
  wb.creator = restaurantName;
  wb.created = new Date();

  // ===================== SHEET 1: SUMMARY =====================
  const ws1 = wb.addWorksheet("Tổng quan", { views: [{ showGridLines: false }] });
  ws1.columns = [
    { width: 5 }, { width: 30 }, { width: 25 }, { width: 5 },
  ];

  // Title
  ws1.mergeCells("B2:C2");
  const titleCell = ws1.getCell("B2");
  titleCell.value = "BÁO CÁO DOANH THU";
  titleCell.font = { name: "Arial", bold: true, size: 20, color: { argb: PRIMARY } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 36;

  // Restaurant name
  ws1.mergeCells("B3:C3");
  const nameCell = ws1.getCell("B3");
  nameCell.value = restaurantName;
  nameCell.font = { name: "Arial", bold: true, size: 14, color: { argb: "333333" } };
  nameCell.alignment = { horizontal: "center" };
  ws1.getRow(3).height = 24;

  // Period & date
  ws1.mergeCells("B4:C4");
  ws1.getCell("B4").value = `Thời gian: ${filterLabel}`;
  ws1.getCell("B4").font = { name: "Arial", size: 11, color: { argb: "666666" } };
  ws1.getCell("B4").alignment = { horizontal: "center" };

  ws1.mergeCells("B5:C5");
  ws1.getCell("B5").value = `Ngày xuất: ${new Date().toLocaleString("vi-VN")}`;
  ws1.getCell("B5").font = { name: "Arial", size: 10, color: { argb: "999999" } };
  ws1.getCell("B5").alignment = { horizontal: "center" };

  // Summary cards
  const summaryItems = [
    { label: "Tổng doanh thu", value: totalRevenue, isMoney: true },
    { label: "Tổng số hóa đơn", value: totalOrders, isMoney: false },
    { label: "Số bàn phục vụ", value: totalTables, isMoney: false },
    { label: "Trung bình / hóa đơn", value: avgPerBill, isMoney: true },
  ];

  let r = 7;
  summaryItems.forEach((item) => {
    const labelCell = ws1.getCell(`B${r}`);
    const valueCell = ws1.getCell(`C${r}`);

    labelCell.value = item.label;
    labelCell.font = { name: "Arial", bold: true, size: 12, color: { argb: "333333" } };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_LIGHT } };
    labelCell.border = thinBorder;
    labelCell.alignment = { vertical: "middle", indent: 1 };

    if (item.isMoney) {
      valueCell.value = item.value;
      valueCell.numFmt = moneyFmt;
    } else {
      valueCell.value = item.value;
    }
    valueCell.font = { name: "Arial", bold: true, size: 14, color: { argb: PRIMARY } };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
    valueCell.border = thinBorder;
    valueCell.alignment = { horizontal: "right", vertical: "middle" };

    ws1.getRow(r).height = 32;
    r++;
  });

  // ===================== SHEET 2: INVOICES =====================
  const ws2 = wb.addWorksheet("Hóa đơn");
  ws2.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Mã HĐ", key: "id", width: 16 },
    { header: "Bàn", key: "table", width: 14 },
    { header: "Thời gian", key: "time", width: 22 },
    { header: "Tổng tiền", key: "total", width: 20 },
  ];

  // Header
  const hdr2 = ws2.getRow(1);
  styleHeaderRow(hdr2, 5);
  ws2.views = [{ state: "frozen", ySplit: 1 }];

  tableDetails.forEach((td, i) => {
    const row = ws2.addRow({
      stt: i + 1,
      id: td.orderId.slice(0, 8).toUpperCase(),
      table: td.tableName,
      time: new Date(td.paidAt).toLocaleString("vi-VN"),
      total: td.total,
    });

    row.getCell("total").numFmt = moneyFmt;
    row.getCell("total").alignment = { horizontal: "right" };
    row.getCell("stt").alignment = { horizontal: "center" };
    row.getCell("id").font = { name: "Arial", size: 10, color: { argb: PRIMARY } };

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col <= 5) {
        cell.border = thinBorder;
        if (!cell.font) cell.font = { name: "Arial", size: 10 };
      }
    });

    // Highlight large invoices
    if (td.total > 500000) {
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col <= 5) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIGHLIGHT_BG } };
        }
      });
    }
  });

  // Total row
  const totalRow2 = ws2.addRow({ stt: "", id: "", table: "", time: "TỔNG CỘNG:", total: totalRevenue });
  totalRow2.getCell("time").font = { name: "Arial", bold: true, size: 11 };
  totalRow2.getCell("time").alignment = { horizontal: "right" };
  totalRow2.getCell("total").numFmt = moneyFmt;
  totalRow2.getCell("total").font = { name: "Arial", bold: true, size: 12, color: { argb: PRIMARY } };
  totalRow2.getCell("total").alignment = { horizontal: "right" };
  totalRow2.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col <= 5) cell.border = thinBorder;
  });

  ws2.autoFilter = { from: "A1", to: "E1" };

  // ===================== SHEET 3: INVOICE DETAIL =====================
  const ws3 = wb.addWorksheet("Chi tiết hóa đơn");
  ws3.columns = [
    { header: "Mã HĐ", key: "id", width: 16 },
    { header: "Bàn", key: "table", width: 14 },
    { header: "Món", key: "item", width: 28 },
    { header: "Số lượng", key: "qty", width: 12 },
    { header: "Đơn giá", key: "price", width: 18 },
    { header: "Thành tiền", key: "subtotal", width: 18 },
  ];

  const hdr3 = ws3.getRow(1);
  styleHeaderRow(hdr3, 6);
  ws3.views = [{ state: "frozen", ySplit: 1 }];

  tableDetails.forEach((td) => {
    td.items.forEach((item, i) => {
      const row = ws3.addRow({
        id: i === 0 ? td.orderId.slice(0, 8).toUpperCase() : "",
        table: i === 0 ? td.tableName : "",
        item: item.name,
        qty: item.quantity,
        price: item.price,
        subtotal: item.quantity * item.price,
      });

      row.getCell("price").numFmt = moneyFmt;
      row.getCell("subtotal").numFmt = moneyFmt;
      row.getCell("price").alignment = { horizontal: "right" };
      row.getCell("subtotal").alignment = { horizontal: "right" };
      row.getCell("qty").alignment = { horizontal: "center" };
      if (i === 0) {
        row.getCell("id").font = { name: "Arial", size: 10, color: { argb: PRIMARY }, bold: true };
      }

      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col <= 6) {
          cell.border = thinBorder;
          if (!cell.font) cell.font = { name: "Arial", size: 10 };
        }
      });
    });
  });

  // Grand total
  const totalRow3 = ws3.addRow({ id: "", table: "", item: "", qty: "", price: "TỔNG CỘNG:", subtotal: totalRevenue });
  totalRow3.getCell("price").font = { name: "Arial", bold: true, size: 11 };
  totalRow3.getCell("price").alignment = { horizontal: "right" };
  totalRow3.getCell("subtotal").numFmt = moneyFmt;
  totalRow3.getCell("subtotal").font = { name: "Arial", bold: true, size: 12, color: { argb: PRIMARY } };
  totalRow3.getCell("subtotal").alignment = { horizontal: "right" };
  totalRow3.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col <= 6) cell.border = thinBorder;
  });

  ws3.autoFilter = { from: "A1", to: "F1" };

  // ===================== SHEET 4: THEO NGÀY =====================
  const ws4 = wb.addWorksheet("Theo ngày");
  ws4.columns = [
    { header: "Ngày", key: "day", width: 18 },
    { header: "Số hóa đơn", key: "count", width: 16 },
    { header: "Doanh thu", key: "revenue", width: 22 },
  ];

  const hdr4 = ws4.getRow(1);
  styleHeaderRow(hdr4, 3);
  ws4.views = [{ state: "frozen", ySplit: 1 }];

  const dailyMap: Record<string, { count: number; revenue: number }> = {};
  tableDetails.forEach((td) => {
    const day = new Date(td.paidAt).toLocaleDateString("vi-VN");
    if (!dailyMap[day]) dailyMap[day] = { count: 0, revenue: 0 };
    dailyMap[day].count++;
    dailyMap[day].revenue += td.total;
  });

  Object.entries(dailyMap).forEach(([day, d]) => {
    const row = ws4.addRow({ day, count: d.count, revenue: d.revenue });
    row.getCell("revenue").numFmt = moneyFmt;
    row.getCell("revenue").alignment = { horizontal: "right" };
    row.getCell("count").alignment = { horizontal: "center" };
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col <= 3) {
        cell.border = thinBorder;
        if (!cell.font) cell.font = { name: "Arial", size: 10 };
      }
    });
  });

  const totalRow4 = ws4.addRow({ day: "TỔNG CỘNG", count: totalOrders, revenue: totalRevenue });
  totalRow4.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col <= 3) {
      cell.font = { name: "Arial", bold: true, size: 11, color: { argb: PRIMARY } };
      cell.border = thinBorder;
    }
  });
  totalRow4.getCell("revenue").numFmt = moneyFmt;
  totalRow4.getCell("revenue").alignment = { horizontal: "right" };

  ws4.autoFilter = { from: "A1", to: "C1" };

  // ===================== SHEET 5: TOP MÓN BÁN CHẠY =====================
  const ws5 = wb.addWorksheet("Top món bán chạy");
  ws5.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Tên món", key: "name", width: 30 },
    { header: "Số lượng bán", key: "qty", width: 16 },
    { header: "Doanh thu", key: "revenue", width: 22 },
  ];

  const hdr5 = ws5.getRow(1);
  styleHeaderRow(hdr5, 4);
  ws5.views = [{ state: "frozen", ySplit: 1 }];

  const itemMap: Record<string, { qty: number; revenue: number }> = {};
  tableDetails.forEach((td) => {
    td.items.forEach((item) => {
      const key = item.name;
      if (!itemMap[key]) itemMap[key] = { qty: 0, revenue: 0 };
      itemMap[key].qty += item.quantity;
      itemMap[key].revenue += item.quantity * item.price;
    });
  });

  const topItems = Object.entries(itemMap)
    .sort((a, b) => b[1].qty - a[1].qty);

  topItems.forEach(([name, d], i) => {
    const row = ws5.addRow({ stt: i + 1, name, qty: d.qty, revenue: d.revenue });
    row.getCell("stt").alignment = { horizontal: "center" };
    row.getCell("qty").alignment = { horizontal: "center" };
    row.getCell("revenue").numFmt = moneyFmt;
    row.getCell("revenue").alignment = { horizontal: "right" };
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col <= 4) {
        cell.border = thinBorder;
        if (!cell.font) cell.font = { name: "Arial", size: 10 };
      }
    });

    // Highlight top 3
    if (i < 3) {
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col <= 4) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_LIGHT } };
          cell.font = { name: "Arial", size: 10, bold: true };
        }
      });
    }
  });

  // ===================== SAVE =====================
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `doanh-thu-${restaurantName}-${Date.now()}.xlsx`);
}
