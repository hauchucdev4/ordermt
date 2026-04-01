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
    // Calculate height first based on content
    const baseHeight = 50; // header + footer
    const itemHeight = data.items.length * 3.5;
    const addrHeight = data.restaurantAddress ? 6 : 0;
    const phoneHeight = data.restaurantPhone ? 3.5 : 0;
    const wifiHeight = data.wifiPassword ? 3.5 : 0;
    const totalPageHeight = baseHeight + itemHeight + addrHeight + phoneHeight + wifiHeight;

    const doc = new jsPDF({ unit: "mm", format: [80, Math.max(totalPageHeight, 60)] });
    const w = 80;
    const ml = 3;
    const mr = w - 3;
    const cw = mr - ml;
    let y = 5;

    // Ensure black text
    doc.setTextColor(0, 0, 0);

    // ===== HEADER =====
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(ml, y, mr, y);
    doc.line(ml, y + 0.8, mr, y + 0.8);
    y += 4;

    // Restaurant name
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(removeDiacritics(data.restaurantName || "NHA HANG").toUpperCase(), w / 2, y, { align: "center" });
    y += 4.5;

    // Address
    if (data.restaurantAddress) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const addr = removeDiacritics(data.restaurantAddress);
      const addrLines = doc.splitTextToSize(`D/C: ${addr}`, cw);
      doc.text(addrLines, w / 2, y, { align: "center" });
      y += addrLines.length * 3;
    }

    // Phone
    if (data.restaurantPhone) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`SDT: ${data.restaurantPhone}`, w / 2, y, { align: "center" });
      y += 3.5;
    }

    // Double line
    doc.line(ml, y, mr, y);
    doc.line(ml, y + 0.8, mr, y + 0.8);
    y += 4;

    // ===== TITLE =====
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PHIEU THANH TOAN", w / 2, y, { align: "center" });
    y += 5;

    // ===== TABLE & ORDER INFO =====
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Ban: ${removeDiacritics(data.tableName)}`, ml, y);
    if (data.orderId) {
      const shortId = data.orderId.substring(0, 8).toUpperCase();
      doc.text(`HD: #${shortId}`, mr, y, { align: "right" });
    }
    y += 3.5;

    const now = new Date();
    const dateStr = now.toLocaleDateString("vi-VN");
    const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    doc.text(`Ngay: ${dateStr}`, ml, y);
    doc.text(`Gio: ${timeStr}`, mr, y, { align: "right" });
    y += 3;

    // Dashed line
    doc.setLineDashPattern([1, 1], 0);
    doc.line(ml, y, mr, y);
    doc.setLineDashPattern([], 0);
    y += 3;

    // ===== COLUMN HEADERS =====
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Mon", ml, y);
    doc.text("SL", ml + cw * 0.6, y, { align: "center" });
    doc.text("T.Tien", mr, y, { align: "right" });
    y += 2.5;

    doc.setLineDashPattern([1, 1], 0);
    doc.line(ml, y, mr, y);
    doc.setLineDashPattern([], 0);
    y += 3;

    // ===== ITEMS =====
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");

    for (const item of data.items) {
      const itemName = removeDiacritics(item.name);
      const subtotal = item.quantity * item.price;

      const maxNameLen = 22;
      const displayName = itemName.length > maxNameLen
        ? itemName.substring(0, maxNameLen - 1) + "."
        : itemName;

      doc.text(displayName, ml, y);
      doc.text(item.quantity.toString().padStart(2, "0"), ml + cw * 0.6, y, { align: "center" });
      doc.text(fmtMoney(subtotal), mr, y, { align: "right" });
      y += 3.5;
    }

    // Dashed line before total
    doc.setLineDashPattern([1, 1], 0);
    doc.line(ml, y, mr, y);
    doc.setLineDashPattern([], 0);
    y += 4;

    // ===== TOTAL =====
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TONG CONG:", ml, y);
    doc.text(`${fmtMoney(data.total)} VND`, mr, y, { align: "right" });
    y += 3;

    doc.setLineDashPattern([1, 1], 0);
    doc.line(ml, y, mr, y);
    doc.setLineDashPattern([], 0);
    y += 5;

    // ===== FOOTER =====
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Cam on & Hen gap lai quy khach!", w / 2, y, { align: "center" });
    y += 3.5;

    if (data.wifiPassword) {
      doc.text(`Pass Wifi: ${data.wifiPassword}`, w / 2, y, { align: "center" });
      y += 3.5;
    }

    // Double line bottom
    doc.line(ml, y, mr, y);
    doc.line(ml, y + 0.8, mr, y + 0.8);

    doc.save(`hoa-don-${removeDiacritics(data.tableName).replace(/\s+/g, "-")}-${Date.now()}.pdf`);
  });
}
