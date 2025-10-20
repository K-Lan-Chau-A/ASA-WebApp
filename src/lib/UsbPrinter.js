export default class UsbPrinter {
  constructor(config = {}) {
    this.config = config;
  }

  async print(text) {
    if (typeof window !== "undefined" && !window.process?.versions?.electron) {
      console.warn("[UsbPrinter] Chạy trong browser, chuyển sang in trình duyệt");
      return this._browserPrint(text);
    }

    if (window?.printer?.usbPrint) {
      return await window.printer.usbPrint(text);
    }

    throw new Error("UsbPrinter không khả dụng trong môi trường này.");
  }

  _browserPrint(text) {
    const html = `
      <html><head><title>Hóa đơn</title>
      <style>body{font-family:monospace;font-size:13px;margin:0;padding:12px;}</style>
      </head><body>${text.replace(/\n/g,"<br/>")}</body></html>`;
    const w = window.open("", "", "width=400,height=600");
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
    return Promise.resolve("Đã in qua trình duyệt");
  }
}
