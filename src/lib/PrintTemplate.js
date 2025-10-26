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
    out += `Thành tiền:          ${fmt.format(grandTotal)} đ\n`; c 
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
static async buildReceiptHTML(order, shop = null) {
  if (!shop) shop = await this.getShopInfo();
  const fmt = new Intl.NumberFormat("vi-VN");
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN");
  const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  const payLabel =
    order.method === "cash" ? "TIỀN MẶT" :
    order.method === "qr" ? "CHUYỂN KHOẢN" :
    order.method === "nfc" ? "NFC" :
    order.method === "atm" ? "ATM" : "KHÁC";

  const received = order.method === "cash"
    ? (order.received > 0 ? order.received : order.total)
    : null;
  const change = order.method === "cash"
    ? Math.max(0, (received || order.total) - order.total)
    : null;

 const qrUrl =
  order.qrUrl ||
  shop.qrcode ||
  `https://img.vietqr.io/image/${shop.bankCode }-${shop.bankAccount}-compact2.png?amount=${order.total}&addInfo=Order%20${order.id}&accountName=${encodeURIComponent(shop.name)}&size=600`;
   
  return `
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: 80mm auto; margin: 0; }
    body { font-family: 'Arial', sans-serif; width: 80mm; margin: 0; padding: 6px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-bottom: 1px dashed #000; margin: 6px 0; }
    .right { text-align: right; }
    .small { font-size: 12px; color: #555; }
    .note { font-style: italic; color: #666; font-size: 12px; margin-top: 2px; }
    .noprint { margin-top: 10px; text-align: center; }
    .noprint button {
      background: #009DA5;
      color: #fff;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
    }
    @media print {
      .noprint { display: none; }
    }
    .discount {
      text-decoration: line-through;
      color: #888;
      margin-right: 4px;
    }
    .item {
      margin-bottom: 6px;
    }
    .item-header {
      font-size: 14px;
      color: #000;
    }
    .item-line {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-top: 2px;
    }
    .item-line div {
      text-align: center;
      flex: 1;
    }
    .item-line div:first-child { text-align: left; }
    .item-line div:last-child { text-align: right; }
    .table-header {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .table-header div {
      flex: 1;
      text-align: center;
    }
    .table-header div:first-child { text-align: left; }
    .table-header div:last-child { text-align: right; }
    .qr-box {
  text-align: center;
  margin-top: 10px;
}

.qr-box img {
  width: 200px;          
  height: auto;           
  display: block;
  margin: 0 auto;
}

  </style>
</head>
<body>
  <div class="center">
    <h2>${shop.name.toUpperCase()}</h2>
    <div>${shop.address}</div>
    <div>${shop.phone ? `Hotline: ${shop.phone}` : ""}</div>
  </div>

  <div class="line"></div>
  <div>Mã hóa đơn: <b>#${order.id || "000"}</b></div>
  <div>Thời gian: ${dateStr} ${timeStr}</div>
  ${order.customerName ? `<div>Khách hàng: ${order.customerName}</div>` : ""}
  ${order.customerPhone ? `<div>Điện thoại: ${order.customerPhone}</div>` : ""}
  ${order.note ? `<div class="note">Ghi chú đơn: ${order.note}</div>` : ""}
  <div class="line"></div>

  <!-- 🔹 Header bảng sản phẩm -->
  <div class="table-header">
    <div>Đơn giá</div>
    <div>SL</div>
    <div>Đơn vị</div>
    <div>Thành tiền</div>
  </div>

  <!-- 🔹 Danh sách sản phẩm -->
  <div>
    ${(order.items || []).map(it => `
      <div class="item">
        <div class="item-header">${it.name}</div>
        <div class="item-line">
          <div>
            ${
              it.discountPrice && it.discountPrice < it.price
                ? `<span class="discount">${fmt.format(it.price)}đ</span> ${fmt.format(it.discountPrice)}đ`
                : `${fmt.format(it.price)}đ`
            }
          </div>
          <div>x${it.qty}</div>
          <div>${it.unit || "-"}</div>
          <div>${fmt.format((it.discountPrice || it.price) * it.qty)}đ</div>
        </div>
        ${it.note ? `<div class="note">• ${it.note}</div>` : ""}
      </div>
    `).join("")}
  </div>

  <div class="line"></div>
  <table style="width:100%;font-size:13px;">
    <tr><td>Tổng cộng:</td><td class="right">${fmt.format(order.total + (order.discount || 0))} đ</td></tr>
    ${order.discount ? `<tr><td>Giảm giá:</td><td class="right">-${fmt.format(order.discount)} đ</td></tr>` : ""}
    <tr><td class="bold">Thành tiền:</td><td class="right bold">${fmt.format(order.total)} đ</td></tr>
  </table>

  <div class="line"></div>
  <div class="center">
    <div>Phương thức: <b>${payLabel}</b></div>
    ${
      order.method === "cash"
        ? `<div>Tiền khách đưa: ${fmt.format(received)} đ</div>
           <div>Tiền thừa: ${fmt.format(change)} đ</div>`
        : order.method === "qr" && qrUrl
        ? `<div class="qr-box">
             <p class="small">Vui lòng quét mã QR để thanh toán</p>
             <img src="${qrUrl}" alt="QR Code" />
           </div>`
        : ""
    }
  </div>

  <div class="line"></div>
  <div class="center">
    <div>Thu ngân: ${order.cashierName || "NV001"}</div>
    <p><b>CẢM ƠN QUÝ KHÁCH!</b></p>
    <p>Powered by ASA POS</p>
  </div>

  <div class="noprint">
    <button onclick="window.print()">🖨️ In hóa đơn</button>
  </div>
</body>
</html>`;
}

}
