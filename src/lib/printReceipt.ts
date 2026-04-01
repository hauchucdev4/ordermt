/**
 * K80×45mm thermal receipt PDF generator
 * Professional POS-style bill format
 */

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

interface ReceiptData {
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  tableName: string;
  orderId?: string;
  items: ReceiptItem[];
  total: number;
  wifiPassword?: string;
}

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D");
}

function fmtMoney(n: number): string {
  return n.toLocaleString("vi-VN");
}

export function printReceipt(data: ReceiptData) {
  import("jspdf").then(({ default: jsPDF }) => {
    const W = 80;       // page width mm
    const ML = 4;       // left margin
    const MR = 76;      // right margin (W - 4)
    const CW = MR - ML; // content width = 72

    // Column positions for items table
    const COL_NAME_X = ML;
    const COL_QTY_X = ML + CW * 0.55;   // ~43mm from left
    const COL_TOTAL_X = MR;              // right-aligned

    // Pre-calculate page height
    const itemLines = data.items.length * 4;
    const addrH = data.restaurantAddress ? 7 : 0;
    const phoneH = data.restaurantPhone ? 4 : 0;
    const wifiH = data.wifiPassword ? 4 : 0;
    const pageH = Math.max(65, 55 + itemLines + addrH + phoneH + wifiH);

    const doc = new jsPDF({ unit: "mm", format: [W, pageH] });
    let y = 4;

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0);

    // ========== DOUBLE LINE TOP ==========
    doc.setLineWidth(0.4);
    doc.line(ML, y, MR, y);
    doc.line(ML, y + 0.8, MR, y + 0.8);
    y += 5;

    // ========== RESTAURANT NAME ==========
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const rName = removeDiacritics(data.restaurantName || "NHA HANG").toUpperCase();
    doc.text(rName, W / 2, y, { align: "center" });
    y += 5;

    // ========== ADDRESS ==========
    if (data.restaurantAddress) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      const addr = removeDiacritics(data.restaurantAddress);
      const lines = doc.splitTextToSize(`D/C: ${addr}`, CW - 4);
      doc.text(lines, W / 2, y, { align: "center" });
      y += lines.length * 3.2;
    }

    // ========== PHONE ==========
    if (data.restaurantPhone) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(`SDT: ${data.restaurantPhone}`, W / 2, y, { align: "center" });
      y += 4;
    }

    // ========== DOUBLE LINE ==========
    doc.setLineWidth(0.4);
    doc.line(ML, y, MR, y);
    doc.line(ML, y + 0.8, MR, y + 0.8);
    y += 5;

    // ========== TITLE ==========
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PHIEU THANH TOAN", W / 2, y, { align: "center" });
    y += 6;

    // ========== TABLE & ORDER INFO ==========
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const tableLabel = `Ban: ${removeDiacritics(data.tableName)}`;
    doc.text(tableLabel, ML, y);
    if (data.orderId) {
      const shortId = data.orderId.substring(0, 8).toUpperCase();
      doc.text(`HD: #${shortId}`, MR, y, { align: "right" });
    }
    y += 4;

    const now = new Date();
    const dateStr = now.toLocaleDateString("vi-VN");
    const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    doc.text(`Ngay: ${dateStr}`, ML, y);
    doc.text(`Gio: ${timeStr}`, MR, y, { align: "right" });
    y += 3.5;

    // ========== DASHED LINE ==========
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(ML, y, MR, y);
    doc.setLineDashPattern([], 0);
    y += 3.5;

    // ========== COLUMN HEADERS ==========
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Mon", COL_NAME_X, y);
    doc.text("SL", COL_QTY_X, y, { align: "center" });
    doc.text("T.Tien", COL_TOTAL_X, y, { align: "right" });
    y += 3;

    doc.setLineDashPattern([1, 1], 0);
    doc.line(ML, y, MR, y);
    doc.setLineDashPattern([], 0);
    y += 3.5;

    // ========== ITEMS ==========
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");

    for (const item of data.items) {
      const itemName = removeDiacritics(item.name);
      const subtotal = item.quantity * item.price;

      // Truncate name to fit before SL column
      const maxNameWidth = CW * 0.5;
      let displayName = itemName;
      while (doc.getTextWidth(displayName) > maxNameWidth && displayName.length > 1) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== itemName) displayName += ".";

      doc.text(displayName, COL_NAME_X, y);
      doc.text(item.quantity.toString().padStart(2, "0"), COL_QTY_X, y, { align: "center" });
      doc.text(fmtMoney(subtotal), COL_TOTAL_X, y, { align: "right" });
      y += 4;
    }

    // ========== DASHED LINE BEFORE TOTAL ==========
    doc.setLineDashPattern([1, 1], 0);
    doc.line(ML, y, MR, y);
    doc.setLineDashPattern([], 0);
    y += 4;

    // ========== TOTAL ==========
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TONG CONG:", ML, y);
    doc.text(`${fmtMoney(data.total)} VND`, MR, y, { align: "right" });
    y += 3.5;

    doc.setLineDashPattern([1, 1], 0);
    doc.line(ML, y, MR, y);
    doc.setLineDashPattern([], 0);
    y += 5;

    // ========== FOOTER ==========
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Cam on & Hen gap lai quy khach!", W / 2, y, { align: "center" });
    y += 4;

    if (data.wifiPassword) {
      doc.text(`Pass Wifi: ${data.wifiPassword}`, W / 2, y, { align: "center" });
      y += 4;
    }

    // ========== DOUBLE LINE BOTTOM ==========
    doc.setLineWidth(0.4);
    doc.line(ML, y, MR, y);
    doc.line(ML, y + 0.8, MR, y + 0.8);

    doc.save(`hoa-don-${removeDiacritics(data.tableName).replace(/\s+/g, "-")}-${Date.now()}.pdf`);
  });
}
