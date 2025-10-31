import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import Sidebar from "@/components/sidebar";
import {
  ChartBar,
  Wallet,
  Receipt,
  Power,
  UserCircle2,
  CircleDot,
} from "lucide-react";
import API_URL from "@/config/api";
import { printCloseShift } from "@/lib/CloseShiftTemplate";
import { withRouter } from "@/utils/withRouter";

class DashboardPage extends React.Component {
  state = {
    loading: false,
    stats: null,
    todayRevenue: 0,
    todayInvoices: 0,
    totalProfit: 0,
    topProducts: [],
    topCategories: [],
    revenueData: [],
    user: null,
    shiftId: 0,
    openedAt: null,
    closing: false,
    shiftStatus: 0, // 0=chưa mở, 1=đang mở, 2=đã đóng
  };

  async componentDidMount() {
    this.loadUser();
    await this.loadShiftStatus();
    setTimeout(() => this.loadStats(), 300);
  }

  /* 🧩 Load user info từ localStorage */
  loadUser() {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const currentShift = JSON.parse(
      localStorage.getItem("currentShift") || "{}"
    );

    this.setState({
      user: {
        username: profile.username || "Nhân viên",
        fullName: profile.fullName || "Người dùng",
        shopName: profile.shopName || "Cửa hàng",
      },
      shiftId: Number(currentShift.shiftId || 0),
      openedAt: currentShift.openedAt || null,
    });
  }

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

  async loadShiftStatus() {
    try {
      const token = localStorage.getItem("accessToken");
      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const shopId = Number(profile?.shopId || 0);

      if (!token || !shopId) {
        this.setState({ shiftStatus: 0, todayRevenue: 0, todayInvoices: 0 });
        return;
      }

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

      const activeShift = items.find((s) => Number(s.status) === 1);
      let shiftId = activeShift?.shiftId ?? this.state.shiftId ?? 0;
      let status = activeShift ? 1 : 2;

      if (!activeShift && items.length > 0) {
        const latest = items.sort(
          (a, b) => new Date(b.openedAt) - new Date(a.openedAt)
        )[0];
        shiftId = latest?.shiftId || shiftId;
        status = Number(latest?.status ?? 0);
      }

      this.setState({ shiftId, shiftStatus: status });

      if (status === 1) {
        await this.loadShiftOrders(shopId, shiftId, token);
        localStorage.setItem(
          "currentShift",
          JSON.stringify({
            shiftId,
            status: "open",
            openedAt: activeShift?.openedAt || new Date().toISOString(),
          })
        );
      } else {
        this.setState({ todayRevenue: 0, todayInvoices: 0 });
        localStorage.setItem(
          "currentShift",
          JSON.stringify({
            shiftId,
            status: "closed",
            closedAt: new Date().toISOString(),
          })
        );
      }

      console.log(
        `%c[Shift]%c ${status === 1 ? "Đang mở" : "Đã đóng"} | shiftId=${shiftId}`,
        "color:#00A8B0;font-weight:700",
        "color:inherit"
      );
    } catch (err) {
      console.warn("⚠️ loadShiftStatus error:", err);
      this.setState({ shiftStatus: 0, todayRevenue: 0, todayInvoices: 0 });
    }
  }

  async loadShiftOrders(shopId, shiftId, token) {
    try {
      const res = await fetch(
        `${API_URL}/api/orders?ShopId=${shopId}&ShiftId=${shiftId}&page=1&pageSize=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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

      if (!items.length) {
        this.setState({ todayInvoices: 0, todayRevenue: 0, totalProfit: 0 });
        return;
      }

      const successful = items.filter((o) => Number(o?.status ?? 0) === 1);

      const totalRevenue = successful.reduce(
        (sum, o) => sum + Number(o?.finalPrice ?? o?.totalPrice ?? 0),
        0
      );

      const totalInvoices = successful.length;

      let totalItems = 0;
      let totalProfit = 0;

      for (const o of successful) {
        const details = Array.isArray(o.orderDetails)
          ? o.orderDetails
          : Array.isArray(o.details)
            ? o.details
            : [];
        for (const d of details) {
          totalItems += Number(d.quantity ?? d.qty ?? 0);
          const cost = Number(d.costPrice ?? 0);
          const price = Number(d.price ?? d.unitPrice ?? 0);
          totalProfit += (price - cost) * Number(d.quantity ?? 0);
        }
      }

      this.setState({
        todayInvoices: totalInvoices,
        todayRevenue: totalRevenue,
        totalProfit,
        totalItems,
      });

      console.log(
        `[Shift Orders] shiftId=${shiftId} | invoices=${totalInvoices} | revenue=${totalRevenue.toLocaleString()} | profit=${totalProfit.toLocaleString()}`
      );
    } catch (err) {
      console.warn("⚠️ loadShiftOrders error:", err);
      this.setState({ todayInvoices: 0, todayRevenue: 0, totalProfit: 0 });
    }
  }

  async loadStats() {
    try {
      this.setState({ loading: true });

      const token = localStorage.getItem("accessToken");
      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const shopId = Number(profile?.shopId || 0);
      if (!token || !shopId) return;

      const res = await fetch(
        `${API_URL}/api/reports/statistics-overview?shopId=${shopId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await this.safeParse(res);
      if (!data) return;

      const daily = Array.isArray(data?.revenueStats?.dailyRevenues)
        ? data.revenueStats.dailyRevenues
        : [];
      const topProducts = Array.isArray(data?.topProducts)
        ? data.topProducts
        : [];
      const topCategories = Array.isArray(data?.topCategories)
        ? data.topCategories
        : [];
      const totalProfit = Number(data?.revenueStats?.totalProfit ?? 0);

      const revenueData = daily.map((d) => ({
        day: new Date(d.date).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        value: Number(d.revenue || 0),
      }));

      this.setState({
        stats: data,
        totalProfit,
        topProducts,
        topCategories,
        revenueData,
      });
    } finally {
      this.setState({ loading: false });
    }
  }
  handleOpenShift = async () => {
    const token = localStorage.getItem("accessToken");
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const shopId = Number(profile?.shopId || 0);

    try {
      const res = await fetch(`${API_URL}/api/shifts/open-shift`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shopId }),
      });
      const data = await res.json();
      if (res.ok && data?.shiftId) {
        alert("✅ Đã mở ca mới thành công!");
        localStorage.setItem(
          "currentShift",
          JSON.stringify({
            shiftId: data.shiftId,
            status: "open",
            openedAt: new Date().toISOString(),
          })
        );
        this.setState({ shiftId: data.shiftId, shiftStatus: 1 });
        await this.loadShiftStatus();
      } else {
        alert("⚠️ Mở ca thất bại!");
      }
    } catch (err) {
      alert("❌ Không thể kết nối API mở ca!");
      console.error(err);
    }
  };

  handleCloseShift = async () => {
    const {
      shiftId,
      user,
      todayInvoices,
      todayRevenue,
      topProducts,
      topCategories,
      openedAt,
      shiftStatus,
    } = this.state;

    if (!shiftId) {
      alert("❌ Không tìm thấy ShiftId hợp lệ để đóng ca!");
      return;
    }

    if (shiftStatus === 2) {
      this.props.navigate("/open-shift");
      return;
    }

    const confirmClose = window.confirm("Bạn có chắc muốn đóng ca hiện tại?");
    if (!confirmClose) return;

    try {
      this.setState({ closing: true });
      const token = localStorage.getItem("accessToken");

      const res = await fetch(`${API_URL}/api/shifts/close-shift`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shiftId }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && (data?.status === 2 || data?.success)) {
        alert("✅ Đã đóng ca thành công!");
        this.setState({ shiftStatus: 2 });

        const currentShift = JSON.parse(
          localStorage.getItem("currentShift") || "{}"
        );
        localStorage.setItem(
          "currentShift",
          JSON.stringify({
            ...currentShift,
            status: "closed",
            closedAt: new Date().toISOString(),
          })
        );

        await printCloseShift({
          user,
          shiftId,
          openedAt,
          totalInvoices: todayInvoices,
          totalRevenue: todayRevenue,
          closedAt: new Date(),
          topCategories,
          topProducts,
        });
      } else {
        alert("⚠️ API phản hồi không hợp lệ. Kiểm tra backend!");
      }
    } catch (err) {
      alert("❌ Không thể kết nối API đóng ca!");
      console.error(err);
    } finally {
      this.setState({ closing: false });
    }
  };

  render() {
    const COLORS = ["#00A8B0", "#FF914D", "#FFCD56", "#4BC0C0", "#9966FF"];
    const {
      todayRevenue,
      todayInvoices,
      totalProfit,
      topProducts,
      topCategories,
      revenueData,
      user,
      closing,
      openedAt,
      shiftStatus,
      loading,
    } = this.state;

    const isClosed = shiftStatus === 2;
    const hasData =
      todayRevenue > 0 ||
      todayInvoices > 0 ||
      topProducts.length > 0 ||
      topCategories.length > 0;

    return (
      <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-[#EAFDFC] to-[#F7E7CE]">
        <Sidebar active="dashboard" />
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Header user info */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <UserCircle2 className="w-10 h-10 text-[#00A8B0]" />
              <div>
                <h2 className="text-lg font-semibold text-[#007E85]">
                  {user?.fullName}
                </h2>
                <p className="text-sm text-gray-500">
                  {user?.shopName} • {user?.username}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <CircleDot
                    className={`w-3 h-3 ${isClosed ? "text-red-500" : "text-green-500"}`}
                  />
                  <span
                    className={`text-sm font-medium ${isClosed ? "text-red-600" : "text-green-700"}`}
                  >
                    {isClosed
                      ? "Ca đã đóng"
                      : `Ca đang mở ${openedAt ? `(Bắt đầu: ${new Date(openedAt).toLocaleTimeString("vi-VN")})` : ""}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Nút đóng/mở ca */}
            <button
              onClick={isClosed ? this.handleOpenShift : this.handleCloseShift}
              disabled={closing}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-white transition-all ${
                closing
                  ? "bg-gray-400 cursor-not-allowed"
                  : isClosed
                    ? "bg-[#00A8B0] hover:bg-[#008f8a]"
                    : "bg-[#FF6D60] hover:bg-[#ff4c3f]"
              }`}
            >
              <Power className="w-5 h-5" />
              {closing ? "Đang xử lý..." : isClosed ? "Mở ca" : "Đóng ca"}
            </button>
          </div>

          <h1 className="text-3xl font-extrabold text-[#007E85] mb-8 uppercase tracking-wide">
            Báo cáo doanh thu
          </h1>

          {loading ? (
            <p className="text-center text-gray-500 text-lg mt-10">
              Đang tải dữ liệu...
            </p>
          ) : !hasData ? (
            <p className="text-center text-gray-500 text-lg mt-20">
              ⏳ Chưa có dữ liệu thống kê trong ngày hôm nay.
            </p>
          ) : (
            <>
              {/* Tổng quan */}
              <div className="grid grid-cols-3 gap-6">
                {/* PieChart doanh thu theo danh mục */}
                <Card className="col-span-1 p-6 bg-white shadow-md rounded-2xl">
                  <h2 className="text-lg font-semibold mb-4 text-gray-700">
                    Tổng doanh thu
                  </h2>
                  <div className="flex justify-center items-center h-[220px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={
                            topCategories.length > 0
                              ? topCategories.map((c) => ({
                                  name: c.categoryName || "Khác",
                                  value: Number(c.totalRevenue) || 0,
                                }))
                              : [
                                  { name: "Không có dữ liệu", value: 1 },
                                  { name: "Chờ cập nhật", value: 1 },
                                ]
                          }
                          dataKey="value"
                          nameKey="name"
                          outerRadius={85}
                          innerRadius={55}
                          paddingAngle={3}
                          labelLine={false}
                          label={false}
                        >
                          {(topCategories.length > 0
                            ? topCategories
                            : [1, 2]
                          ).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>

                        <Tooltip
                          formatter={(v) => `${v.toLocaleString("vi-VN")} ₫`}
                          contentStyle={{
                            background: "white",
                            border: "1px solid #ddd",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* 🔹 Tổng doanh thu giữa chart */}
                    <div className="absolute text-center">
                      <p className="text-sm text-gray-500">Tổng cộng</p>
                      <p className="text-lg font-bold text-[#00A8B0]">
                        {todayRevenue > 0
                          ? `${(todayRevenue / 1_000_000).toFixed(1)}M VND`
                          : "0 VND"}
                      </p>
                    </div>
                  </div>

                  {/* 🔹 Chú thích dưới biểu đồ */}
                  <div className="flex justify-center gap-4 mt-2 flex-wrap text-sm text-gray-600">
                    {(topCategories.length > 0
                      ? topCategories
                      : [
                          {
                            categoryName: "Không có dữ liệu",
                            color: COLORS[0],
                          },
                          { categoryName: "Chờ cập nhật", color: COLORS[1] },
                        ]
                    ).map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        ></span>
                        <span>{c.categoryName || c.name}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Tổng giao dịch + hàng bán + lợi nhuận */}
                <Card className="col-span-2 p-6 bg-white shadow-md rounded-2xl flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 text-[#FF914D] font-semibold">
                        <Receipt className="w-5 h-5" /> Tổng giao dịch
                      </div>
                      <p className="text-3xl font-bold mt-1">
                        {todayInvoices.toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-[#00A8B0] font-semibold">
                        <ChartBar className="w-5 h-5" /> Tổng hàng bán
                      </div>
                      <p className="text-2xl font-bold text-[#007E85] mt-1">
                        {topProducts
                          .reduce((s, p) => s + (p.totalQuantitySold || 0), 0)
                          .toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-[#FF914D] font-semibold">
                        <Wallet className="w-5 h-5" /> Lợi nhuận
                      </div>
                      <p className="text-2xl font-bold text-[#FF914D] mt-1">
                        {totalProfit.toLocaleString("vi-VN")} ₫
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Chi tiết */}
              <div className="grid grid-cols-3 gap-6 mt-8">
                {/* Biểu đồ tuyến */}
                <Card className="col-span-2 p-6 bg-white shadow-md rounded-2xl">
                  <h2 className="text-lg font-semibold mb-4 text-gray-700">
                    Doanh thu hằng ngày
                  </h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" />
                      <YAxis
                        tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                      />
                      <Tooltip formatter={(v) => `${v.toLocaleString()} ₫`} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#00A8B0"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                {/* Sản phẩm bán chạy */}
                <Card className="col-span-1 p-6 bg-white shadow-md rounded-2xl">
                  <h2 className="text-lg font-semibold mb-4 text-gray-700">
                    Top sản phẩm bán chạy
                  </h2>
                  {topProducts.length === 0 ? (
                    <p className="text-center text-gray-500 py-10">
                      Không có dữ liệu.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left">Mặt hàng</th>
                          <th className="text-right">SL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.slice(0, 5).map((item, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-3 flex items-center gap-3">
                              <img
                                src={item.imageUrl || "/img/default.jpg"}
                                alt={item.productName}
                                className="w-10 h-10 rounded-md object-cover"
                              />
                              <div>
                                <p className="font-semibold text-gray-800">
                                  {item.productName}
                                </p>
                                <p className="text-[#00A8B0] text-xs">
                                  {(item.averagePrice || 0).toLocaleString()} ₫
                                </p>
                              </div>
                            </td>
                            <td className="text-right text-gray-700 font-medium">
                              {item.totalQuantitySold || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}

export default withRouter(DashboardPage);
