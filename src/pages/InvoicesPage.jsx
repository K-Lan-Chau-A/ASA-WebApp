"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Sidebar from "@/components/sidebar";
import { Search, RefreshCcw, Printer, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import API_URL from "@/config/api";
import PrintTemplate from "@/lib/PrintTemplate";

/* ---------- Helper ---------- */
const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
  });

const fmtDate = (s) =>
  s
    ? new Date(s).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

/* ---------- Component ---------- */
export default class InvoicesPage extends React.Component {
  state = {
    shopId: null,
    orders: [],
    shifts: [],
    selectedShift: 0,
    search: "",
    statusFilter: "all",
    sortOrder: "desc",
    totalRevenue: 0,
    totalOrders: 0,
    loading: false,
    error: "",
    showDialog: false,
    selectedOrder: null,
    orderItems: [],
  };

  /* ---------- Lifecycle ---------- */
  async componentDidMount() {
    this.initShop();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.selectedShift !== this.state.selectedShift) {
      this.loadOrders();
    }
  }

  /* ---------- Init ---------- */
  initShop = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return (window.location.href = "/");
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const shopId = Number(profile?.shopId || 0);
    if (!shopId) return;

    this.setState({ shopId }, async () => {
      await this.loadShifts();
      await this.loadOrders();
      await this.loadProducts();
      await this.loadProductUnits();
      await this.loadUsers();
    });
  };

  /* ---------- Safe Parse ---------- */
  safeParse = async (res) => {
    try {
      return await res.json();
    } catch {
      const txt = await res.text().catch(() => "");
      try {
        return JSON.parse(txt);
      } catch {
        return { raw: txt };
      }
    }
  };

  /* ---------- Load Shifts ---------- */
  loadShifts = async () => {
    const { shopId } = this.state;
    const token = localStorage.getItem("accessToken");
    if (!shopId || !token) return;

    try {
      const res = await fetch(`${API_URL}/api/shifts?ShopId=${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await this.safeParse(res);
      const items = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
          ? json.data.items
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json)
              ? json
              : [];

      const active = items.find((s) => s.status === 1);
      this.setState({
        shifts: items,
        selectedShift: active?.shiftId || (items[0]?.shiftId ?? 0),
      });
    } catch (e) {
      console.warn("⚠️ loadShifts:", e.message);
    }
  };

  /* ---------- Load Orders ---------- */
  loadOrders = async () => {
    const { shopId, selectedShift } = this.state;
    const token = localStorage.getItem("accessToken");
    if (!shopId || !token) return;

    try {
      this.setState({ loading: true });
      const url = `${API_URL}/api/orders?ShopId=${shopId}${
        selectedShift > 0 ? `&ShiftId=${selectedShift}` : ""
      }&page=1&pageSize=100`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await this.safeParse(res);
      const items = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
          ? json.data.items
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json)
              ? json
              : [];

      const orders = items.map((o) => ({
        id: o.orderId,
        code: `#${o.orderId}`,
        customerId: o.customerId,
        total: Number(o.finalPrice ?? o.totalPrice ?? 0),
        discount: Number(o.discount ?? 0),
        note: o.note || "",
        status: o.status === 1 ? "success" : "cancel",
        createdAt: o.createdAt || o.datetime,
        paymentMethod:
          o.paymentMethod === "1" || o.paymentMethodId === 1
            ? "💵 Tiền mặt"
            : o.paymentMethod === "2" || o.paymentMethodId === 2
              ? "🏦 Chuyển khoản"
              : o.paymentMethod === "3" || o.paymentMethodId === 3
                ? "📱 NFC"
                : o.paymentMethod === "4" || o.paymentMethodId === 4
                  ? "💳 Thẻ ATM"
                  : "Phương thức khác",

        shiftId: o.shiftId || 0,
      }));

      const totalRevenue = orders
        .filter((o) => o.status === "success")
        .reduce((sum, o) => sum + o.total, 0);

      this.setState({
        orders,
        totalOrders: orders.length,
        totalRevenue,
      });
    } catch (e) {
      this.setState({ error: `Lỗi tải hóa đơn: ${e.message}` });
    } finally {
      this.setState({ loading: false });
    }
  };
  /* ---------- Load Products ---------- */
  loadProducts = async () => {
    const { shopId } = this.state;
    const token = localStorage.getItem("accessToken");
    if (!shopId || !token) return;

    try {
      const res = await fetch(
        `${API_URL}/api/products?ShopId=${shopId}&page=1&pageSize=500`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = await this.safeParse(res);
      const items = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
          ? json.data.items
          : [];
      const productMap = {};
      items.forEach((p) => {
        productMap[p.productId] = p.productName || `Sản phẩm #${p.productId}`;
      });
      this.productMap = productMap;
    } catch (e) {
      console.warn("⚠️ loadProducts:", e.message);
    }
  };
  /* ---------- Load Product Units ---------- */
  loadProductUnits = async () => {
    const { shopId } = this.state;
    const token = localStorage.getItem("accessToken");
    if (!shopId || !token) return;

    try {
      const res = await fetch(
        `${API_URL}/api/product-units?ShopId=${shopId}&page=1&pageSize=500`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await this.safeParse(res);
      const items = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
          ? json.data.items
          : [];

      const unitByUnitId = {};
      const unitByProductUnitId = {};

      items.forEach((u) => {
        if (u.unitId)
          unitByUnitId[u.unitId] = u.unitName || `Đơn vị #${u.unitId}`;
        if (u.productUnitId)
          unitByProductUnitId[u.productUnitId] =
            u.unitName || `Đơn vị #${u.productUnitId}`;
      });

      this.unitByUnitId = unitByUnitId;
      this.unitByProductUnitId = unitByProductUnitId;
    } catch (e) {
      console.warn("⚠️ loadProductUnits:", e.message);
    }
  };
  /* ---------- Load Users ---------- */
  loadUsers = async () => {
    const { shopId } = this.state;
    const token = localStorage.getItem("accessToken");
    if (!shopId || !token) return;

    try {
      const res = await fetch(
        `${API_URL}/api/users?ShopId=${shopId}&page=1&pageSize=500`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await this.safeParse(res);
      const items = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
          ? json.data.items
          : [];

      const userMap = {};
      items.forEach((u) => {
        userMap[u.userId] = {
          name: u.fullName || u.username || `User #${u.userId}`,
          avatar: u.avatar || "",
        };
      });
      this.userMap = userMap;
    } catch (e) {
      console.warn("⚠️ loadUsers:", e.message);
    }
  };

  /* ---------- Fetch Order Details ---------- */
  fetchOrderDetail = async (orderId) => {
    const token = localStorage.getItem("accessToken");
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const shopId = Number(profile?.shopId || 0);

    try {
      const res = await fetch(
        `${API_URL}/api/order-details?ShopId=${shopId}&OrderId=${orderId}&page=1&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await this.safeParse(res);
      const items = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
          ? json.data.items
          : [];

      return items.map((d) => {
        const name =
          d.productName?.trim() ||
          this.productMap?.[d.productId] ||
          `Sản phẩm #${d.productId}`;

        const unitName =
          d.unitName ||
          this.unitByProductUnitId?.[d.productUnitId] ||
          this.unitByUnitId?.[d.unitId] ||
          "-";

        return {
          ...d,
          productName: name,
          unitName,
        };
      });
    } catch (e) {
      console.warn("⚠️ fetchOrderDetail:", e.message);
      return [];
    }
  };

  /* ---------- Print ---------- */
  handlePrint = async (orderId) => {
    try {
      const orderHead = this.state.orders.find((o) => o.id === orderId);
      if (!orderHead) throw new Error("Không tìm thấy hóa đơn.");
      const details = await this.fetchOrderDetail(orderId);

      const orderFull = {
        ...orderHead,
        id: orderHead.id,
        method: orderHead.paymentMethod?.toLowerCase().includes("chuyển")
          ? "qr"
          : "cash",
        items: details.map((d) => ({
          name: d.productName,
          qty: d.quantity,
          price: d.finalPrice || d.unitPrice,
          basePrice: d.basePrice,
          discountValue: d.discountAmount || 0,
          promotionValue: d.discountAmount || 0,
          unit:
            d.unitName ||
            this.unitByProductUnitId?.[d.productUnitId] ||
            this.unitByUnitId?.[d.unitId] ||
            "-",
        })),
      };
      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const currentUserId = profile?.userId;
      const currentUser = this.userMap?.[currentUserId];
      if (currentUser) {
        orderFull.staff = currentUser.name;
      }

      const html = await PrintTemplate.buildReceiptHTML(orderFull);
      const w = window.open("", "_blank");
      w.document.write(html);
      w.document.close();
      w.focus();
    } catch (e) {
      alert("❌ Lỗi in hóa đơn: " + e.message);
    }
  };

  /* ---------- View Detail ---------- */
  handleView = async (order) => {
    const items = await this.fetchOrderDetail(order.id);
    this.setState({
      selectedOrder: order,
      orderItems: items,
      showDialog: true,
    });
  };

  /* ---------- Render ---------- */
  render() {
    const {
      orders,
      search,
      statusFilter,
      sortOrder,
      loading,
      error,
      showDialog,
      selectedOrder,
      orderItems,
      totalRevenue,
      totalOrders,
    } = this.state;

    const filtered = orders
      .filter((o) =>
        statusFilter === "all" ? true : o.status === statusFilter
      )
      .filter(
        (o) =>
          o.code.includes(search) ||
          o.customerId?.toString().includes(search.trim())
      )
      .sort((a, b) =>
        sortOrder === "desc"
          ? new Date(b.createdAt) - new Date(a.createdAt)
          : new Date(a.createdAt) - new Date(b.createdAt)
      );

    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85]">
              HÓA ĐƠN BÁN HÀNG
            </h1>

            <div className="flex items-center space-x-3">
              <select
                value={this.state.selectedShift}
                onChange={(e) =>
                  this.setState({ selectedShift: Number(e.target.value) })
                }
                className="h-11 rounded-xl border border-gray-300 px-3 text-gray-700 bg-white/80 focus:outline-none"
              >
                <option value={0}>Tất cả ca</option>
                {this.state.shifts.map((s) => {
                  const openTime = s.openedAt
                    ? new Date(s.openedAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--";
                  const closeTime = s.closedAt
                    ? new Date(s.closedAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : null;

                  const label =
                    s.status === 1
                      ? `Mở: ${openTime} • (Đang mở)`
                      : `Mở: ${openTime} • Đóng: ${closeTime || "--:--"}`;

                  return (
                    <option key={s.shiftId} value={s.shiftId}>
                      {`Mở: ${new Date(s.startDate).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })} ${
                        s.status === 1
                          ? "• (Đang mở)"
                          : s.closedDate
                            ? `• Đóng: ${new Date(s.closedDate).toLocaleString(
                                "vi-VN",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}`
                            : ""
                      }`}
                    </option>
                  );
                })}
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm hóa đơn..."
                  value={search}
                  onChange={(e) => this.setState({ search: e.target.value })}
                  className="pl-12 w-72 h-11 text-base rounded-xl bg-white/80 border border-gray-200 focus-visible:ring-0"
                />
              </div>
              <Button
                className="bg-[#00A8B0] text-white text-base rounded-xl px-6 py-3 hover:bg-[#00929A] flex items-center gap-2"
                onClick={this.loadOrders}
              >
                <RefreshCcw className="w-5 h-5" /> Làm mới
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="flex justify-between items-center bg-white/70 rounded-xl p-4 mb-5 shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">
              Doanh thu: {fmtMoney(totalRevenue)}
            </p>
            <p className="font-semibold text-gray-700">
              Tổng đơn hàng: {totalOrders}
            </p>
          </div>

          {/* Body */}
          {loading ? (
            <p className="text-gray-500">Đang tải...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Không có hóa đơn nào.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((o) => (
                <Card
                  key={o.id}
                  className="p-6 bg-white rounded-2xl shadow-md hover:shadow-lg border border-gray-100 transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-xl text-[#007E85]">
                        {o.code}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {fmtDate(o.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        o.status === "success"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {o.status === "success" ? "Thành công" : "Đã hủy"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    {o.paymentMethod}
                  </p>

                  <p className="text-lg font-bold text-[#007E85] mt-2">
                    {fmtMoney(o.total)}
                  </p>
                  {o.note && (
                    <p className="text-xs italic text-gray-500 mt-1 border-t pt-2">
                      📝 {o.note}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-3 mt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => this.handlePrint(o.id)}
                    >
                      <Printer size={14} />
                      In
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 bg-[#00A8B0] text-white hover:bg-[#00929A]"
                      onClick={() => this.handleView(o)}
                    >
                      <Eye size={14} />
                      Xem
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Modal chi tiết */}
          <Dialog
            open={showDialog}
            onOpenChange={(open) => this.setState({ showDialog: open })}
          >
            <DialogContent className="sm:max-w-[600px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#007E85]">
                  Hóa đơn {selectedOrder?.code}
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                {orderItems.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">
                    Không có sản phẩm trong hóa đơn.
                  </p>
                ) : (
                  orderItems.map((it, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center border-b py-2"
                    >
                      <div>
                        <p className="font-medium text-gray-800">
                          {it.productName}
                        </p>
                        <p className="text-xs text-gray-500">
                          SL: {it.quantity} – Giảm:{" "}
                          {fmtMoney(it.discountAmount)}
                        </p>
                      </div>
                      <div className="text-right text-sm text-gray-700">
                        <div className="text-right text-sm text-gray-700">
                          <div>Giá: {fmtMoney(it.basePrice)}</div>
                          <div>Đơn vị: {it.unitName || "-"}</div>
                          <div className="font-semibold text-[#007E85]">
                            {fmtMoney(it.finalPrice)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <DialogFooter className="flex justify-end gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => this.setState({ showDialog: false })}
                >
                  Đóng
                </Button>
                {selectedOrder && (
                  <Button
                    className="bg-[#00A8B0] text-white hover:bg-[#00929A]"
                    onClick={() => this.handlePrint(selectedOrder.id)}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    In lại hóa đơn
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }
}
