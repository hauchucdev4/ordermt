/**
 * Export Revenue Report as professional PDF with full Vietnamese Unicode support.
 * Uses html2canvas to render styled HTML → image → jsPDF pages.
 */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface BillItem {
  name: string;
  quantity: number;
  price: number;
}

interface BillDetail {
  tableName: string;
  items: BillItem[];
  total: number;
  orderId: string;
  paidAt: string;
}

interface RevenueReportData {
  restaurantName: string;
  filterLabel: string;
  totalRevenue: number;
  totalOrders: number;
  totalTables: number;
  tableDetails: BillDetail[];
}

function fmt(n: number): string {
  return n.toLocaleString("vi-VN");
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleString("vi-VN");
}

function buildHTML(data: RevenueReportData): string {
  const avg = data.totalOrders > 0 ? Math.round(data.totalRevenue / data.totalOrders) : 0;
  const now = new Date().toLocaleString("vi-VN");

  // Group bills by index for display
  let billsHTML = "";
  data.tableDetails.forEach((bill, idx) => {
    const itemsRows = bill.items
      .map(
        (item, i) => `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px 8px;text-align:center;color:#6b7280;font-size:12px;">${i + 1}</td>
          <td style="padding:6px 8px;font-size:12px;">${item.name}</td>
          <td style="padding:6px 8px;text-align:center;font-size:12px;">${item.quantity}</td>
          <td style="padding:6px 8px;text-align:right;font-size:12px;">${fmt(item.price)}</td>
          <td style="padding:6px 8px;text-align:right;font-size:12px;font-weight:500;">${fmt(item.quantity * item.price)}</td>
        </tr>`
      )
      .join("");

    billsHTML += `
      <div style="margin-bottom:16px;border:1px solid #d1d5db;border-radius:8px;overflow:hidden;page-break-inside:avoid;">
        <div style="background:#f1f5f9;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d1d5db;">
          <span style="font-weight:700;font-size:13px;color:#1e293b;">Hóa đơn #${idx + 1} — ${bill.tableName}</span>
          <span style="font-size:11px;color:#64748b;">${fmtDate(bill.paidAt)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
              <th style="padding:6px 8px;text-align:center;font-size:11px;color:#64748b;font-weight:600;width:40px;">STT</th>
              <th style="padding:6px 8px;text-align:left;font-size:11px;color:#64748b;font-weight:600;">Tên món</th>
              <th style="padding:6px 8px;text-align:center;font-size:11px;color:#64748b;font-weight:600;width:50px;">SL</th>
              <th style="padding:6px 8px;text-align:right;font-size:11px;color:#64748b;font-weight:600;width:100px;">Đơn giá</th>
              <th style="padding:6px 8px;text-align:right;font-size:11px;color:#64748b;font-weight:600;width:110px;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;padding:10px 14px;background:#f8fafc;border-top:2px solid #e2e8f0;">
          <span style="font-size:13px;color:#475569;">Tổng hóa đơn:&nbsp;</span>
          <span style="font-size:14px;font-weight:700;color:#0f172a;">${fmt(bill.total)} đ</span>
        </div>
      </div>`;
  });

  return `
<div id="__pdf_revenue" style="width:760px;padding:40px 36px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1e293b;background:#fff;">
  <!-- HEADER -->
  <div style="text-align:center;margin-bottom:8px;">
    <div style="font-size:22px;font-weight:800;letter-spacing:1px;color:#0f172a;">BÁO CÁO DOANH THU</div>
    <div style="font-size:16px;font-weight:600;color:#334155;margin-top:4px;">${data.restaurantName}</div>
    <div style="font-size:11px;color:#64748b;margin-top:4px;">Thời gian: ${data.filterLabel} &nbsp;|&nbsp; Ngày xuất: ${now}</div>
  </div>

  <hr style="border:none;border-top:2px solid #1e293b;margin:16px 0 20px;">

  <!-- SUMMARY -->
  <div style="display:flex;gap:12px;margin-bottom:24px;">
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:14px 16px;text-align:center;">
      <div style="font-size:11px;color:#64748b;font-weight:500;">Tổng doanh thu</div>
      <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:4px;">${fmt(data.totalRevenue)} đ</div>
    </div>
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:14px 16px;text-align:center;">
      <div style="font-size:11px;color:#64748b;font-weight:500;">Tổng hóa đơn</div>
      <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:4px;">${data.totalOrders}</div>
    </div>
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:14px 16px;text-align:center;">
      <div style="font-size:11px;color:#64748b;font-weight:500;">Số bàn phục vụ</div>
      <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:4px;">${data.totalTables}</div>
    </div>
    <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:14px 16px;text-align:center;">
      <div style="font-size:11px;color:#64748b;font-weight:500;">TB / hóa đơn</div>
      <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:4px;">${fmt(avg)} đ</div>
    </div>
  </div>

  <!-- SECTION TITLE -->
  <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;">
    Chi tiết từng hóa đơn
  </div>

  <!-- BILLS -->
  ${billsHTML}

  <!-- GRAND TOTAL -->
  <div style="margin-top:20px;padding:14px 20px;background:#1e293b;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:15px;font-weight:700;color:#fff;">TỔNG CỘNG DOANH THU</span>
    <span style="font-size:20px;font-weight:800;color:#fff;">${fmt(data.totalRevenue)} đ</span>
  </div>
</div>`;
}

export async function exportRevenuePDF(data: RevenueReportData): Promise<void> {
  // Create temporary container
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.innerHTML = buildHTML(data);
  document.body.appendChild(container);

  const el = container.querySelector("#__pdf_revenue") as HTMLElement;

  const A4_W_MM = 210;
  const A4_H_MM = 297;
  const MARGIN = 10;
  const CONTENT_W_MM = A4_W_MM - MARGIN * 2;

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pxPerMM = canvas.width / (el.offsetWidth * (A4_W_MM / (el.offsetWidth * (A4_W_MM / el.offsetWidth))));
    
    const imgWidthMM = CONTENT_W_MM;
    const imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;

    const pdf = new jsPDF("p", "mm", "a4");
    let heightLeft = imgHeightMM;
    let position = MARGIN;
    const pageContentH = A4_H_MM - MARGIN * 2;

    // First page
    pdf.addImage(imgData, "PNG", MARGIN, position, imgWidthMM, imgHeightMM);
    heightLeft -= pageContentH;

    // Additional pages
    while (heightLeft > 0) {
      pdf.addPage();
      position = MARGIN - (imgHeightMM - heightLeft);
      pdf.addImage(imgData, "PNG", MARGIN, position, imgWidthMM, imgHeightMM);
      heightLeft -= pageContentH;
    }

    // Page numbers
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Trang ${i}/${totalPages}`, A4_W_MM - MARGIN, A4_H_MM - 5, { align: "right" });
      pdf.text(data.restaurantName, MARGIN, A4_H_MM - 5);
    }

    pdf.save(`bao-cao-doanh-thu-${data.restaurantName}-${Date.now()}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
