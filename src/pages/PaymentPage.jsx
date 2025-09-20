import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import API_URL from "@/config/api";

const fmt = new Intl.NumberFormat("vi-VN");

const DEBUG = true;
const log  = (m, ...a) => DEBUG && console.log(`%c[Payment]%c ${m}`, "color:#06b6d4;font-weight:700", "color:inherit", ...a);
const warn = (m, ...a) => DEBUG && console.warn(`%c[Payment]%c ${m}`, "color:#f59e0b;font-weight:700", "color:inherit", ...a);
const err  = (m, ...a) => console.error(`%c[Payment]%c ${m}`, "color:#ef4444;font-weight:700", "color:inherit", ...a);

const PAY_TABS = [
  { id: "cash", label: "1: Tiền mặt" },
  { id: "qr",   label: "2: Chuyển khoản" },
  { id: "nfc",  label: "3: NFC" },
  { id: "atm",  label: "4: ATM" },
];

class PaymentPageClass extends React.Component {
  /* ===================== STATE ===================== */
  state = {
    orderId:     this.props.location?.state?.orderId || 0,
    payMethodId: this.props.location?.state?.paymentMethod ?? null,
    note:        this.props.location?.state?.note || "",
    orders:      Array.isArray(this.props.location?.state?.orders) ? this.props.location.state.orders : [],
    customerId:  this.props.location?.state?.customerId ?? null,
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
  };

  /* ===================== FLAGS/HANDLERS ===================== */
  _isPaid = false;        // đã thanh toán xong
  _didSetStatus2 = false; // đã gọi PUT status=2 thành công
  visHandlerBound = null;
  popHandlerBound = null;

  /* ===================== LIFECYCLE ===================== */
  componentDidMount() {
    // lấy chi tiết nếu vào thẳng Payment
    if (!this.state.orders.length && this.state.orderId) {
      this.fetchOrderDetailsFor(this.state.orderId);
    }
    this.fetchLatestOrderId();

    // nếu mở sẵn tab QR -> khởi chạy flow
    if (this.props.defaultMethod === "qr") {
      this.initQRFlow();
    }

    // visibility
    this.visHandlerBound = this.handleVisibilityChange.bind(this);
    document.addEventListener("visibilitychange", this.visHandlerBound);

    // back của trình duyệt trong SPA
    this.popHandlerBound = () => {
      // Đang ở SPA (không unload), có thể PUT bình thường
      this.putStatus2().catch(() => {}).finally(() => {});
    };
    window.addEventListener("popstate", this.popHandlerBound);
  }

  componentWillUnmount() {
    this.stopPolling();
    document.removeEventListener("visibilitychange", this.visHandlerBound);
    window.removeEventListener("popstate", this.popHandlerBound);

    // Dự phòng: rời route cũng thử set về 2 (không chờ)
    this.putStatus2().catch(() => {});
  }

  async componentDidUpdate(prevProps) {
    const prevMethod = new URLSearchParams(prevProps.location?.search || "").get("method") || "cash";
    const nowMethod  = new URLSearchParams(this.props.location?.search || "").get("method") || "cash";
    if (prevMethod !== nowMethod && nowMethod !== this.state.activeTab) {
      this.setState({ activeTab: nowMethod }, () => {
        if (nowMethod === "qr") this.initQRFlow();
        else this.stopPolling();
      });
    }
  }

  /* ===================== UTILS ===================== */
  safeParse = async (res) => {
    try { return await res.json(); }
    catch {
      const t = await res.text().catch(() => "");
      try { return JSON.parse(t); } catch { return { raw: t }; }
    }
  };

  subtotal = () =>
    (this.state.orders || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);

  setActiveTab = (tab) => {
    this.setState({ activeTab: tab });
    this.props.navigate(`/payment?method=${tab}`, { replace: true, state: this.props.location?.state });
    if (tab === "qr") this.initQRFlow(); else this.stopPolling();
  };

  handleQuick = (amount) => this.setState((s) => ({ received: s.received + amount }));
  keyIn        = (n) => this.setState((s) => ({ received: Number(String(s.received) + String(n)) }));
  keyClear     = () => this.setState({ received: 0 });
  keyBackspace = () => this.setState((s) => ({ received: Number(String(s.received).slice(0, -1) || 0) }));

  showToast = (msg, ms = 1600) => {
    this.setState({ toastMsg: msg });
    setTimeout(() => this.setState({ toastMsg: "" }), ms);
  };

  showPaidAndGo = () => {
    this._isPaid = true;
    this.showToast("Thanh toán thành công", 1000);
    setTimeout(() => this.props.navigate("/orders"), 800);
  };

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
      if (auth?.currentShift?.shiftId != null) shiftId = Number(auth.currentShift.shiftId);
      if (!shiftId && auth?.shiftId != null)   shiftId = Number(auth.shiftId);
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
      await new Promise(r => setTimeout(r, 100));
    }
    return 0;
  }

  /* ===================== ORDER ID & DETAILS ===================== */
  async fetchLatestOrderId() {
    const { shopId, shiftId } = this.getAuthContext();
    if (!shopId || !shiftId) {
      this.setState({ displayOrderId: this.state.orderId || null });
      return;
    }

    const token = localStorage.getItem("accessToken") || "";
    const url = `${API_URL}/api/orders?ShiftId=${shiftId}&ShopId=${shopId}&page=1&pageSize=10`;
    try {
      const res = await fetch(url, {
        headers: { accept: "*/*", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        mode: "cors",
        cache: "no-store",
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const list = Array.isArray(data?.items) ? data.items : [];
      const maxId = list.reduce((m, it) => Math.max(m, Number(it.orderId || 0)), 0);

      this.setState(
        { displayOrderId: maxId || this.state.orderId || null },
        () => {
          if (!this.state.orders.length && (maxId || this.state.orderId)) {
            this.fetchOrderDetailsFor(maxId || this.state.orderId);
          }
        }
      );
    } catch {
      this.setState({ displayOrderId: this.state.orderId || null });
    }
  }

  mapOrderDetailsToCartLines(raw = []) {
    return raw.map((d, i) => {
      const qty  = Number(d.quantity ?? 0);
      const pid  = Number(d.productId ?? 0);
      const puid = Number(d.productUnitId ?? 0);
      const unitPrice = Number(d.totalPrice ?? 0) / Math.max(1, qty || 1);
      return {
        id: pid,
        productUnitId: puid,
        qty,
        price: unitPrice,
        name: `Sản phẩm #${pid}`,
        unit: "",
        note: "",
        unitOptions: [],
        img: "https://via.placeholder.com/150",
        __src: "order-details",
        __idx: i,
      };
    });
  }

  async fetchOrderDetailsFor(orderId) {
    if (!orderId) return;
    const token = localStorage.getItem("accessToken") || "";
    const url   = `${API_URL}/api/order-details?OrderId=${orderId}&page=1&pageSize=5000`;
    try {
      const res  = await fetch(url, {
        headers: { accept: "*/*", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        mode: "cors",
        cache: "no-store",
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const items = Array.isArray(data?.items) ? data.items : [];
      const lines = this.mapOrderDetailsToCartLines(items);
      this.setState((s) => (s.orders?.length ? null : { orders: lines }));
    } catch {}
  }

  /* ===================== CANCEL → status:2 ===================== */
  buildCancelPayload = () => {
    // cố gắng lấy đầy đủ từ lastOrderResponse
    const last = (() => {
      try { return JSON.parse(localStorage.getItem("lastOrderResponse") || "null") || {}; }
      catch { return {}; }
    })();

    const { shopId, shiftId } = this.getAuthContext();

    const orderDetails =
      Array.isArray(last.orderDetails) && last.orderDetails.length
        ? last.orderDetails.map(d => ({
            quantity: Number(d.quantity ?? d.qty ?? 0),
            productUnitId: Number(d.productUnitId ?? 0),
            productId: Number(d.productId ?? d.id ?? 0),
          }))
        : (this.state.orders || []).map(it => ({
            quantity: Number(it.qty || 0),
            productUnitId: Number(it.productUnitId || 0),
            productId: Number(it.id || 0),
          }));

    return {
      customerId: last.customerId ?? this.state.customerId ?? null,
      paymentMethod: last.paymentMethod ?? this.state.payMethodId ?? 1,
      status: 2,
      shiftId: shiftId ?? last.shiftId ?? null,
      shopId: shopId ?? last.shopId ?? null,
      voucherId: last.voucherId ?? null,
      discount: last.discount ?? null,
      note: this.state.note ?? last.note ?? "",
      orderDetails,
    };
  };

  putStatus2 = async () => {
    const orderId = Number(this.state.orderId || this.state.displayOrderId || 0);
    if (!orderId || this._isPaid || this._didSetStatus2) return;

    const token = localStorage.getItem("accessToken") || "";
    const payload = this.buildCancelPayload();

    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json, text/plain, */*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      this._didSetStatus2 = true;
      log("PUT status=2 OK for order", orderId);
    } catch (e) {
      err("PUT status=2 FAILED:", e?.message || e);
    }
  };

  /* ===================== QR FLOW ===================== */
  async ensurePaymentMethodForQR(orderId) {
    try {
      const token = localStorage.getItem("accessToken") || "";
      const payload = { paymentMethod: 2 };
      const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json, text/plain, */*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      log("PUT paymentMethod=2 OK for order", orderId);
    } catch (e) {
      err("ensurePaymentMethodForQR", e);
      this.setState({ qrError: e.message || "Không đổi được phương thức thanh toán." });
    }
  }

  async fetchVietQR(orderId) {
    if (!orderId) return;
    const token = localStorage.getItem("accessToken") || "";
    const url = `${API_URL}/api/sepay/vietqr?orderId=${orderId}`;
    try {
      this.setState({ qrLoading: true, qrError: "" });
      const res = await fetch(url, {
        headers: { accept: "*/*", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        mode: "cors",
        cache: "no-store",
      });
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
    const oid = await this.waitForOrderId(3000);
    if (!oid) return;
    await this.ensurePaymentMethodForQR(oid);
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
        const data = await this.safeParse(res);
        const item  = Array.isArray(data?.items) ? data.items[0] : null;
        const status = Number(item?.status ?? -1);
        const dt = Math.round(performance.now() - t0);

        console.log(`%c[Poll]%c id=${orderId} status=${status} (${dt}ms, next ${delay}ms)`,
          "color:#06b6d4;font-weight:700", "color:inherit");

        if (status === 1) {
          this.stopPolling();
          this.showPaidAndGo();
          return true;
        }
      } catch (e) {
        warn("Polling error", e?.message || e);
      }
      return false;
    };

    const loop = async () => {
      while (!this.pollCancel && this.state.activeTab === "qr" && !document.hidden) {
        const done = await pollOnce();
        if (done) return;
        await new Promise(r => setTimeout(r, delay));
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
    if (document.hidden) {
      this.stopPolling();
    } else {
      if (this.state.activeTab === "qr") this.initQRFlow();
    }
  }

  /* ===================== PUT SUBMIT (thanh toán) ===================== */
  buildPayload() {
    const { shopId, shiftId } = this.getAuthContext();
    const orderDetails = (this.state.orders || []).map((it) => ({
      quantity: Number(it.qty || 0),
      productUnitId: Number(it.productUnitId || 0),
      productId: Number(it.id || 0),
    }));

    const methodMap = { cash: 1, qr: 2, nfc: 3, atm: 4 };
    const paymentMethod = this.state.payMethodId ?? methodMap[this.state.activeTab] ?? null;

    return {
      customerId: this.state.customerId ?? null,
      paymentMethod,
      status: this.state.activeTab === "cash" ? 1 : 0, // CASH -> thu ngay
      shiftId: shiftId ?? null,
      shopId: shopId ?? null,
      voucherId: null,
      discount: null,
      note: this.state.note || "",
      orderDetails,
    };
  }

  submitOrder = async () => {
    this.setState({ loading: true, error: "" });
    const token = localStorage.getItem("accessToken") || "";
    const payload = this.buildPayload();
    const targetId = Number(this.state.orderId || this.state.displayOrderId || 0) || null;
    if (!targetId) {
      this.setState({ loading: false, error: "Không có orderId để cập nhật." });
      return;
    }

    try {
      const url = `${API_URL}/api/orders/${targetId}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json, text/plain, */*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);

      if (this.state.activeTab === "cash") this._isPaid = true;
      localStorage.setItem("lastOrderResponse", JSON.stringify({ id: targetId, ...data }));
      this.props.navigate("/orders");
    } catch (e) {
      this.setState({ error: e.message || "Lỗi cập nhật đơn hàng" });
    } finally {
      this.setState({ loading: false });
    }
  };

  /* ===================== UI ACTIONS ===================== */
  handleBack = async () => {
    this.stopPolling();
    await this.putStatus2(); // đợi PUT xong / hoặc fail có log
    this.props.navigate(-1);
  };

  /* ===================== COMPUTED ===================== */
  get total() { return this.subtotal(); }
  get effectiveReceived() {
    const entered = Number(this.state.received || 0);
    return entered > 0 ? entered : this.total;
  }
  get change()   { return Math.max(0, this.effectiveReceived - this.total); }
  get shortage() { return Math.max(0, this.total - this.effectiveReceived); }

  /* ===================== RENDER PARTS ===================== */
  SectionHeader() {
    return (
      <div className="text-white flex items-center mb-3">
        <button onClick={this.handleBack} className="w-8 h-8 rounded-full bg-white/10 mr-3">←</button>
        <div className="text-xl font-semibold">Thanh toán</div>
        <div className="ml-auto">
          <button className="w-10 h-10 rounded-full bg-white/10">🖨️</button>
        </div>
      </div>
    );
  }

  RenderTabs() {
    const { activeTab } = this.state;
    return (
      <div className="grid grid-cols-4 gap-2">
        {PAY_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => this.setActiveTab(t.id)}
            className={`h-10 rounded-lg border text-sm font-medium ${activeTab === t.id ? "bg-[#00A8B0] text-white border-[#00A8B0]" : "bg-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  LeftPanel() {
    const { orders, note, customerId, activeTab } = this.state;
    const displayOrderId = this.state.displayOrderId || this.state.orderId || null;

    return (
      <div className="flex-1 bg-white rounded-xl p-4 mr-3">
        <div className="mb-3">
          <div className="text-xs text-gray-500">Thông tin Khách hàng</div>
          <div className="text-lg font-semibold">
            {customerId == null ? "Khách lẻ" : `HĐ #${customerId}`}
          </div>

          <div className="text-sm text-gray-500">
            {displayOrderId ? (<>Order # <span className="font-semibold">{displayOrderId}</span></>) : ("Đang lấy OrderId...")}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Input placeholder="Voucher" className="h-10 pl-10" />
            <span className="absolute left-3 top-2.5 text-gray-400">🔎</span>
          </div>
          <Button variant="outline" className="h-10">💲 Chiết khấu trực tiếp</Button>
        </div>

        <div className="border rounded-xl p-4 h-[300px] overflow-y-auto">
          {orders.length === 0 ? (
            <div className="text-sm text-gray-500">Không có sản phẩm.</div>
          ) : (
            orders.map((o, i) => (
              <div key={`${o.id}-${o.productUnitId ?? "base"}-${i}`} className="flex items-start justify-between py-2">
                <div>
                  <div className="font-semibold">{i + 1}. {o.name}</div>
                  <div className="text-xs text-gray-500">
                    {fmt.format(o.price)} VND {o.unit ? `• ${o.unit}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">x{o.qty}</div>
                  <div className="font-semibold">{fmt.format(o.qty * o.price)} VND</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Thành tiền</span>
            <span>{fmt.format(this.subtotal())} VND</span>
          </div>
          <div className="text-right text-gray-600 mt-2">
            {activeTab === "cash" && "Tiền mặt"}
            {activeTab === "qr"   && "Chuyển khoản"}
            {activeTab === "nfc"  && "NFC"}
            {activeTab === "atm"  && "ATM"}
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
    const { activeTab, quicks, loading, error, qrUrl, qrLoading, qrError } = this.state;

    // 1) CASH
    if (activeTab === "cash") {
      const keypadBtn = (label, onClick) => (
        <button disabled={loading} onClick={onClick} className="h-14 rounded-lg border text-lg font-semibold hover:bg-gray-50">
          {label}
        </button>
      );

      return (
        <div className="w-[420px] bg-white rounded-xl p-4">
          {this.RenderTabs()}

          <div className="text-center my-3">
            <div className="text-[#00A8B0] font-semibold">Đã nhận</div>
            <div className="text-3xl font-bold mt-1">{fmt.format(this.effectiveReceived)} VND</div>
            <div className="mt-2 text-sm">
              {this.shortage > 0 ? (
                <div className="text-red-600">Còn thiếu: <span className="font-semibold">{fmt.format(this.shortage)} VND</span></div>
              ) : (
                <div className="text-emerald-600">Tiền thối: <span className="font-semibold">{fmt.format(this.change)} VND</span></div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-2">
            {quicks.map((q) => (
              <button key={`quick-${q}`} disabled={loading} onClick={() => this.handleQuick(q)} className="h-10 rounded-lg border text-sm font-medium hover:bg-gray-50">
                {fmt.format(q)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["1","2","3","4","5","6","7","8","9"].map((n) =>
              <button key={`k-${n}`} onClick={() => this.keyIn(n)} disabled={loading} className="h-14 rounded-lg border text-lg font-semibold hover:bg-gray-50">{n}</button>
            )}
            {keypadBtn("000", () => this.keyIn("000"))}
            {keypadBtn("0",   () => this.keyIn(0))}
            {keypadBtn("⌫",   () => this.keyBackspace())}
          </div>

          {error && <div className="text-red-600 text-sm mt-3">{error}</div>}

          <Button disabled={loading || this.shortage > 0} onClick={this.submitOrder} className="w-full h-12 mt-3 bg-[#00A8B0] hover:opacity-90">
            {loading ? "Đang cập nhật đơn..." : "Thanh toán"}
          </Button>
        </div>
      );
    }

    // 2) QR
    if (activeTab === "qr") {
      const oid = this.state.orderId || this.state.displayOrderId || null;
      return (
        <div className="w-[420px] bg-white rounded-xl p-4">
          {this.RenderTabs()}
          <div className="text-center mt-6 mb-3 font-semibold">Quét mã để thanh toán</div>

          {!oid && <div className="text-center text-sm text-red-600 mb-3">Không có OrderId. Vui lòng tạo đơn trước.</div>}
          {qrError && <div className="text-center text-sm text-red-600 mb-2">{qrError}</div>}

          <div className="mx-auto w-64 h-64 border rounded-xl grid place-items-center overflow-hidden">
            {qrLoading ? (
              <div className="text-sm text-gray-500">Đang lấy QR…</div>
            ) : qrUrl ? (
              <img src={qrUrl} alt={`VietQR - Order #${oid}`} className="w-[256px] h-[256px] object-contain" />
            ) : (
              <div className="text-xs text-gray-500 p-3 text-center">Chưa có QR.</div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Button variant="outline" className="h-9" disabled={!oid || qrLoading} onClick={() => this.fetchVietQR(oid)}>
              {qrLoading ? "Đang tải…" : "Lấy lại QR"}
            </Button>
            {qrUrl && (
              <a href={qrUrl} target="_blank" rel="noreferrer" className="text-[#00A8B0] text-sm underline">
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

    // 3) NFC (mock)
    if (activeTab === "nfc") {
      return (
        <div className="w-[420px] bg-white rounded-xl p-4">
          {this.RenderTabs()}
          <div className="mt-4">
            <div className="text-xl font-bold text-[#00A8B0]">Thông tin Khách hàng</div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Hóa đơn</span><span className="tabular-nums">{this.state.displayOrderId || this.state.orderId || "—"}</span></div>
              <div className="flex justify-between"><span>Ngày</span><span>{new Date().toLocaleDateString("vi-VN")}</span></div>
              <div className="flex justify-between"><span>Thời gian</span><span>{new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="flex justify-between"><span>Phương thức thanh toán</span><span>NFC</span></div>
              <div className="flex justify-between"><span>Số dư còn</span><span>1.000.000 VND</span></div>
              <div className="flex justify-between font-semibold"><span>Thành tiền</span><span>{fmt.format(this.subtotal())} VND</span></div>
              <div className="flex justify giữa font-semibold text-[#00A8B0]"><span>Số dư</span><span>{fmt.format(1000000 - this.subtotal())} VND</span></div>
            </div>
          </div>
          <Button className="w-full h-12 mt-6 bg-[#00A8B0] hover:opacity-90">Thanh toán</Button>
        </div>
      );
    }

    // 4) ATM (mock done)
    if (activeTab === "atm") {
      return (
        <div className="w-[420px] bg-white rounded-xl p-4">
          {this.RenderTabs()}
          <div className="mt-4 rounded-full w-16 h-16 bg-emerald-100 mx-auto grid place-items-center text-emerald-600 text-3xl">✓</div>
          <div className="text-center font-semibold text-lg mt-3">Thanh toán thành công</div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Hóa đơn</span><span className="tabular-nums">{this.state.displayOrderId || this.state.orderId || "—"}</span></div>
            <div className="flex justify-between"><span>Ngày</span><span>{new Date().toLocaleDateString("vi-VN")}</span></div>
            <div className="flex justify-between"><span>Thời gian</span><span>{new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="flex justify-between"><span>Phương thức thanh toán</span><span>ATM</span></div>
            <div className="flex justify-between font-semibold"><span>Số tiền</span><span>{fmt.format(this.subtotal())} VND</span></div>
          </div>
          <Button className="w-full h-12 mt-4 bg-[#00A8B0] hover:opacity-90">In hóa đơn</Button>
        </div>
      );
    }

    return null;
  }

  /* ===================== RENDER ROOT ===================== */
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

/* ---------- Wrapper để dùng navigate + location ---------- */
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
