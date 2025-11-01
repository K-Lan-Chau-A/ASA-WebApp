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

      const shopRaw = Array.isArray(data.items)
        ? data.items[0]
        : data.item || data || null;
      if (!shopRaw || !shopRaw.shopId)
        throw new Error("Không tìm thấy dữ liệu shop.");

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
  /* ---------- Lấy thông tin nhân viên hiện đang đăng nhập ---------- */
  static async getCashierName() {
    try {
      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const token = localStorage.getItem("accessToken");
      if (!profile?.userId || !profile?.shopId || !token)
        throw new Error("Thiếu userId hoặc shopId.");

      const cached = localStorage.getItem("cashierInfo");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.userId === profile.userId) return parsed.fullName;
      }

      const res = await fetch(
        `${API_URL}/api/users?ShopId=${profile.shopId}&page=1&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();
      const list = Array.isArray(data.items) ? data.items : [];
      const current = list.find((u) => u.userId === profile.userId);
      const fullName =
        current?.fullName || current?.username || `User #${profile.userId}`;

      localStorage.setItem(
        "cashierInfo",
        JSON.stringify({ userId: profile.userId, fullName })
      );

      return fullName;
    } catch (e) {
      console.warn("[PrintTemplate] ⚠️ getCashierName:", e.message);
      return "Nhân viên";
    }
  }

  static async getCustomerInfo(customerId) {
    if (!customerId) return null;
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(
        `${API_URL}/api/customers?CustomerId=${customerId}`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      const raw = Array.isArray(data.items) ? data.items[0] : data;
      return {
        name: raw.fullName || raw.name || "",
        phone: raw.phoneNumber || "",
        address: raw.address || "",
      };
    } catch (e) {
      console.warn("[PrintTemplate] ⚠️ getCustomerInfo:", e.message);
      return null;
    }
  }

  static async buildReceipt(order, shop = null) {
    if (order.customerId && !order.customerName) {
      const customer = await this.getCustomerInfo(order.customerId);
      if (customer) {
        order.customerName = customer.name;
        order.customerPhone = customer.phone;
        order.customerAddress = customer.address;
      }
    }

    if (!shop) shop = await this.getShopInfo();

    const fmt = new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

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
    if (order.customerName) {
      out += `Khách hàng: ${order.customerName}\n`;
      if (order.customerPhone) out += `SĐT: ${order.customerPhone}\n`;
      if (order.customerAddress) out += `Địa chỉ: ${order.customerAddress}\n`;
    } else {
      out += `Khách hàng: Khách lẻ\n`;
    }
    out += line + "\n";

    // ===== DANH SÁCH SẢN PHẨM =====
    out += "Tên món\n";
    out += "   Đ.Giá           SL        T.Tiền\n";
    out += line + "\n";

    (order.items || []).forEach((it) => {
      const name = (it.name || "").substring(0, 32);
      out += `${name}\n`;

      const base = Number(it.basePrice || it.unitPrice || it.price || 0);
      const promo = Number(it.promotionValue || it.discountValue || 0);
      const price = Math.max(0, base - promo);

      const qty = String(it.qty).padStart(4, " ");
      const total = fmt.format(price * it.qty).padStart(10, " ");
      out += `${fmt.format(price)}       x${qty}   =${total}\n`;

      if (it.note) out += `  • ${it.note}\n`;

      out += line + "\n";
    });

    // ===== TỔNG KẾT =====
    const itemCount = (order.items || []).reduce((s, i) => s + i.qty, 0);
    const subTotal = (order.items || []).reduce(
      (s, i) => s + Number(i.price || i.basePrice || 0) * Number(i.qty || 0),
      0
    );

    const voucherValue = order.voucherValue || 0; // ✅ giảm tiền từ voucher
    const manualDiscountPercent = order.discount || 0; // ✅ chiết khấu tay %
    const manualDiscountValue =
      manualDiscountPercent > 0
        ? Math.round((subTotal * manualDiscountPercent) / 100)
        : 0;
    const cachedRank = JSON.parse(localStorage.getItem("rankInfo") || "{}");
    if (!order.rankName && cachedRank.rankName) {
      order.rankName = cachedRank.rankName;
      order.rankBenefit = cachedRank.rankBenefit;
    }
    // ==== Ưu đãi hạng thành viên ====
    const rankBenefit = Number(order.rankBenefit || 0); // 0.1 = 10%
    const rankName = order.rankName || "";
    const rankDiscountValue =
      rankBenefit > 0 ? Math.round(subTotal * rankBenefit) : 0;

    // ==== Tổng giảm ====
    const totalDiscount =
      voucherValue + manualDiscountValue + rankDiscountValue;
    const grandTotal = subTotal - totalDiscount;

    out += `Tổng sản phẩm: ${itemCount}\n`;
    out += `Tổng cộng:           ${fmt.format(subTotal)} đ\n`;

    if (order.voucherCode && voucherValue > 0) {
      out += `Mã giảm giá: ${order.voucherCode}\n`;
      out += `Giảm voucher: -${fmt.format(voucherValue)} đ\n`;
    }

    if (manualDiscountPercent > 0) {
      out += `Chiết khấu: ${manualDiscountPercent}% (-${fmt.format(manualDiscountValue)} đ)\n`;
    }
    if (rankBenefit > 0) {
      out += `Ưu đãi hạng: ${rankName} (-${fmt.format(rankDiscountValue)} đ)\n`;
    }

    if (totalDiscount > 0) {
      out += `Tổng giảm:          -${fmt.format(totalDiscount)} đ\n`;
    }

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
      const total = Number(order.totalAfter ?? order.total ?? 0);
      const received = Number(order.received ?? total);
      const change = Math.max(0, received - total);

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
    if (order.customerId && !order.customerName) {
      const customer = await this.getCustomerInfo(order.customerId);
      if (customer) {
        order.customerName = customer.name;
        order.customerPhone = customer.phone;
        order.customerAddress = customer.address;
      }
    }
    const cashierName = await PrintTemplate.getCashierName();
    order.cashierName = cashierName;

    if (!shop) shop = await this.getShopInfo();
    const fmt = new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString("vi-VN");
    const timeStr = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

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

    const total = Number(order.totalAfter ?? order.total ?? 0);
    const received =
      order.method === "cash"
        ? Number(order.received) > 0
          ? Number(order.received)
          : total
        : null;
    const change =
      order.method === "cash" ? Math.max(0, Number(received) - total) : null;

    // ==== TÍNH TOÁN GIẢM GIÁ ====
    const subTotal = (order.items || []).reduce(
      (s, i) => s + i.price * i.qty,
      0
    );
    const voucherValue = order.voucherValue || 0;
    const manualDiscountPercent = order.discount || 0;
    const manualDiscountValue =
      manualDiscountPercent > 0
        ? Math.round((subTotal * manualDiscountPercent) / 100)
        : 0;
    // ==== Ưu đãi hạng thành viên ====
    const rankBenefit = Number(order.rankBenefit || 0);
    const rankName = order.rankName || "";
    const rankDiscountValue =
      rankBenefit > 0 ? Math.round(subTotal * rankBenefit) : 0;

    // ==== Tổng giảm ====
    const totalDiscount =
      voucherValue + manualDiscountValue + rankDiscountValue;
    const grandTotal = subTotal - totalDiscount;

    const qrUrl =
      order.qrUrl ||
      shop.qrcode ||
      `https://img.vietqr.io/image/${shop.bankCode}-${shop.bankAccount}-compact2.png?amount=${order.total}&addInfo=Order%20${order.id}&accountName=${encodeURIComponent(shop.name)}&size=600`;

    // ======== HTML HÓA ĐƠN ========
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
    .discount { text-decoration: line-through; color: #888; margin-right: 4px; }
    .item { margin-bottom: 6px; }
    .item-header { font-size: 14px; color: #000; }
    .item-line { display: flex; justify-content: space-between; font-size: 13px; margin-top: 2px; }
    .item-line div { flex: 1; text-align: center; }
    .item-line div:first-child { text-align: left; }
    .item-line div:last-child { text-align: right; }
    .table-header { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-bottom: 4px; }
    .table-header div { flex: 1; text-align: center; }
    .table-header div:first-child { text-align: left; }
    .table-header div:last-child { text-align: right; }
    .qr-box { text-align: center; margin-top: 10px; }
    .qr-box img { width: 200px; height: auto; display: block; margin: 0 auto; }
    .noprint { margin-top: 10px; text-align: center; }
    .noprint button {
      background: #009DA5; color: #fff; border: none;
      padding: 6px 12px; border-radius: 4px;
      font-weight: bold; cursor: pointer;
    }
    @media print { .noprint { display: none; } }
  </style>
</head>
<body>
  <div class="center">
    <h2>${shop.name.toUpperCase()}</h2>
    <div>${shop.address}</div>
    ${shop.phone ? `<div>Hotline: ${shop.phone}</div>` : ""}
  </div>

  <div class="line"></div>
  <div>Mã hóa đơn: <b>#${order.id || "000"}</b></div>
  <div>Thời gian: ${dateStr} ${timeStr}</div>
  ${
    order.customerName
      ? `<div><b>Khách hàng:</b> ${order.customerName}</div>
         ${order.customerPhone ? `<div>Điện thoại: ${order.customerPhone}</div>` : ""}
         ${order.customerAddress ? `<div>Địa chỉ: ${order.customerAddress}</div>` : ""}`
      : `<div><b>Khách hàng:</b> Khách lẻ</div>`
  }

  ${
    order.note
      ? (() => {
          const notes = order.note
            .split("|")
            .map((n) => n.trim())
            .filter((v, i, a) => v && a.indexOf(v) === i);
          return `
          <div class="line"></div>
          <div class="note">
            📝 <b>Ghi chú đơn hàng:</b><br>
            ${notes.map((n) => `• ${n}`).join("<br>")}
          </div>`;
        })()
      : ""
  }

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
    ${(order.items || [])
      .map((it) => {
        const base = Number(it.basePrice || it.unitPrice || it.price || 0);
        const promo = Number(it.promotionValue || it.discountValue || 0);
        const final = Math.max(0, base - promo);

        const rawNote = String(it.note || "").trim();
        const globalNote = String(order.note || "").trim();
        const hasVoucher = !!order.voucherCode;
        const isVoucherNt =
          hasVoucher &&
          rawNote
            .toLowerCase()
            .includes(String(order.voucherCode).toLowerCase());
        const isGlobalDup = !!rawNote && !!globalNote && rawNote === globalNote;

        const itemNote = !rawNote || isVoucherNt || isGlobalDup ? "" : rawNote;

        return `
        <div class="item">
          <div class="item-header">${it.name}</div>
          <div class="item-line">
            <div>${
              promo > 0
                ? `<span class="discount">${fmt.format(base)}đ</span> ${fmt.format(final)}đ`
                : `${fmt.format(final)}đ`
            }</div>
            <div>x${it.qty}</div>
            <div>${it.unit || "-"}</div>
            <div>${fmt.format(final * it.qty)}đ</div>
          </div>
          ${itemNote ? `<div class="note">• ${itemNote}</div>` : ""}
        </div>`;
      })
      .join("")}
  </div>


  <div class="line"></div>
  <table style="width:100%;font-size:13px;">
    <tr><td>Tổng cộng:</td><td class="right">${fmt.format(subTotal)} đ</td></tr>
    ${
      order.voucherCode && voucherValue > 0
        ? `<tr><td>Mã giảm giá:</td><td class="right">${order.voucherCode}</td></tr>
           <tr><td>Giảm voucher:</td><td class="right">-${fmt.format(voucherValue)} đ</td></tr>`
        : ""
    }
    ${
      manualDiscountPercent > 0
        ? `<tr><td>Chiết khấu:</td><td class="right">${manualDiscountPercent}% (-${fmt.format(manualDiscountValue)} đ)</td></tr>`
        : ""
    }
    ${
      rankBenefit >= 0
        ? `<tr>
        <td>Ưu đãi hạng (${rankName || "Thành viên"}):</td>
        <td class="right">
          ${rankBenefit > 0 ? `-${fmt.format(rankDiscountValue)} đ` : "0 đ"}
          <span class="small">(${(rankBenefit * 100).toFixed(0)}%)</span>
        </td>
      </tr>`
        : ""
    }

${
  order.discountPercent > 0
    ? `<tr>
         <td>Chiết khấu (${order.discountPercent}%):</td>
         <td class="right">-${fmt.format(order.discountValue || 0)} đ</td>
       </tr>`
    : ""
}

    ${
      totalDiscount > 0
        ? `<tr><td>Tổng giảm:</td><td class="right">-${fmt.format(totalDiscount)} đ</td></tr>`
        : ""
    }
    <tr><td class="bold">Thành tiền:</td><td class="right bold">${fmt.format(grandTotal)} đ</td></tr>
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
    <div>Thu ngân: ${order.cashierName || order.staffName || "NV001"}</div>
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
