// src/pages/PaymentPage.jsx
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
  { id: "cash", label: "Tiền mặt" },
  { id: "atm",  label: "ATM" },
  { id: "qr",   label: "QR Code" },
  { id: "nfc",  label: "NFC" },
];

class PaymentPageClass extends React.Component {
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
  };

  componentDidMount() {
    log("Mounted");
    this.fetchLatestOrderId();
  }

  componentDidUpdate(prevProps) {
    const prevMethod = new URLSearchParams(prevProps.location?.search || "").get("method") || "cash";
    const nowMethod  = new URLSearchParams(this.props.location?.search || "").get("method") || "cash";
    if (prevMethod !== nowMethod && nowMethod !== this.state.activeTab) {
      log("URL method changed ->", nowMethod);
      this.setState({ activeTab: nowMethod });
    }
  }

  subtotal = () =>
    (this.state.orders || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);

  setActiveTab = (tab) => {
    this.setState({ activeTab: tab });
    this.props.navigate(`/payment?method=${tab}`, { replace: true, state: this.props.location?.state });
  };

  handleQuick = (amount) => this.setState((s) => ({ received: s.received + amount }));
  keyIn        = (n) => this.setState((s) => ({ received: Number(String(s.received) + String(n)) }));
  keyClear     = () => this.setState({ received: 0 });
  keyBackspace = () => this.setState((s) => ({ received: Number(String(s.received).slice(0, -1) || 0) }));

  safeParse = async (res) => {
    try { return await res.json(); }
    catch {
      const t = await res.text().catch(() => "");
      try { return JSON.parse(t); } catch { return { raw: t }; }
    }
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

  async fetchLatestOrderId() {
    const { shopId, shiftId } = this.getAuthContext();
    if (!shopId || !shiftId) {
      warn("Không có shopId/shiftId -> bỏ qua fetchLatestOrderId");
      return;
    }

    const token = localStorage.getItem("accessToken") || "";
    const url = `${API_URL}/api/orders?ShiftId=${shiftId}&ShopId=${shopId}&page=1&pageSize=10`;
    log("GET latest orders:", url);
    try {
      const res = await fetch(url, {
        headers: { accept: "*/*", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        mode: "cors",
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const list = Array.isArray(data?.items) ? data.items : [];
      const maxId = list.reduce((m, it) => Math.max(m, Number(it.orderId || 0)), 0);
      log("Latest orderId =", maxId, "items length =", list.length);
      this.setState({ displayOrderId: maxId || this.state.orderId || null });
    } catch (e) {
      err("fetchLatestOrderId failed:", e);
      this.setState({ displayOrderId: this.state.orderId || null });
    }
  }

  buildPayload() {
    const { shopId, shiftId } = this.getAuthContext();
    const orderDetails = (this.state.orders || []).map((it) => ({
      quantity: Number(it.qty || 0),
      productUnitId: Number(it.productUnitId || 0),
      productId: Number(it.id || 0),
    }));
    const payload = {
      customerId: this.state.customerId ?? null,
      paymentMethod: this.state.payMethodId ?? null,
      status: 0,
      shiftId: shiftId ?? null,
      shopId: shopId ?? null,
      voucherId: null,
      discount: null,
      note: this.state.note || "",
      orderDetails,
    };
    log("Build payload:", payload);
    return payload;
  }

  submitOrder = async () => {
    this.setState({ loading: true, error: "" });
    const token = localStorage.getItem("accessToken") || "";
    const payload = this.buildPayload();

    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json, text/plain, */*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        body: JSON.stringify(payload),
      });
      const data = await this.safeParse(res);
      log("POST /api/orders ->", res.status, data);
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);

      localStorage.setItem("lastOrderResponse", JSON.stringify(data));
      this.props.navigate("/orders");
    } catch (e) {
      err("submitOrder error:", e);
      this.setState({ error: e.message || "Lỗi tạo đơn hàng" });
    } finally {
      this.setState({ loading: false });
    }
  };

  SectionHeader() {
    const displayOrderId = this.state.displayOrderId || this.state.orderId || null;
    return (
      <div className="text-white flex items-center mb-3">
        <button
          onClick={() => this.props.navigate(-1)}
          className="w-8 h-8 rounded-full bg-white/10 mr-3"
        >
          ←
        </button>
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
            className={`h-10 rounded-lg border text-sm font-medium ${
              activeTab === t.id ? "bg-[#00A8B0] text-white border-[#00A8B0]" : "bg-white"
            }`}
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
        {/* Thông tin KH */}
        <div className="mb-3">
          <div className="text-xs text-gray-500">Thông tin Khách hàng</div>
          <div className="text-lg font-semibold">
            {customerId == null ? "Khách lẻ" : `KH #${customerId}`}
          </div>

          <div className="text-sm text-gray-500">
            {displayOrderId ? (
              <>
                Order # <span className="font-semibold">{displayOrderId}</span>
              </>
            ) : (
              "Đang lấy OrderId..."
            )}
          </div>
        </div>

        {/* Voucher + Chiết khấu */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Input placeholder="Voucher" className="h-10 pl-10" />
            <span className="absolute left-3 top-2.5 text-gray-400">🔎</span>
          </div>
          <Button variant="outline" className="h-10">
            💲 Chiết khấu trực tiếp
          </Button>
        </div>

        {/* Danh sách hàng */}
        <div className="border rounded-xl p-4 h-[300px] overflow-y-auto">
          {orders.length === 0 ? (
            <div className="text-sm text-gray-500">Không có sản phẩm.</div>
          ) : (
            orders.map((o, i) => (
              <div
                key={`${o.id}-${o.productUnitId ?? "base"}-${i}`}
                className="flex items-start justify-between py-2"
              >
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

        {/* Tổng tiền + Phương thức */}
        <div className="mt-4 border-t pt-3">
          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Thành tiền</span>
            <span>{fmt.format(this.subtotal())} VND</span>
          </div>
          <div className="text-right text-gray-600 mt-2">
            {activeTab === "cash" && "Tiền mặt"}
            {activeTab === "atm" && "ATM"}
            {activeTab === "qr" && "Chuyển khoản"}
            {activeTab === "nfc" && "NFC"}
          </div>
        </div>

        {/* Ghi chú */}
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
    const { activeTab, quicks, received, loading, error } = this.state;

    // --- CASH (keypad) ---
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
            <div className="text-3xl font-bold mt-1">{fmt.format(received)} VND</div>
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
            {["1","2","3","4","5","6","7","8","9"].map((n) =>
              <button key={`k-${n}`} onClick={() => this.keyIn(n)} disabled={loading} className="h-14 rounded-lg border text-lg font-semibold hover:bg-gray-50">{n}</button>
            )}
            {keypadBtn("000", () => this.keyIn("000"))}
            {keypadBtn("0",   () => this.keyIn(0))}
            {keypadBtn("⌫",   () => this.keyBackspace())}
          </div>

          {error && <div className="text-red-600 text-sm mt-3">{error}</div>}
          <Button disabled={loading} onClick={this.submitOrder} className="w-full h-12 mt-3 bg-[#00A8B0] hover:opacity-90">
            {loading ? "Đang tạo đơn..." : "Thanh toán"}
          </Button>
        </div>
      );
    }

    // --- ATM (success panel) ---
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

    // --- QR ---
    if (activeTab === "qr") {
      return (
        <div className="w-[420px] bg-white rounded-xl p-4">
          {this.RenderTabs()}
          <div className="text-center mt-6 mb-3 font-semibold">Quét mã để thanh toán</div>
          <div className="mx-auto w-64 h-64 border rounded-xl grid place-items-center">
            {/* Thay ảnh QR thật của bạn ở đây */}
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=VIETQR-DEMO"
              alt="VietQR"
              className="w-[220px] h-[220px]"
            />
          </div>
          <div className="mt-4 border rounded-xl px-4 py-3 font-semibold flex justify-between">
            <span>Tổng cộng:</span>
            <span>{fmt.format(this.subtotal())}đ</span>
          </div>
        </div>
      );
    }

    // --- NFC ---
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
            <div className="flex justify-between font-semibold text-[#00A8B0]"><span>Số dư</span><span>{fmt.format(1000000 - this.subtotal())} VND</span></div>
          </div>
        </div>
        <Button className="w-full h-12 mt-6 bg-[#00A8B0] hover:opacity-90">Thanh toán</Button>
      </div>
    );
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
      </div>
    );
  }
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const defaultMethod = params.get("method") || "cash"; // cash | atm | qr | nfc
  return (
    <PaymentPageClass
      navigate={navigate}
      location={location}
      defaultMethod={defaultMethod}
    />
  );
}
