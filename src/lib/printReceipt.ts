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

function dashLine(doc: any, x1: number, x2: number, y: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  const gap = 1.2;
  for (let x = x1; x < x2; x += gap * 2) {
    doc.line(x, y, Math.min(x + gap, x2), y);
  }
}

function doubleLine(doc: any, x1: number, x2: number, y: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
  doc.line(x1, y + 0.8, x2, y + 0.8);
}

export function printReceipt(data: ReceiptData) {
  import("jspdf").then(({ default: jsPDF }) => {
    const doc = new jsPDF({ unit: "mm", format: [80, 200] });
    const w = 80;
    const ml = 3; // margin left
    const mr = w - 3; // margin right
    const cw = mr - ml; // content width
    let y = 5;

    // ===== HEADER: Double line top =====
    doubleLine(doc, ml, mr, y);
    y += 4;

    // Restaurant name (bold, large, centered)
    doc.setFontSize(13);
    doc.setFont("courier", "bold");
    doc.text(removeDiacritics(data.restaurantName || "NHA HANG").toUpperCase(), w / 2, y, { align: "center" });
    y += 4.5;

    // Address
    if (data.restaurantAddress) {
      doc.setFontSize(7);
      doc.setFont("courier", "normal");
      const addr = removeDiacritics(data.restaurantAddress);
      const addrLines = doc.splitTextToSize(`D/C: ${addr}`, cw);
      doc.text(addrLines, w / 2, y, { align: "center" });
      y += addrLines.length * 3;
    }

    // Phone
    if (data.restaurantPhone) {
      doc.setFontSize(7);
      doc.setFont("courier", "normal");
      doc.text(`SDT: ${data.restaurantPhone}`, w / 2, y, { align: "center" });
      y += 3.5;
    }

    // Double line
    doubleLine(doc, ml, mr, y);
    y += 4;

    // ===== TITLE =====
    doc.setFontSize(11);
    doc.setFont("courier", "bold");
    doc.text("PHIEU THANH TOAN", w / 2, y, { align: "center" });
    y += 5;

    // ===== TABLE & ORDER INFO =====
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
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

    // Dash line
    dashLine(doc, ml, mr, y);
    y += 3;

    // ===== COLUMN HEADERS =====
    doc.setFontSize(8);
    doc.setFont("courier", "bold");
    doc.text("Mon", ml, y);
    doc.text("SL", ml + cw * 0.6, y, { align: "center" });
    doc.text("T.Tien", mr, y, { align: "right" });
    y += 2.5;

    dashLine(doc, ml, mr, y);
    y += 3;

    // ===== ITEMS =====
    doc.setFontSize(7.5);
    doc.setFont("courier", "normal");

    for (const item of data.items) {
      const itemName = removeDiacritics(item.name);
      const subtotal = item.quantity * item.price;

      // Truncate long names
      const maxNameLen = 22;
      const displayName = itemName.length > maxNameLen 
        ? itemName.substring(0, maxNameLen - 1) + "." 
        : itemName;

      doc.text(displayName, ml, y);
      doc.text(item.quantity.toString().padStart(2, "0"), ml + cw * 0.6, y, { align: "center" });
      doc.text(fmtMoney(subtotal), mr, y, { align: "right" });
      y += 3.5;
    }

    // Dash line before total
    dashLine(doc, ml, mr, y);
    y += 4;

    // ===== TOTAL =====
    doc.setFontSize(10);
    doc.setFont("courier", "bold");
    doc.text("TONG CONG:", ml, y);
    doc.text(`${fmtMoney(data.total)} VND`, mr, y, { align: "right" });
    y += 3;

    dashLine(doc, ml, mr, y);
    y += 5;

    // ===== FOOTER =====
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
    doc.text("Cam on & Hen gap lai quy khach!", w / 2, y, { align: "center" });
    y += 3.5;

    if (data.wifiPassword) {
      doc.text(`Pass Wifi: ${data.wifiPassword}`, w / 2, y, { align: "center" });
      y += 3.5;
    }

    // Double line bottom
    doubleLine(doc, ml, mr, y);

    // Trim page height
    const pageHeight = y + 5;
    const pages = doc.internal.pages;
    // Set actual page size
    doc.internal.pageSize.height = pageHeight;

    doc.save(`hoa-don-${removeDiacritics(data.tableName).replace(/\s+/g, "-")}-${Date.now()}.pdf`);
  });
}
