import PrintService from "@/services/PrintService";

/**
 * In báo cáo chốt ca (Close Shift Report)
 * ----------------------------------------
 * @param {{
 *   user: { fullName?: string, username?: string, shopName?: string },
 *   shiftId: number,
 *   totalInvoices: number,
 *   totalRevenue: number,
 *   closedAt: Date,
 *   topCategories?: Array<{ categoryName: string, totalRevenue: number }>,
 *   topProducts?: Array<{ productName: string, totalQuantitySold: number }>,
 * }} data
 */
export async function printCloseShift(data) {
  try {
    const {
      user = {},
      shiftId,
      totalInvoices = 0,
      totalRevenue = 0,
      closedAt = new Date(),
      topCategories = [],
      topProducts = [],
    } = data;

    const shopName = (user.shopName || "CỬA HÀNG").toUpperCase();
    const staffName = user.fullName || user.username || "NHÂN VIÊN";
    const timeStr = new Date(closedAt).toLocaleString("vi-VN");
    const line = "-".repeat(32);

    // Helpers
    const center = (text) => {
      const space = Math.max(0, Math.floor((32 - text.length) / 2));
      return " ".repeat(space) + text;
    };
    const pad = (left, right) => {
      const total = 32;
      const text = left + " ".repeat(Math.max(1, total - left.length - right.length)) + right;
      return text.slice(0, total);
    };

    // Header
    let content = "";
    content += center("********** CHỐT CA **********") + "\n\n";
    content += center(shopName) + "\n";
    content += line + "\n";
    content += pad("Ca làm:", `#${shiftId}`) + "\n";
    content += pad("Nhân viên:", staffName) + "\n";
    content += pad("Thời gian:", timeStr) + "\n";
    content += line + "\n";
    content += pad("Tổng hóa đơn:", totalInvoices.toLocaleString("vi-VN")) + "\n";
    content += pad(
      "Tổng doanh thu:",
      totalRevenue.toLocaleString("vi-VN") + "đ"
    ) + "\n";
    content += line + "\n\n";

    // Top Categories (optional)
    if (topCategories.length > 0) {
      content += center("🔹 Doanh thu theo danh mục") + "\n";
      topCategories.forEach((c) => {
        const name = c.categoryName?.slice(0, 18) || "Khác";
        const val = (c.totalRevenue || 0).toLocaleString("vi-VN");
        content += pad(name, val) + "\n";
      });
      content += line + "\n";
    }

    // Top Products (optional)
    if (topProducts.length > 0) {
      content += center("🏆 Sản phẩm bán chạy") + "\n";
      topProducts.slice(0, 4).forEach((p) => {
        const name = p.productName?.slice(0, 18) || "SP";
        const qty = (p.totalQuantitySold || 0).toString();
        content += pad(name, qty + " sp") + "\n";
      });
      content += line + "\n";
    }

    // Footer
    content += center("CẢM ƠN BẠN ĐÃ LÀM VIỆC CHĂM CHỈ 💪") + "\n";
    content += center("HẸN GẶP LẠI TRONG CA TIẾP THEO") + "\n\n";
    content += center("********************************") + "\n\n\n";

    // 🖨️ Gửi đến PrintService
    const printer = new PrintService("auto", { ip: "192.168.1.107", port: 9100 });

    if (printer.env === "web") {
      // Trường hợp chạy trong trình duyệt: in popup
      const html = `
        <html><head><style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family: monospace; width: 80mm; padding: 4px;
               line-height: 1.4; font-size: 13px; white-space: pre; }
        </style></head>
        <body>${content.replace(/\n/g, "<br>")}</body>
        <script>
          window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };
        </script></html>`;
      const w = window.open("", "_blank", "width=400,height=600");
      w.document.write(html);
      w.document.close();
    } else {
      // Electron / Node / LAN / USB
      await printer.driver.print(content);
    }

    console.log("[CloseShiftTemplate] ✅ In báo cáo chốt ca thành công!");
  } catch (err) {
    console.error("[CloseShiftTemplate] ❌ Lỗi in:", err);
    alert("Không thể in báo cáo chốt ca: " + (err.message || err));
  }
}
