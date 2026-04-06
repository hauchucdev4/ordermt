import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, CreditCard, Loader2 } from "lucide-react";
import { useRef } from "react";

export interface ReceiptData {
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  tableName: string;
  orderId?: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  wifiPassword?: string;
}

function fmtMoney(n: number) {
  return n.toLocaleString("vi-VN");
}

export default function ReceiptPreview({
  data,
  open,
  onClose,
  onPay,
  paying,
  showPaid,
}: {
  data: ReceiptData | null;
  open: boolean;
  onClose: () => void;
  onPay?: () => void;
  paying?: boolean;
  showPaid?: boolean;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN");
  const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const shortId = data.orderId?.substring(0, 8).toUpperCase() || "";

  const handlePrint = () => {
    const el = receiptRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=350,height=600");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hóa đơn</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body { margin: 0; padding: 0; font-family: 'Courier New', monospace; }
        .receipt { width: 80mm; margin: 0 auto; }
      </style></head><body>${el.outerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handleDownload = () => {
    import("@/lib/printReceipt").then(({ printReceipt }) => {
      printReceipt(data);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-white dark:bg-zinc-900">
        {/* Action bar */}
        <div className="flex items-center justify-between px-4 py-3 pr-12 border-b bg-muted/30">
          <span className="text-sm font-semibold text-foreground">Xem trước hóa đơn</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1" /> In
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {/* Receipt preview */}
        <div className="px-4 py-4 overflow-y-auto max-h-[60vh]">
          <div
            ref={receiptRef}
            className="receipt mx-auto bg-white text-black rounded shadow-sm border"
            style={{
              width: "302px",
              fontFamily: "'Courier New', monospace",
              fontSize: "12px",
              padding: "12px 10px",
              lineHeight: 1.5,
            }}
          >
            {/* Double line top */}
            <div style={{ borderTop: "3px double #000", marginBottom: 8 }} />

            {/* Restaurant name */}
            <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "16px", letterSpacing: 1 }}>
              {data.restaurantName?.toUpperCase() || "NHÀ HÀNG"}
            </div>

            {data.restaurantAddress && (
              <div style={{ textAlign: "center", fontSize: "11px", marginTop: 2 }}>
                Đ/C: {data.restaurantAddress}
              </div>
            )}
            {data.restaurantPhone && (
              <div style={{ textAlign: "center", fontSize: "11px" }}>
                SĐT: {data.restaurantPhone}
              </div>
            )}

            {/* Double line */}
            <div style={{ borderTop: "3px double #000", margin: "8px 0" }} />

            {/* Title */}
            <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "14px", margin: "4px 0 8px" }}>
              PHIẾU THANH TOÁN
            </div>

            {/* Table & Order info */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>Bàn: {data.tableName}</span>
              {shortId && <span>HĐ: #{shortId}</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: 6 }}>
              <span>Ngày: {dateStr}</span>
              <span>Giờ: {timeStr}</span>
            </div>

            {/* Dashed line */}
            <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

            {/* Column headers */}
            <div style={{ display: "flex", fontWeight: "bold", fontSize: "11px", padding: "4px 0" }}>
              <span style={{ flex: 1 }}>Món</span>
              <span style={{ width: 30, textAlign: "center" }}>SL</span>
              <span style={{ width: 80, textAlign: "right" }}>T.Tiền</span>
            </div>

            <div style={{ borderTop: "1px dashed #000", marginBottom: 4 }} />

            {/* Items */}
            {data.items.map((item, i) => (
              <div key={i} style={{ display: "flex", fontSize: "11px", padding: "2px 0" }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </span>
                <span style={{ width: 30, textAlign: "center" }}>
                  {String(item.quantity).padStart(2, "0")}
                </span>
                <span style={{ width: 80, textAlign: "right" }}>
                  {fmtMoney(item.quantity * item.price)}
                </span>
              </div>
            ))}

            {/* Dashed line before total */}
            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px", padding: "4px 0" }}>
              <span>TỔNG CỘNG:</span>
              <span>{fmtMoney(data.total)} VND</span>
            </div>

            <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

            {/* Footer */}
            <div style={{ textAlign: "center", fontSize: "11px", marginTop: 8 }}>
              Cảm ơn & Hẹn gặp lại quý khách!
            </div>

            {data.wifiPassword && (
              <div style={{ textAlign: "center", fontSize: "11px", marginTop: 2 }}>
                Pass Wifi: {data.wifiPassword}
              </div>
            )}

            {/* Double line bottom */}
            <div style={{ borderTop: "3px double #000", marginTop: 8 }} />
          </div>
        </div>

        {/* Bottom actions */}
        <div className="border-t px-4 py-3 flex gap-2">
          {showPaid && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">✓ ĐÃ THANH TOÁN</span>
            </div>
          )}
          {onPay && !showPaid && (
            <Button className="flex-1" onClick={onPay} disabled={paying}>
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CreditCard className="mr-2 h-4 w-4" /> Xác nhận thanh toán
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
