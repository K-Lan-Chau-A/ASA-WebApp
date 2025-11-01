import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import API_URL from "@/config/api";
import PrintService from "@/services/PrintService";
import PrintTemplate from "@/lib/PrintTemplate";

import { toast } from "@/components/ui/use-toast";

const fmt = new Intl.NumberFormat("vi-VN");

const DEBUG = true;
const log = (m, ...a) =>
  DEBUG &&
  console.log(
    `%c[Payment]%c ${m}`,
    "color:#06b6d4;font-weight:700",
    "color:inherit",
    ...a
  );
const warn = (m, ...a) =>
  DEBUG &&
  console.warn(
    `%c[Payment]%c ${m}`,
    "color:#f59e0b;font-weight:700",
    "color:inherit",
    ...a
  );
const err = (m, ...a) =>
  console.error(
    `%c[Payment]%c ${m}`,
    "color:#ef4444;font-weight:700",
    "color:inherit",
    ...a
  );

const PAY_TABS = [
  { id: "cash", label: "1: Tiền mặt" },
  { id: "qr", label: "2: Chuyển khoản" },
  { id: "nfc", label: "3: NFC" },
  { id: "atm", label: "4: ATM" },
];

const METHOD_MAP = { cash: 1, qr: 2, nfc: 3, atm: 4 };

class PaymentPageClass extends React.Component {
  state = {
    orderId: this.props.location?.state?.orderId || 0,
    payMethodId: this.props.location?.state?.paymentMethod ?? null,
    note: this.props.location?.state?.note || "",
    orders: Array.isArray(this.props.location?.state?.orders)
      ? this.props.location.state.orders
      : [],
    customerId: this.props.location?.state?.customerId ?? null,
    customerName: this.props.location?.state?.customerName || "",
    presetTotal: Number(this.props.location?.state?.total || 0),

    activeTab: this.props.defaultMethod || "cash",
    displayOrderId: null,

    received: 0,
    quicks: [20000, 50000, 100000, 200000],

    loading: false,
    error: "",

    qrUrl: "",
    qrLoading: false,
    qrError: "",

    toastMsg: "",

    voucherCode: "",
    voucherInfo: null,
    voucherDiscount: 0,
    manualDiscountPercent: 0,
    isSendInvoice: false,
  };

  _isPaid = false;
  _didSetStatus2 = false;
  visHandlerBound = null;
  popHandlerBound = null;

  componentDidMount() {
    const cached = localStorage.getItem("lastOrderCache");
    let parsed = null;

    if (cached) {
      parsed = JSON.parse(cached);
      const orders = (parsed.orders || []).map((o) => ({
        ...o,
        basePrice: Number(o.basePrice || o.price || 0),
        price: Number(o.price || 0),
        promotionValue: Number(o.promotionValue || 0),
      }));
      this.setState({
        orders,
        total: parsed.total || 0,
        customerId: parsed.customer?.customerId || null,
        customerName: parsed.customer?.fullName || "Khách lẻ",
        note: parsed.note || "",
      });
    }

    // ✅ di chuyển ra ngoài, thêm kiểm tra parsed != null
    if (parsed?.customer?.customerId) {
      this.fetchCustomerRankBenefit(parsed.customer.customerId);
    }
  }

  componentWillUnmount() {
    this.stopPolling();
    document.removeEventListener("visibilitychange", this.visHandlerBound);
    window.removeEventListener("popstate", this.popHandlerBound);

    this.putStatus2().catch(() => {});
  }

  async componentDidUpdate(prevProps) {
    const prevMethod =
      new URLSearchParams(prevProps.location?.search || "").get("method") ||
      "cash";
    const nowMethod =
      new URLSearchParams(this.props.location?.search || "").get("method") ||
      "cash";
    if (prevMethod !== nowMethod && nowMethod !== this.state.activeTab) {
      this.setState({ activeTab: nowMethod }, () => {
        if (nowMethod === "qr") this.initQRFlow();
        else this.stopPolling();
      });
    }
  }
  async applyVoucher() {
    const { voucherCode } = this.state;
    if (!voucherCode.trim()) {
      return this.showToast("⚠️ Vui lòng nhập mã voucher");
    }

    const token = localStorage.getItem("accessToken") || "";
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const shopId = profile.shopId || 0;
    if (!shopId) {
      return this.showToast("⚠️ Không tìm thấy ShopId");
    }

    try {
      const url = `${API_URL}/api/vouchers?Code=${encodeURIComponent(
        voucherCode
      )}&ShopId=${shopId}`;
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

      const voucher = Array.isArray(data.items) ? data.items[0] : data;
      if (!voucher) throw new Error("Không tìm thấy voucher.");

      const now = new Date();
      const expiredAt = new Date(voucher.expired);
      if (now > expiredAt) throw new Error("Voucher đã hết hạn.");

      const discountPercent =
        voucher.type === 2 ? Number(voucher.value || 0) : 0;
      const discountValue =
        voucher.type === 1
          ? Number(voucher.value || 0)
          : (this.subtotal() * discountPercent) / 100;

      this.setState({
        voucherInfo: {
          ...voucher,
          discountType: voucher.type === 1 ? "fixed" : "percent",
          discountValue: voucher.type === 1 ? voucher.value : discountPercent,
        },
        voucherDiscount: discountValue,
      });

      this.showToast(
        `🎉 Áp dụng mã ${voucher.code} thành công! Giảm ${
          voucher.type === 1
            ? fmt.format(voucher.value) + "đ"
            : voucher.value + "%"
        }`
      );
    } catch (e) {
      console.warn("applyVoucher failed:", e.message);
      this.showToast("❌ Mã không hợp lệ hoặc đã hết hạn");
      this.setState({ voucherInfo: null, discount: 0 });
    }
  }

  /* ---------- Utils ---------- */
  safeParse = async (res) => {
    try {
      return await res.json();
    } catch {
      const t = await res.text().catch(() => "");
      try {
        return JSON.parse(t);
      } catch {
        return { raw: t };
      }
    }
  };

  subtotal = () =>
    (this.state.orders || []).reduce(
      (s, it) => s + Number(it.price || 0) * Number(it.qty || 0),
      0
    );

  normalizePaymentMethod = (raw) => {
    if (raw == null) return null;
    if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
    const map = {
      Cash: 1,
      BankTransfer: 2,
      NFC: 3,
      ATM: 4,
      cash: 1,
      qr: 2,
      nfc: 3,
      atm: 4,
      1: 1,
      2: 2,
      3: 3,
      4: 4,
    };
    return map[raw] ?? (Number(raw) || null);
  };

  // đọc cache từ localStorage
  getLastOrderCache() {
    try {
      const raw = JSON.parse(
        localStorage.getItem("lastOrderResponse") || "null"
      );
      if (!raw) return null;
      // có thể API trả { success, data: {...} } hoặc đã được gộp sẵn
      return raw.data ? raw.data : raw;
    } catch {
      return null;
    }
  }

  showToast = (msg, ms = 1600) => {
    this.setState({ toastMsg: msg });
    setTimeout(() => this.setState({ toastMsg: "" }), ms);
  };

  async showPaidAndGo() {
    this._isPaid = true;
    this.setState({
      customerId: null,
      customerSearch: "",
      foundCustomer: null,
      payMethodId: null,
    });

    const orderId = await this.createOrderIfNeeded();
    if (!orderId) return;

    const order = {
      id: orderId,
      total: this.subtotal(),
      items: this.state.orders || [],
      method: this.state.activeTab || "cash",
      qrUrl: this.state.qrUrl,
      received:
        this.state.activeTab === "cash"
          ? this.state.received > 0
            ? this.state.received
            : this.subtotal()
          : null,
      change:
        this.state.activeTab === "cash"
          ? Math.max(
              0,
              (this.state.received || this.subtotal()) - this.subtotal()
            )
          : null,
      isSendInvoice: false,
      note: this.state.note || "",
      customerId: this.state.customerId || null,
      customerName: this.state.customerName || "",
      customerPhone: this.state.customerPhone || "",
      discount:
        (this.state.voucherDiscount || 0) +
        (this.state.manualDiscountValue || 0),
      voucherInfo: this.state.voucherInfo || null,
    };

    // 🩵 FIX 1 — import động PrintTemplate
    const PrintTemplate = (await import("@/lib/PrintTemplate")).default;
    const shop = await PrintTemplate.getShopInfo();

    const printer = new PrintService("lan", {
      ip: "192.168.1.107",
      port: 9100,
    });
    await printer.printOrder(order, shop).catch((e) => {
      console.warn("[Payment] Lỗi in:", e.message);
      toast({
        title: "⚠️ In hóa đơn thất bại",
        description: "Trình duyệt chặn cửa sổ in hoặc không tìm thấy máy in.",
      });
    });

    // 🩵 FIX 2 — Dùng toast() đúng chuẩn
    toast({
      title: "✅ Thanh toán thành công!",
      description: `Đơn hàng #${orderId} đã được lưu và in hóa đơn.`,
      duration: 3000,
    });

    localStorage.setItem("resetCustomer", "1");
    setTimeout(() => this.props.navigate("/orders"), 800);
  }

  getAuthContext() {
    let profile = null;
    try {
      profile =
        JSON.parse(localStorage.getItem("userProfile") || "null") ||
        JSON.parse(localStorage.getItem("auth") || "null")?.profile ||
        null;
    } catch {}
    const shopId = Number(profile?.shopId || 0) || null;

    let shiftId = null;
    try {
      const auth = JSON.parse(localStorage.getItem("auth") || "null");
      if (auth?.currentShift?.shiftId != null)
        shiftId = Number(auth.currentShift.shiftId);
      if (!shiftId && auth?.shiftId != null) shiftId = Number(auth.shiftId);
    } catch {}
    if (!shiftId) {
      const cur = JSON.parse(localStorage.getItem("currentShift") || "null");
      if (cur?.shiftId != null) shiftId = Number(cur.shiftId);
    }
    return { shopId, shiftId };
  }

  async waitForOrderId(timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const oid = Number(this.state.orderId || this.state.displayOrderId || 0);
      if (oid > 0) return oid;
      await new Promise((r) => setTimeout(r, 100));
    }
    return 0;
  }
  async getOrWaitOrderId(timeoutMs = 3000) {
    let oid = this.state.orderId || 0;
    if (oid > 0) return oid;

    oid = await this.createOrderIfNeeded();
    if (oid > 0) return oid;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.state.orderId > 0) return this.state.orderId;
      await new Promise((r) => setTimeout(r, 100));
    }
    return 0;
  }

  async createOrderIfNeeded() {
    if (this.state.orderId && this.state.orderId > 0) {
      return this.state.orderId;
    }

    const token = localStorage.getItem("accessToken") || "";
    const { shopId, shiftId } = this.getAuthContext();

    if (!shopId || !shiftId) {
      this.showToast("⚠️ Thiếu thông tin ca làm việc hoặc cửa hàng");
      return null;
    }

    try {
      const payload = this.buildPayload();

      payload.status = 0;
      localStorage.removeItem("lastOrderResponse");
      localStorage.removeItem("lastOrderCache");

      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("[createOrderIfNeeded] response:", data);

      const newId =
        Number(data?.orderId) ||
        Number(data?.id) ||
        Number(data?.data?.orderId) ||
        Number(data?.data?.id) ||
        (Array.isArray(data?.items)
          ? Number(data.items[0]?.orderId || data.items[0]?.id)
          : 0) ||
        0;

      if (newId > 0) {
        this.setState({ orderId: newId, displayOrderId: newId });
        console.log(`✅ Đã tạo đơn hàng #${newId}`);
        return newId;
      }

      console.error("❌ Không tìm thấy orderId trong phản hồi:", data);
      this.showToast("❌ API trả về không có orderId", 2000);
      return null;
    } catch (e) {
      console.error("[Payment] ❌ createOrderIfNeeded:", e);
      this.showToast("Lỗi tạo đơn hàng: " + e.message);
      return null;
    }
  }

  /* ---------- Load order ---------- */
  async fetchLatestOrderId() {
    const { shopId, shiftId } = this.getAuthContext();
    if (!shopId || !shiftId) {
      this.setState({ displayOrderId: this.state.orderId || null });
      return;
    }

    const token = localStorage.getItem("accessToken") || "";
    const url = `${API_URL}/api/orders?ShiftId=${shiftId}&ShopId=${shopId}&page=1&pageSize=10`;
    try {
      const t0 = performance.now();
      const res = await fetch(url, {
        headers: {
          accept: "*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        cache: "no-store",
      });
      const dt = Math.round(performance.now() - t0);
      log(`GET latest orderId → ${res.status} (${dt}ms)`, url);
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const list = Array.isArray(data?.items) ? data.items : [];
      const maxId = list.reduce(
        (m, it) => Math.max(m, Number(it.orderId || 0)),
        0
      );

      this.setState(
        { displayOrderId: maxId || this.state.orderId || null },
        () => {
          if (!this.state.orders.length && (maxId || this.state.orderId)) {
            this.fetchOrderDetailsFor(maxId || this.state.orderId);
          }
        }
      );
    } catch (e) {
      warn("fetchLatestOrderId failed:", e?.message || e);
      this.setState({ displayOrderId: this.state.orderId || null });
    }
  }

  async fetchOrderDetailsFor(orderId) {
    if (!orderId) return;
    const token = localStorage.getItem("accessToken") || "";
    const url = `${API_URL}/api/order-details?OrderId=${orderId}&page=1&pageSize=5000`;
    try {
      const t0 = performance.now();
      const res = await fetch(url, {
        headers: {
          accept: "*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        cache: "no-store",
      });
      const dt = Math.round(performance.now() - t0);
      log(`GET details(${orderId}) → ${res.status} (${dt}ms)`, url);
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const items = Array.isArray(data?.items) ? data.items : [];
      const lines = items.map((d, i) => {
        const qty = Number(d.quantity ?? 0);
        const pid = Number(d.productId ?? 0);
        const puid = Number(d.productUnitId ?? 0);
        const basePrice = Number(d.price ?? d.unitPrice ?? 0);
        const discountValue = Number(d.discountValue ?? 0);
        const finalPrice = Math.max(0, basePrice - discountValue);

        return {
          id: pid,
          productUnitId: puid,
          qty,
          basePrice,
          discountValue,
          price: finalPrice,
          name: d.productName || `Sản phẩm #${pid}`,
          unit: d.unitName || "",
          note: d.note || "",
          img: d.imageUrl || "https://via.placeholder.com/150",
        };
      });

      this.setState((s) => (s.orders?.length ? null : { orders: lines }));
    } catch (e) {
      warn("fetchOrderDetailsFor failed:", e?.message || e);
    }
  }
  async fetchCustomerNameById(customerId) {
    await this.fetchCustomerRankBenefit(customerId);
    if (!customerId) return;
    const token = localStorage.getItem("accessToken") || "";
    const url = `${API_URL}/api/customers?CustomerId=${customerId}`;

    try {
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const customer = Array.isArray(data?.items) ? data.items[0] : data;
      if (customer?.fullName || customer?.name) {
        this.setState({
          customerName: customer.fullName || customer.name || "",
        });
      } else {
        this.setState({ customerName: "Khách hàng" });
      }
    } catch (e) {
      console.warn("fetchCustomerNameById failed:", e?.message || e);
    }
  }
  async fetchCustomerRankBenefit(customerId) {
    console.log(
      "[Payment] 🔍 GỌI HÀM fetchCustomerRankBenefit với customerId =",
      customerId
    );
    if (!customerId) return;

    const token = localStorage.getItem("accessToken") || "";
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const shopId = profile?.shopId || 0;

    try {
      // 🔹 1. Lấy thông tin khách hàng
      const resCus = await fetch(
        `${API_URL}/api/customers?CustomerId=${customerId}&ShopId=${shopId}`,
        {
          headers: {
            accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const dataCus = await this.safeParse(resCus);
      const customer = Array.isArray(dataCus?.items)
        ? dataCus.items[0]
        : dataCus;
      const rankId = Number(customer?.rankid || customer?.rankId || 0);

      console.log(
        "[Payment] 🧩 rankId của KH:",
        rankId,
        "Tên:",
        customer?.fullName
      );

      if (!rankId) {
        console.warn("[Payment] ⚠️ KH chưa có rankId hợp lệ");
        return;
      }

      // 🔹 2. Lấy toàn bộ bảng rank
      const resRank = await fetch(
        `${API_URL}/api/ranks?ShopId=${shopId}&page=1&pageSize=50`,
        {
          headers: {
            accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const dataRank = await this.safeParse(resRank);
      const ranks = Array.isArray(dataRank?.items) ? dataRank.items : [];

      // 🔹 3. Tìm rank khớp với rankId của khách hàng
      const rankItem = ranks.find(
        (r) => Number(r.rankId || r.id || 0) === rankId
      );

      if (!rankItem) {
        console.warn(`[Payment] ⚠️ Không tìm thấy rank tương ứng: ${rankId}`);
        console.log(
          "Danh sách rank có:",
          ranks.map((r) => r.rankId)
        );
        return;
      }

      const benefit = Number(rankItem.benefit || 0);
      const discountValue = this.subtotal() * benefit;

      console.log(
        `[Payment] ✅ FETCH RANK THÀNH CÔNG:`,
        rankItem.rankName,
        benefit,
        discountValue
      );

      // 🔹 4. Lưu vào state
      this.setState({
        rankName: rankItem.rankName || "Thành viên",
        rankBenefit: benefit,
        rankDiscountValue: discountValue,
      });
    } catch (e) {
      console.error("[Payment] ❌ LỖI FETCH RANK:", e);
    }
  }

  /* ---------- Build payload (ưu tiên overrides → head → last → state) ---------- */
  async fetchOrderHead(orderId) {
    const { shopId, shiftId } = this.getAuthContext();
    if (!orderId || !shopId || !shiftId) return null;

    const token = localStorage.getItem("accessToken") || "";
    const url = `${API_URL}/api/orders?OrderId=${orderId}&ShiftId=${shiftId}&ShopId=${shopId}&page=1&pageSize=1&_=${Date.now()}`;

    try {
      const t0 = performance.now();
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        cache: "no-store",
      });

      const dt = Math.round(performance.now() - t0);
      log(`GET fetchOrderHead(${orderId}) → ${res.status} (${dt}ms)`, url);

      const data = await this.safeParse(res);

      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const head =
        Array.isArray(data?.items) && data.items.length
          ? data.items[0]
          : data.item || data || null;

      if (!head || !head.orderId) {
        warn(`[Payment] Không tìm thấy order #${orderId}`);
        return null;
      }

      return head;
    } catch (e) {
      warn("[Payment] fetchOrderHead failed:", e?.message || e);
      return null;
    }
  }

  async buildFullPayload(orderId, overrides = {}) {
    const head = (await this.fetchOrderHead(orderId)) || {};
    const last = this.getLastOrderCache() || {};
    const { shopId, shiftId } = this.getAuthContext();

    let details = (this.state.orders || []).map((it) => ({
      quantity: Number(it.qty || 0),
      productUnitId: Number(it.productUnitId || 0),
      productId: Number(it.id || 0),
    }));
    if (!details.length) {
      details = [
        {
          quantity: 0,
          productUnitId: 0,
          productId: 0,
        },
      ];
    }

    const payload = {
      customerId:
        Number(
          overrides.customerId ??
            this.state.customerId ??
            head.customerId ??
            last.customerId ??
            0
        ) || null,
      paymentMethod:
        Number(
          this.normalizePaymentMethod(
            overrides.paymentMethod ??
              this.state.payMethodId ??
              head.paymentMethod ??
              last.paymentMethod ??
              1
          )
        ) || 1,
      rankBenefit: this.state.rankBenefit || 0,
      rankDiscountValue: this.state.rankDiscountValue || 0,
      rankName: this.state.rankName || "",

      status: Number(overrides.status ?? head.status ?? last.status ?? 0),
      shiftId: Number(overrides.shiftId ?? shiftId ?? head.shiftId ?? 0) || 0,
      shopId: Number(overrides.shopId ?? shopId ?? head.shopId ?? 0) || 0,
      voucherId:
        overrides.voucherId != null
          ? Number(overrides.voucherId)
          : head.voucherId != null
            ? Number(head.voucherId)
            : last.voucherId != null
              ? Number(last.voucherId)
              : null,

      discount: Number(
        overrides.discount ??
          this.state.manualDiscountPercent ??
          head.discount ??
          last.discount ??
          0
      ),
      note: String(overrides.note ?? this.state.note ?? head.note ?? "string"),
      isSendInvoice:
        overrides.isSendInvoice ??
        this.state.isSendInvoice ??
        head.isSendInvoice ??
        last.isSendInvoice ??
        false,

      orderDetails: details,
    };

    log("✅ buildFullPayload (Swagger format):", payload);
    return payload;
  }

  /* ---------- PUT nhẹ khi đổi phương thức thanh toán ---------- */
  ensurePaymentMethod = async (orderId, pm) => {
    if (!orderId || !pm) return;
    const token = localStorage.getItem("accessToken") || "";

    try {
      const payload = await this.buildFullPayload(orderId, {
        paymentMethod: pm,
        isSendInvoice: this.state.isSendInvoice,
        status: this.state.status === 1 ? 0 : (this.state.status ?? 0),
      });

      const url = `${API_URL}/api/orders/${orderId}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      this.setState({ payMethodId: pm });
      log(`✅ PUT /api/orders/${orderId} (method change)`, payload);
    } catch (e) {
      err("ensurePaymentMethod failed:", e?.message || e);
      this.showToast("❌ Lỗi cập nhật phương thức thanh toán");
    }
  };

  /* ---------- Back / rời trang → status:2 ---------- */
  async putStatus2(orderIdArg) {
    if (this.state.activeTab === "cash") return;
    let orderId = Number(orderIdArg || 0);
    if (!orderId) {
      orderId = await this.getOrWaitOrderId(3000);
    }
    if (!orderId) {
      warn("PUT status=2: vẫn chưa có orderId, bỏ qua PUT.");
      return;
    }

    if (this._isPaid || this._didSetStatus2) return;

    const token = localStorage.getItem("accessToken") || "";
    try {
      const payload = await this.buildFullPayload(orderId, { status: 2 });
      payload.paymentMethod = this.normalizePaymentMethod(
        payload.paymentMethod ?? METHOD_MAP[this.state.activeTab] ?? 1
      );

      log("PUT status=2 – final payload:", { orderId, payload });

      const url = `${API_URL}/api/orders/${orderId}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        cache: "no-store",
        keepalive: true,
        body: JSON.stringify(payload),
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      this._didSetStatus2 = true;
    } catch (e) {
      err("PUT status=2 FAILED:", e?.message || e);
    }
  }

  /* ---------- QR flow ---------- */
  async fetchVietQR(orderId) {
    if (!orderId) return;
    const token = localStorage.getItem("accessToken") || "";
    const url = `${API_URL}/api/sepay/vietqr?orderId=${orderId}`;
    try {
      this.setState({ qrLoading: true, qrError: "" });
      const t0 = performance.now();
      const res = await fetch(url, {
        headers: {
          accept: "*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        cache: "no-store",
      });
      const dt = Math.round(performance.now() - t0);
      log(`GET VietQR → ${res.status} (${dt}ms)`, url);
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      const qrUrl = data?.url || "";
      if (!qrUrl) throw new Error("Không nhận được URL QR.");
      this.setState({ qrUrl });
    } catch (e) {
      this.setState({ qrError: e.message || "Lỗi lấy QR" });
    } finally {
      this.setState({ qrLoading: false });
    }
  }

  async initQRFlow() {
    const oid = await this.getOrWaitOrderId(3000);
    if (!oid) {
      this.showToast("⚠️ Không thể lấy OrderId để tạo mã QR");
      return;
    }
    await this.ensurePaymentMethod(oid, METHOD_MAP.qr);
    await this.fetchVietQR(oid);
    this.startPolling(oid);
  }

  async startPolling(orderId) {
    this.stopPolling();
    const { shopId, shiftId } = this.getAuthContext();
    if (!orderId || !shopId || !shiftId) return;
    this.pollCancel = false;

    const token = localStorage.getItem("accessToken") || "";
    const baseUrl = `${API_URL}/api/orders?OrderId=${orderId}&ShiftId=${shiftId}&ShopId=${shopId}&page=1&pageSize=1`;

    let delay = 300;
    const maxDelay = 1000;

    const pollOnce = async () => {
      const url = `${baseUrl}&_=${Date.now()}`;
      try {
        const t0 = performance.now();
        const res = await fetch(url, {
          headers: {
            accept: "*/*",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          mode: "cors",
          cache: "no-store",
        });
        const dt = Math.round(performance.now() - t0);
        const data = await this.safeParse(res);
        const item = Array.isArray(data?.items) ? data.items[0] : null;
        const status = Number(item?.status ?? -1);
        console.log(
          `%c[Poll]%c id=${orderId} status=${status} (${dt}ms, next ${delay}ms)`,
          "color:#06b6d4;font-weight:700",
          "color:inherit"
        );

        if (status === 1) {
          this.stopPolling();
          if (typeof this.showPaidAndGo === "function") this.showPaidAndGo();
          else this.props.navigate("/orders");
          return true;
        }
      } catch (e) {
        warn("Polling error", e?.message || e);
      }
      return false;
    };

    const loop = async () => {
      while (
        !this.pollCancel &&
        this.state.activeTab === "qr" &&
        !document.hidden
      ) {
        const done = await pollOnce();
        if (done) return;
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(maxDelay, Math.round(delay * 1.5));
      }
    };

    loop();
  }

  stopPolling() {
    this.pollCancel = true;
    log("Stop polling");
  }

  handleVisibilityChange() {
    if (document.hidden) this.stopPolling();
    else if (this.state.activeTab === "qr") this.initQRFlow();
  }

  handleQuick = (value) => {
    this.setState((prev) => ({
      received: Number(prev.received || 0) + Number(value || 0),
    }));
  };

  keyIn = (val) => {
    const cur = String(this.state.received || "");
    this.setState({ received: Number(cur + String(val)) });
  };

  keyBackspace = () => {
    const cur = String(this.state.received || "");
    this.setState({ received: Number(cur.slice(0, -1)) || 0 });
  };

  /* ---------- Tab click ---------- */
  setActiveTab = async (tab) => {
    this.setState({ activeTab: tab });
    this.props.navigate(`/payment?method=${tab}`, {
      replace: true,
      state: this.props.location?.state,
    });

    let oid = await this.getOrWaitOrderId(3000);
    if (!oid) {
      this.showToast("⚠️ Không thể tạo hoặc lấy OrderId hợp lệ");
      return;
    }

    const pm = METHOD_MAP[tab] ?? null;
    if (oid && pm && pm !== this.state.payMethodId) {
      await this.ensurePaymentMethod(oid, pm);
    }

    if (tab === "qr") await this.initQRFlow();
    else this.stopPolling();
  };

  /* ---------- Submit ---------- */
  buildPayload() {
    const { shopId, shiftId } = this.getAuthContext();
    const orderDetails = (this.state.orders || []).map((it) => ({
      quantity: Number(it.qty || 0),
      productUnitId: Number(it.productUnitId || 0),
      productId: Number(it.id || 0),
      price: Number(it.price || it.basePrice || 0),
      discountValue: Number(it.promotionValue || 0),
    }));

    const paymentMethod = Number(
      this.normalizePaymentMethod(
        this.state.payMethodId ?? METHOD_MAP[this.state.activeTab] ?? 1
      ) || 0
    );

    const rawCustomerId = this.state.customerId ?? null;
    const customerId =
      rawCustomerId != null && !Number.isNaN(Number(rawCustomerId))
        ? Number(rawCustomerId)
        : null;

    const manualPercent = Number(this.state.manualDiscountPercent || 0);

    const payload = {
      customerId,
      paymentMethod,
      status: this.state.activeTab === "cash" ? 1 : 0,
      shiftId: shiftId ?? null,
      shopId: shopId ?? null,
      voucherId: this.state.voucherInfo?.voucherId || null,
      discount: manualPercent,
      isSendInvoice: this.state.isSendInvoice,
      note: this.state.note?.trim() || "",
      orderDetails,
    };

    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined || payload[k] === "null") delete payload[k];
    });

    log("buildPayload →", payload);
    return payload;
  }

  submitOrder = async () => {
    this.setState({ loading: true, error: "" });
    const token = localStorage.getItem("accessToken") || "";

    try {
      if (this.state.activeTab === "cash") {
        const orderId = await this.createOrderIfNeeded();
        if (!orderId) {
          this.showToast("❌ Không thể tạo đơn hàng tiền mặt");
          this.setState({ loading: false });
          return;
        }

        const payload = await this.buildFullPayload(orderId, {
          status: 1,
          note: this.state.note,
          isSendInvoice: false,
        });

        const url = `${API_URL}/api/orders/${orderId}`;
        const res = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await this.safeParse(res);
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

        log(`💰 [CASH] PUT status=1 → OK`, url, data);
        this._isPaid = true;

        await this.handlePrintReceipt();
        this.showToast("✅ Thanh toán thành công!");
        setTimeout(() => this.props.navigate("/orders"), 800);
        return;
      }

      const orderId = await this.getOrWaitOrderId(3000);
      if (!orderId) {
        this.showToast("❌ Không thể lấy OrderId để cập nhật đơn");
        this.setState({ loading: false });
        return;
      }

      const payload = await this.buildFullPayload(orderId, {
        status: 1,
        note: this.state.note,
        isSendInvoice: false,
      });

      const url = `${API_URL}/api/orders/${orderId}`;
      const t0 = performance.now();
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const dt = Math.round(performance.now() - t0);
      const data = await this.safeParse(res);
      log(`PUT status=1 → ${res.status} (${dt}ms)`, url, data);

      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      this.showToast("💳 Đã cập nhật trạng thái chờ thanh toán");
    } catch (e) {
      console.error("[Payment] ❌ submitOrder:", e);
      this.setState({ error: e.message || "Lỗi cập nhật đơn hàng" });
    } finally {
      this.setState({ loading: false });
    }
  };

  /* ---------- UI Actions ---------- */
  handleBack = async () => {
    try {
      this.stopPolling();
      const oid = await this.waitForOrderId(2000);
      log("Back clicked → PUT status=2 cho orderId:", oid);
      await this.putStatus2(oid);
    } finally {
      this.props.navigate(-1);
    }
  };
  /* ---------- Printer (Browser mode) ---------- */
  async handlePrintReceipt() {
    try {
      const orderId = this.state.displayOrderId || this.state.orderId;
      const freshOrder = await this.fetchOrderHead(orderId);
      const subTotal = this.totalBefore;
      const discountSum = this.discountSum;
      const totalAfter = this.totalAfter;

      const items = (this.state.orders || []).map((o) => ({
        name: o.name,
        qty: Number(o.qty || 0),
        unit: o.unit || "",
        basePrice: Number(o.basePrice ?? o.price ?? 0),
        promotionValue: Number(o.promotionValue || o.discountValue || 0),
        price: Math.max(
          0,
          (o.basePrice ?? o.price ?? 0) -
            (o.promotionValue || o.discountValue || 0)
        ),
        note: [
          this.state.note,
          this.state.generatedNote,
          (this.state.orders || [])
            .map((p) => p.note)
            .filter(Boolean)
            .join("; "),
        ]
          .filter(Boolean)
          .join(" | "),
      }));

      const order = {
        id: orderId,
        items,
        subTotal, // Tổng trước giảm
        totalAfter, // Tổng sau giảm
        discountPercent: this.state.manualDiscountPercent || 0,
        discountValue: discountSum || 0,
        voucherInfo: this.state.voucherInfo || null,
        voucherCode: this.state.voucherInfo?.code || null,
        voucherValue: this.state.voucherDiscount || 0,
        method: this.state.activeTab,
        qrUrl: this.state.qrUrl,
        received:
          this.state.activeTab === "cash"
            ? this.state.received > 0
              ? Number(this.state.received)
              : Number(this.totalAfter)
            : null,
        change:
          this.state.activeTab === "cash"
            ? Math.max(
                0,
                Number(this.state.received || this.totalAfter) -
                  Number(this.totalAfter)
              )
            : null,
        isSendInvoice: false,
        note: this.state.note || "",
        customerId: this.state.customerId || freshOrder?.customerId || null,
        customerName:
          this.state.customerName || freshOrder?.customerName || "Khách lẻ",
        customerPhone:
          this.state.customerPhone || freshOrder?.customerPhone || "",
        rankName: this.state.rankName || "Thành viên",
        rankBenefit: this.state.rankBenefit || 0,
        rankDiscountValue: this.state.rankDiscountValue || 0,
      };

      const PrintTemplate = (await import("@/lib/PrintTemplate")).default;
      const shop = await PrintTemplate.getShopInfo();

      const printer = new PrintService("lan", {
        ip: "192.168.1.107",
        port: 9100,
      });
      await printer.printOrder(order, shop).catch(console.error);

      this.showToast("🖨️ Đã gửi lệnh in hóa đơn");
    } catch (e) {
      console.error("[Payment] Lỗi in:", e);
      this.showToast("⚠️ In hóa đơn thất bại", 2000);
    }
  }

  /* ---------- Computed ---------- */
  get totalAfterDiscount() {
    return this.totalAfter;
  }

  get total() {
    return this.subtotal();
  }

  get effectiveReceived() {
    const entered = Number(this.state.received || 0);
    const total = Number(this.totalAfter || 0);
    return entered > 0 ? entered : total;
  }

  get change() {
    const received = Number(this.effectiveReceived || 0);
    const total = Number(this.totalAfter || 0);
    return Math.max(0, received - total);
  }

  get shortage() {
    const total = Number(this.totalAfter || 0);
    const received = Number(this.effectiveReceived || 0);
    return Math.max(0, total - received);
  }

  get discountSum() {
    const voucherDiscount = Number(this.state.voucherDiscount || 0);
    const manualDiscount = Number(this.state.manualDiscountValue || 0);
    const rankDiscount = Number(this.state.rankDiscountValue || 0);
    return voucherDiscount + manualDiscount + rankDiscount;
  }

  get totalBefore() {
    return this.subtotal();
  }
  get totalAfter() {
    const after = Math.max(0, this.totalBefore - this.discountSum);
    return after;
  }
  /* ---------- Render parts ---------- */
  SectionHeader() {
    return (
      <div className="text-white flex items-center mb-3">
        <button
          onClick={this.handleBack}
          className="w-8 h-8 rounded-full bg-white/10 mr-3"
        >
          ←
        </button>
        <div className="text-xl font-semibold">Thanh toán</div>
        <div className="ml-auto">
          <button
            onClick={() => this.handlePrintReceipt()}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20"
            title="In hóa đơn"
          >
            🖨️
          </button>
        </div>
      </div>
    );
  }

  RenderTabs() {
    const { activeTab } = this.state;
    const inactiveTabs = ["nfc", "atm"];

    return (
      <div className="grid grid-cols-4 gap-2">
        {PAY_TABS.map((t) => {
          const isDisabled = inactiveTabs.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => !isDisabled && this.setActiveTab(t.id)}
              disabled={isDisabled}
              className={`h-10 rounded-lg border text-sm font-medium transition-all ${
                isDisabled
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : activeTab === t.id
                    ? "bg-[#00A8B0] text-white border-[#00A8B0]"
                    : "bg-white text-gray-700 hover:bg-[#00A8B0]/10"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  LeftPanel() {
    const { orders, note, customerId, activeTab } = this.state;
    const displayOrderId =
      this.state.displayOrderId || this.state.orderId || null;

    return (
      <div className="flex-1 bg-white rounded-xl p-4 mr-3">
        <div className="mb-3">
          <div className="text-xs text-gray-500">Thông tin Khách hàng</div>
          <div className="text-lg font-semibold">
            {customerId == null
              ? "Khách lẻ"
              : this.state.customerName || "Khách hàng"}
          </div>

          <div className="text-sm text-gray-500">
            {displayOrderId ? (
              <>
                Order # <span className="font-semibold">{displayOrderId}</span>
              </>
            ) : (
              "Order..."
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Input
              placeholder="Nhập mã voucher"
              className="h-10 pl-10"
              value={this.state.voucherCode}
              onChange={(e) => this.setState({ voucherCode: e.target.value })}
            />
            <span className="absolute left-3 top-2.5 text-gray-400">🎟️</span>
          </div>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => this.applyVoucher()}
          >
            Áp dụng
          </Button>
        </div>

        {this.state.voucherInfo && (
          <div className="border rounded-lg p-3 mb-3 bg-emerald-50">
            <div className="flex justify-between items-center">
              <div className="font-semibold text-emerald-700">
                🎟️ Mã: {this.state.voucherInfo.code}
              </div>
              <button
                onClick={() =>
                  this.setState({
                    voucherInfo: null,
                    discount: 0,
                    voucherCode: "",
                  })
                }
                className="text-red-500 text-sm font-medium hover:underline"
              >
                Xóa
              </button>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Giảm{" "}
              {this.state.voucherInfo.discountType === "percent"
                ? `${this.state.voucherInfo.discountValue}%`
                : `${fmt.format(this.state.voucherInfo.discountValue)}đ`}
            </div>
          </div>
        )}
        {/* --- Nhập chiết khấu thủ công --- */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="Chiết khấu (%)"
              className="h-10 pl-3"
              value={this.state.manualDiscountPercent}
              onChange={(e) =>
                this.setState({
                  manualDiscountPercent: Math.min(
                    100,
                    Math.max(0, Number(e.target.value) || 0)
                  ),
                })
              }
            />
          </div>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => {
              const percent = this.state.manualDiscountPercent || 0;
              const manualDiscountValue = (this.subtotal() * percent) / 100;
              this.setState({ manualDiscountValue });
              this.showToast(`🧾 Giảm ${percent}% cho toàn bộ hóa đơn`);
            }}
          >
            Áp dụng
          </Button>
        </div>
        {/* --- Bật / tắt gửi hóa đơn điện tử --- */}
        <div className="flex items-center justify-between border rounded-lg px-3 py-2 mb-3">
          <span className="text-sm font-medium text-gray-700">
            Gửi hóa đơn điện tử
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={this.state.isSendInvoice}
              onChange={(e) =>
                this.setState({ isSendInvoice: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00A8B0]"></div>
          </label>
        </div>

        <div className="border rounded-xl p-4 h-[300px] overflow-y-auto">
          {orders.length === 0 ? (
            <div className="text-sm text-gray-500">Không có sản phẩm.</div>
          ) : (
            orders.map((o, i) => (
              <div
                key={`${o.id}-${o.productUnitId ?? "base"}-${i}`}
                className="flex items-start justify-between py-3 border-b last:border-none"
              >
                <div>
                  <div className="font-semibold text-gray-800">
                    {i + 1}. {o.name}
                  </div>
                  {o.promotionValue > 0 ? (
                    <>
                      <div className="text-xs line-through text-gray-400">
                        {fmt.format(o.basePrice)}đ
                      </div>
                      <div className="text-red-600 font-bold">
                        {fmt.format(o.price)}đ
                      </div>
                    </>
                  ) : (
                    <div className="font-bold">{fmt.format(o.price)}đ</div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">x{o.qty}</div>
                  <div className="font-semibold text-gray-800">
                    {fmt.format(o.qty * o.price)}đ
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="flex flex-col gap-1 mt-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Tổng trước giảm</span>
              <span>{fmt.format(this.totalBefore)}đ</span>
            </div>

            {/* 🔹 Ưu đãi hạng thành viên */}
            {this.state.rankBenefit > 0 && (
              <div className="border rounded-lg p-3 mb-3 bg-cyan-50">
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-cyan-700">
                    🎖️ Hạng: {this.state.rankName}
                  </div>
                  <div className="text-sm text-gray-600">
                    Giảm {this.state.rankBenefit * 100}%
                  </div>
                </div>
                <div className="mt-1 text-sm text-cyan-800">
                  Ưu đãi: -{fmt.format(this.state.rankDiscountValue)}đ
                </div>
              </div>
            )}

            {/* 🔹 Giảm theo voucher hoặc chiết khấu thủ công */}
            {(this.state.voucherDiscount > 0 ||
              this.state.manualDiscountValue > 0) && (
              <>
                {this.state.voucherDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm text-red-600">
                    <span>Giảm theo voucher</span>
                    <span>-{fmt.format(this.state.voucherDiscount)} VND</span>
                  </div>
                )}

                {this.state.manualDiscountValue > 0 && (
                  <div className="flex items-center justify-between text-sm text-orange-600">
                    <span>
                      Chiết khấu ({this.state.manualDiscountPercent}%)
                    </span>
                    <span>
                      -{fmt.format(this.state.manualDiscountValue)} VND
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-between text-lg font-semibold mt-1">
              <span>Thành tiền</span>
              <span>{fmt.format(this.totalAfter)} VND</span>
            </div>
          </div>

          <div className="text-right text-gray-600 mt-2">
            {activeTab === "cash" && "Tiền mặt"}
            {activeTab === "qr" && "Chuyển khoản"}
            {activeTab === "nfc" && "NFC"}
            {activeTab === "atm" && "ATM"}
          </div>
        </div>

        <Input
          value={note}
          onChange={(e) => this.setState({ note: e.target.value })}
          placeholder="Ghi chú đơn hàng"
          className="h-10 mt-3"
        />
      </div>
    );
  }

  RightPanel() {
    const { activeTab, quicks, loading, error, qrUrl, qrLoading, qrError } =
      this.state;

    if (activeTab === "cash") {
      const keypadBtn = (label, onClick) => (
        <button
          disabled={loading}
          onClick={onClick}
          className="h-14 rounded-lg border text-lg font-semibold hover:bg-gray-50"
        >
          {label}
        </button>
      );

      return (
        <div className="w-[420px] bg-white rounded-xl p-4">
          {this.RenderTabs()}

          <div className="text-center my-3">
            <div className="text-[#00A8B0] font-semibold">Đã nhận</div>
            <div className="text-3xl font-bold mt-1">
              {fmt.format(this.effectiveReceived)} VND
            </div>
            <div className="mt-2 text-sm">
              {this.shortage > 0 ? (
                <div className="text-red-600">
                  Còn thiếu:{" "}
                  <span className="font-semibold">
                    {fmt.format(this.shortage)} VND
                  </span>
                </div>
              ) : (
                <div className="text-emerald-600">
                  Tiền thối:{" "}
                  <span className="font-semibold">
                    {fmt.format(this.change)} VND
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-2">
            {quicks.map((q) => (
              <button
                key={`quick-${q}`}
                disabled={loading}
                onClick={() => this.handleQuick(q)}
                className="h-10 rounded-lg border text-sm font-medium hover:bg-gray-50"
              >
                {fmt.format(q)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
              <button
                key={`k-${n}`}
                onClick={() => this.keyIn(n)}
                disabled={loading}
                className="h-14 rounded-lg border text-lg font-semibold hover:bg-gray-50"
              >
                {n}
              </button>
            ))}
            {keypadBtn("000", () => this.keyIn("000"))}
            {keypadBtn("0", () => this.keyIn(0))}
            {keypadBtn("⌫", () => this.keyBackspace())}
          </div>

          {error && <div className="text-red-600 text-sm mt-3">{error}</div>}

          <Button
            disabled={loading || this.shortage > 0}
            onClick={this.submitOrder}
            className="w-full h-12 mt-3 bg-[#00A8B0] hover:opacity-90"
          >
            {loading ? "Đang cập nhật đơn..." : "Thanh toán"}
          </Button>
        </div>
      );
    }

    if (activeTab === "qr") {
      const oid = this.state.orderId || this.state.displayOrderId || null;
      return (
        <div className="w-[420px] bg-white rounded-xl p-4">
          {this.RenderTabs()}
          <div className="text-center mt-6 mb-3 font-semibold">
            Quét mã để thanh toán
          </div>

          {!oid && (
            <div className="text-center text-sm text-red-600 mb-3">
              Không có OrderId. Vui lòng tạo đơn trước.
            </div>
          )}
          {qrError && (
            <div className="text-center text-sm text-red-600 mb-2">
              {qrError}
            </div>
          )}

          <div className="mx-auto w-64 h-64 border rounded-xl grid place-items-center overflow-hidden">
            {qrLoading ? (
              <div className="text-sm text-gray-500">Đang lấy QR…</div>
            ) : qrUrl ? (
              <img
                src={qrUrl}
                alt={`VietQR - Order #${oid}`}
                className="w-[256px] h-[256px] object-contain"
              />
            ) : (
              <div className="text-xs text-gray-500 p-3 text-center">
                Chưa có QR.
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Button
              variant="outline"
              className="h-9"
              disabled={!oid || qrLoading}
              onClick={() => this.fetchVietQR(oid)}
            >
              {qrLoading ? "Đang tải…" : "Lấy lại QR"}
            </Button>
            {qrUrl && (
              <a
                href={qrUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#00A8B0] text-sm underline"
              >
                Mở ảnh QR
              </a>
            )}
          </div>

          <div className="mt-4 border rounded-xl px-4 py-3 font-semibold flex justify-between">
            <span>Tổng cộng:</span>
            <span>{fmt.format(this.subtotal())}đ</span>
          </div>
        </div>
      );
    }

    if (activeTab === "nfc") {
      return (
        <div className="w-[420px] bg-white rounded-xl p-4">
          {this.RenderTabs()}
          <div className="mt-4">
            <div className="text-xl font-bold text-[#00A8B0]">
              Thông tin Khách hàng
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Hóa đơn</span>
                <span className="tabular-nums">
                  {this.state.displayOrderId || this.state.orderId || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ngày</span>
                <span>{new Date().toLocaleDateString("vi-VN")}</span>
              </div>
              <div className="flex justify-between">
                <span>Thời gian</span>
                <span>
                  {new Date().toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Phương thức thanh toán</span>
                <span>NFC</span>
              </div>
              <div className="flex justify-between">
                <span>Số dư còn</span>
                <span>1.000.000 VND</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Thành tiền</span>
                <span>
                  {fmt.format(
                    this.subtotal() -
                      ((this.state.voucherDiscount || 0) +
                        (this.state.manualDiscountValue || 0))
                  )}{" "}
                  VND
                </span>
              </div>
              <div className="flex justify-between font-semibold text-[#00A8B0]">
                <span>Số dư</span>
                <span>{fmt.format(1000000 - this.subtotal())} VND</span>
              </div>
            </div>
          </div>
          <Button className="w-full h-12 mt-6 bg-[#00A8B0] hover:opacity-90">
            Thanh toán
          </Button>
        </div>
      );
    }

    if (activeTab === "atm") {
      return (
        <div className="w-[420px] bg-white rounded-xl p-4">
          {this.RenderTabs()}
          <div className="mt-4 rounded-full w-16 h-16 bg-emerald-100 mx-auto grid place-items-center text-emerald-600 text-3xl">
            ✓
          </div>
          <div className="text-center font-semibold text-lg mt-3">
            Thanh toán thành công
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Hóa đơn</span>
              <span className="tabular-nums">
                {this.state.displayOrderId || this.state.orderId || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ngày</span>
              <span>{new Date().toLocaleDateString("vi-VN")}</span>
            </div>
            <div className="flex justify-between">
              <span>Thời gian</span>
              <span>
                {new Date().toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Phương thức thanh toán</span>
              <span>ATM</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Số tiền</span>
              <span>{fmt.format(this.subtotal())} VND</span>
            </div>
          </div>
          <Button className="w-full h-12 mt-4 bg-[#00A8B0] hover:opacity-90">
            In hóa đơn
          </Button>
        </div>
      );
    }

    return null;
  }

  render() {
    return (
      <div className="h-screen w-full bg-[#012E40] border-[4px] border-[#012E40] p-3">
        <div className="h-full bg-[#012E40] rounded-2xl p-3">
          {this.SectionHeader()}
          <div className="flex gap-3 h-[calc(100%-56px)]">
            {this.LeftPanel()}
            {this.RightPanel()}
          </div>
        </div>

        {this.state.toastMsg && (
          <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-emerald-600 text-white shadow-lg">
            {this.state.toastMsg}
          </div>
        )}
      </div>
    );
  }
}

/* ---------- Wrapper ---------- */
export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const defaultMethod = params.get("method") || "cash";
  return (
    <PaymentPageClass
      navigate={navigate}
      location={location}
      defaultMethod={defaultMethod}
    />
  );
}
