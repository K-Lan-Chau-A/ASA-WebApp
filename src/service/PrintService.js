import LanPrinter from "@/lib/LanPrinter";
import UsbPrinter from "@/lib/UsbPrinter";
import PrintTemplate from "@/lib/PrintTemplate";

export default class PrintService {
  constructor(mode = "lan", config = {}) {
    // Chọn chế độ in
    if (mode === "usb") {
      this.driver = new UsbPrinter(config);
    } else {
      this.driver = new LanPrinter(config.ip || "192.168.1.107", config.port || 9100);
    }
  }

  async printOrder(order, shop) {
    try {
      const text = PrintTemplate.buildReceipt(order, shop);
      const result = await this.driver.print(text);
      console.log("[PrintService] ✅ In thành công:", result);
    } catch (err) {
      console.error("[PrintService] ❌ Lỗi in:", err);
      alert("Không thể in hóa đơn: " + err.message);
    }
  }
}
