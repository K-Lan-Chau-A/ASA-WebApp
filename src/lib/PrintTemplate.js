import API_URL from "@/config/api";

export default class PrintTemplate {
  static async getShopInfo() {
    try {
      const cached = localStorage.getItem("shopInfo");
      if (cached) return JSON.parse(cached);

      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const token = localStorage.getItem("accessToken");
      if (!profile.shopId) throw new Error("Không tìm thấy shopId.");

      const res = await fetch(`${API_URL}/api/shops?ShopId=${profile.shopId}`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

      const shopRaw = Array.isArray(data.items) ? data.items[0] : null;
      if (!shopRaw) throw new Error("Không tìm thấy dữ liệu shop.");

      const shop = {
        id: shopRaw.shopId,
        name: shopRaw.shopName || "Cửa hàng của bạn",
        branch: shopRaw.branchName || "",
        address: shopRaw.address || "Chưa có địa chỉ",
        phone: shopRaw.phoneNumber || "",
        wifi: shopRaw.wifiPassword || "",
        qrcode: shopRaw.qrcodeUrl || "",
      };

      localStorage.setItem("shopInfo", JSON.stringify(shop));
      return shop;
    } catch (e) {
      console.warn("[PrintTemplate] ⚠️ getShopInfo:", e.message);
      return { name: "Cửa hàng của bạn", address: "Chưa có địa chỉ" };
    }
  }

  static async buildReceipt(order, shop = null) {
    if (!shop) shop = await this.getShopInfo();

    const fmt = new Intl.NumberFormat("vi-VN");
    const now = new Date();
    const dateStr = now.toLocaleDateString("vi-VN");
    const timeStr = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const line = "----------------------------------------";

    let out = "";

    // ===== HEADER =====
    out += "\n";
    out += `           ${shop.name.toUpperCase()}\n`;
    out += line + "\n";
    out += `ORDER #${String(order.id ?? "000").padStart(3, "0")}\n`;
    out += `${shop.address}\n`;
    out += `Hotline: ${shop.phone || ""}\n`;
    out += line + "\n";

    // ===== THÔNG TIN HÓA ĐƠN =====
    const invoiceNo = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}${order.id ?? "0000"}`;
    out += `Thời gian đặt hàng: ${dateStr} ${timeStr}\n`;
    out += line + "\n";

    // ===== DANH SÁCH SẢN PHẨM =====
    out += "Tên món\n";
    out += "   Đ.Giá           SL        T.Tiền\n";
    out += line + "\n";

    (order.items || []).forEach((it) => {
      // 🧾 Dòng 1: Tên sản phẩm
      const name = (it.name || "").substring(0, 32); // vừa khổ 80mm
      out += `${name}\n`;

      // 💰 Dòng 2: Giá - SL - Tổng
      const price = fmt.format(it.price).padStart(8, " ");
      const qty = String(it.qty).padStart(4, " ");
      const total = fmt.format(it.price * it.qty).padStart(10, " ");
      out += `${price}       x${qty}   =${total}\n`;

      // 📝 Dòng ghi chú (nếu có)
      if (it.note) out += `  • ${it.note}\n`;

      out += line + "\n";
    });

    // ===== TỔNG KẾT =====
    const itemCount = (order.items || []).reduce((s, i) => s + i.qty, 0);
    const subTotal = order.total || 0;
    const discount = order.discount || 0;
    const grandTotal = subTotal - discount;

    out += `Tổng sản phẩm: ${itemCount}\n`;
    out += `Tổng cộng:           ${fmt.format(subTotal)} đ\n`;
    if (discount > 0)
      out += `Giảm giá:            -${fmt.format(discount)} đ\n`;
    out += `Thành tiền:          ${fmt.format(grandTotal)} đ\n`;
    out += line + "\n";
    const payLabel =
  order.method === "cash"
    ? "TIỀN MẶT"
    : order.method === "qr"
    ? "CHUYỂN KHOẢN"
    : order.method === "nfc"
    ? "NFC"
    : order.method === "atm"
    ? "ATM"
    : "KHÁC";

out += `Phương thức: ${payLabel}\n`;

if (order.method === "cash") {
  const received =
    order.received != null ? order.received : order.total;
  const change =
    order.change != null ? order.change : Math.max(0, received - order.total);

  out += `Tiền khách đưa:     ${fmt.format(received)} đ\n`;
  out += `Tiền thừa:          ${fmt.format(change)} đ\n`;
}

    // ===== FOOTER =====
    out += "\n";
    out += `Thu ngân: ${order.cashierName || "NV001"}\n`;
    out += `Thời gian in: ${dateStr} ${timeStr}\n`;
    out += line + "\n";
    out += "Cảm ơn quý khách và hẹn gặp lại!\n";
    out += "Thank you for your purchase!\n";
    out += "Powered by ASA POS\n";
    out += "\n\n";

    return out;
  }
}
