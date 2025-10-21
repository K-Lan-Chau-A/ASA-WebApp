import LanPrinter from "@/lib/LanPrinter";
import UsbPrinter from "@/lib/UsbPrinter";
import PrintTemplate from "@/lib/PrintTemplate";

export default class PrintService {
  constructor(mode = "auto", config = {}) {
    // 🔍 Xác định môi trường
    if (typeof window !== "undefined" && !window.process?.versions?.electron) {
      this.env = "web";
      console.log("[PrintService] 🌐 Running in browser mode");
    } else {
      this.env = "electron";
      console.log("[PrintService] ⚙️ Running in Electron/Node mode");
    }

    // 🔹 Chọn driver theo mode
    if (mode === "usb") {
      this.driver = new UsbPrinter(config);
    } else if (mode === "lan") {
      this.driver = new LanPrinter(config.ip || "192.168.1.107", config.port || 9100);
    } else {
      // Auto detect
      this.driver =
        navigator.usb || navigator.serial
          ? new UsbPrinter(config)
          : new LanPrinter(config.ip || "192.168.1.107", config.port || 9100);
    }
  }

  async printOrder(order, shop = null) {
    try {
      const text = await PrintTemplate.buildReceipt(order, shop);

      // 🌐 Trình duyệt → In qua popup
      if (this.env === "web") {
        const html = `
          <html><head><style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: monospace; width: 80mm; padding: 4px; 
                   line-height: 1.3; font-size: 13px; white-space: pre; }
          </style></head>
          <body>${text.replace(/\n/g, "<br>")}</body>
          <script>
            window.onload = () => { 
              window.print(); 
              setTimeout(() => window.close(), 400); 
            };
          </script>
          </html>`;
        const w = window.open("", "_blank", "width=400,height=600");
        if (!w) throw new Error("Không thể mở cửa sổ in.");
        w.document.write(html);
        w.document.close();
        return;
      }

      // ⚙️ Electron hoặc Node
      const result = await this.driver.print(text);
      console.log("[PrintService] ✅ Printed via driver:", result);
      return result;
    } catch (err) {
      console.error("[PrintService] ❌ Print error:", err);
      alert("Không thể in hóa đơn: " + (err.message || err));
    }
  }
}
