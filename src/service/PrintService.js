import LanPrinter from "@/lib/LanPrinter";
import UsbPrinter from "@/lib/UsbPrinter";
import PrintTemplate from "@/lib/PrintTemplate";

export default class PrintService {
  constructor(mode = "lan", config = {}) {
    // 🔹 Chọn chế độ in
    if (mode === "usb") {
      this.driver = new UsbPrinter(config);
    } else {
      this.driver = new LanPrinter(config.ip || "192.168.1.107", config.port || 9100);
    }
  }

  async printOrder(order, shop = null) {
  try {
    const text = await PrintTemplate.buildReceipt(order, shop);
    localStorage.setItem("printText", text);

    const printUrl = `${window.location.origin}/print/receipt.html`;
    const w = window.open(printUrl, "_blank", "width=400,height=600");
    if (!w) throw new Error("Không thể mở cửa sổ in");
    console.log("[PrintService] 🧾 Mở file in:", printUrl);
  } catch (err) {
    console.error("[PrintService] ❌ Lỗi in:", err);
    alert("Không thể in hóa đơn: " + (err.message || err));
  }
}

}
