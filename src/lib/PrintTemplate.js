import API_URL from "@/config/api";

export default class PrintTemplate {
  /**
   * 🔹 Lấy thông tin cửa hàng từ localStorage (đã có khi login)
   * Không cần gọi lại API /api/shops/:id
   */
  static async getShopInfo() {
    try {
      // Ưu tiên cache trong localStorage
      const cache = localStorage.getItem("cachedShopInfo");
      if (cache) return JSON.parse(cache);

      // Lấy profile khi login
      const profile = JSON.parse(localStorage.getItem("userProfile") || "null");
      if (!profile) throw new Error("Không tìm thấy thông tin đăng nhập.");

      // Tạo đối tượng shop
      const shop = {
        id: profile.shopId || 0,
        name: profile.shopName || "Cửa hàng của bạn",
        branch: profile.branchName || "",
        address: profile.shopAddress || "Chưa có địa chỉ",
        phone: profile.phoneNumber || "",
        wifi: profile.wifiPassword || "",
      };

      // Lưu cache để dùng lần sau
      localStorage.setItem("cachedShopInfo", JSON.stringify(shop));
      return shop;
    } catch (e) {
      console.warn("[PrintTemplate] ⚠️ getShopInfo:", e.message);
      return {
        name: "Cửa hàng của bạn",
        branch: "",
        address: "Chưa có địa chỉ",
        phone: "",
        wifi: "",
      };
    }
  }

  /**
   * 🔹 Tạo nội dung hóa đơn 80mm
   */
  static async buildReceipt(order, shop = null) {
    if (!shop) shop = await this.getShopInfo();

    const fmt = new Intl.NumberFormat("vi-VN");
    const now = new Date();
    const dateStr = now.toLocaleDateString("vi-VN");
    const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const line = "------------------------------------------";

    let out = "";
    out += "\n";
    out += `           🐼 ${shop.name.toUpperCase()}\n`;
    if (shop.branch) out += `       ${shop.branch}\n`;
    out += `Địa chỉ: ${shop.address}\n`;
    if (shop.phone) out += `Hotline: ${shop.phone}\n`;
    out += "\n";
    out += "        HÓA ĐƠN THANH TOÁN\n";
    out += `Số HĐ: ${(order.id?.toString().padStart(6, "0")) || "000000"}\n`;
    out += line + "\n";

    out += `Ngày: ${dateStr}   Giờ: ${timeStr}\n`;
    out += `Phương thức: ${order.method || "Tiền mặt"}\n`;
    out += `Khách hàng: ${order.customerName || "Khách lẻ"}\n`;
    out += line + "\n";

    // Danh sách món
    out += "STT  TÊN MÓN              SL   Đ.GIÁ   T.TIỀN\n";
    out += line + "\n";
    (order.items || []).forEach((it, i) => {
      const name = (it.name || "").substring(0, 18).padEnd(18, " ");
      const qty = String(it.qty).padStart(2, " ");
      const price = fmt.format(it.price).padStart(7, " ");
      const total = fmt.format(it.price * it.qty).padStart(8, " ");
      out += `${(i + 1).toString().padEnd(3, " ")} ${name}${qty}${price}${total}\n`;
      if (it.note) out += `     - ${it.note}\n`;
    });

    out += line + "\n";
    out += `Tổng cộng:            ${fmt.format(order.total)} đ\n`;
    if (order.discount) out += `Giảm giá:             -${fmt.format(order.discount)} đ\n`;
    out += line + "\n";
    out += `Thành tiền:           ${fmt.format(order.total - (order.discount || 0))} đ\n`;
    out += line + "\n";

    // Footer
    out += `+Thanh toán (${order.method || "Tiền mặt"})\n`;
    if (shop.wifi) out += `PASS WIFI: ${shop.wifi}\n`;
    out += "Nhà hàng chỉ xuất bill hóa đơn GTGT\n";
    out += "tại thời điểm thanh toán.\n\n";
    out += "Bills or invoices are only issued at\n";
    out += "the time of payment.\n";
    out += "Cảm ơn quý khách và hẹn gặp lại!\n";
    out += "Thank you and see you again!\n";
    out += line + "\n";
    out += "Đối tác công nghệ: ASA POS\n";
    out += "Powered by asa-pos.vn\n";
    out += "\n\n\n";
    return out;
  }
}
