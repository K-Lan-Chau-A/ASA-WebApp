import net from "net";

export default class LanPrinter {
  constructor(ip = "192.168.1.100", port = 9100) {
    this.ip = ip;
    this.port = port;
  }

  async print(text) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.connect(this.port, this.ip, () => {
        socket.write(text, "utf8", () => {
          socket.end();
          resolve("In qua LAN thành công");
        });
      });
      socket.on("error", (err) => reject(err));
    });
  }
}
