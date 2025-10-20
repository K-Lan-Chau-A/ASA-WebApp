export default class LanPrinter {
  constructor(ip = "192.168.1.107", port = 9100) {
    this.ip = ip;
    this.port = port;
  }

  async print(text) {
    // ⚙️ Nếu đang chạy trong browser → fallback sang window.print()
    if (typeof window !== "undefined" && !window.process?.versions?.electron) {
      console.warn("[LanPrinter] Chạy trong browser, chuyển sang in trình duyệt");
      return this._browserPrint(text);
    }

    // ⚠️ Nếu có Electron thì xử lý qua ipcMain
    if (window?.printer?.lanPrint) {
      return await window.printer.lanPrint({ text, ip: this.ip, port: this.port });
    }

    throw new Error("LanPrinter không khả dụng trong môi trường này.");
  }

  // 🧾 In bằng cửa sổ trình duyệt
  _browserPrint(text) {
    const html = `
      <html>
      <head>
        <title>Hóa đơn</title>
        <style>
          body { font-family: monospace; font-size: 13px; margin: 0; padding: 12px; }
          .center { text-align: center; }
          .line { border-top: 1px dashed #000; margin: 4px 0; }
        </style>
      </head>
      <body>
        <div class="center">${text.replace(/\n/g, "<br/>")}</div>
      </body>
      </html>
    `;
    const w = window.open("", "", "width=400,height=600");
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
    return Promise.resolve("Đã in qua trình duyệt");
  }
}
