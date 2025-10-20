import escpos from "escpos";
escpos.USB = require("escpos-usb");

export default class UsbPrinter {
  constructor() {
    try {
      this.device = new escpos.USB();
      this.printer = new escpos.Printer(this.device);
    } catch (e) {
      console.error("[UsbPrinter] Không tìm thấy thiết bị:", e);
    }
  }

  async print(text) {
    return new Promise((resolve, reject) => {
      if (!this.device) return reject("Chưa kết nối USB printer");
      this.device.open(() => {
        this.printer
          .align("ct")
          .text(text)
          .cut()
          .close();
        resolve("In thành công");
      });
    });
  }
}
