import React from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { Card } from "@/components/ui/card";
import Sidebar from "@/components/sidebar";
import {
  ChartBar, Wallet, Receipt, Power, UserCircle2, CircleDot
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
    topProducts: [],
    topCategories: [],
    revenueData: [],
    user: null,
    shiftId: 0,
    openedAt: null,
    closing: false,
    shiftStatus: 0, // 0: Chưa mở ca, 1: Đang mở ca, 2: Đã đóng ca
  };

  async componentDidMount() {
    this.loadUser();
    await this.loadStats();
    await this.loadShiftStatus();
  }

  /*lOAD USER INFO */
  loadUser() {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const currentShift = JSON.parse(localStorage.getItem("currentShift") || "{}");

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
  /* 🔍 CHECK SHIFT STATUS */
  async loadShiftStatus() {
    try {
      const token = localStorage.getItem("accessToken");
      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const shopId = profile?.shopId ?? 0;
      const { shiftId } = this.state;

      if (!token || !shopId || !shiftId) {
        this.setState({ shiftStatus: 0 });
        return;
      }

      const res = await fetch(
        `${API_URL}/api/shifts?shopId=${shopId}&page=1&pageSize=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json().catch(() => null);
      const current = data?.items?.find((s) => s.shiftId === shiftId);

      this.setState({ shiftStatus: current ? current.status : 0 });
    } catch {
      this.setState({ shiftStatus: 0 });
    }
  }

  /*  LOAD DASHBOARD DATA */
  async loadStats() {
    try {
      this.setState({ loading: true });

      const token = localStorage.getItem("accessToken");
      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const shopId = profile?.shopId ?? 0;

      if (!token || !shopId) return;

      const res = await fetch(`${API_URL}/api/reports/statistics-overview?shopId=${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => null);
      const daily = data?.revenueStats?.dailyRevenues || [];
      const topProducts = data?.topProducts || [];
      const topCategories = data?.topCategories || [];

      const today = daily.at(-1);
      const todayRevenue = today?.revenue || 0;
      const todayInvoices = data?.totalInvoices ?? 0;

      const revenueData = daily.map((d) => ({
        day: new Date(d.date).toLocaleDateString("vi-VN", { weekday: "short" }),
        value: Number(d.revenue || 0),
      }));

      this.setState({
        stats: data,
        todayRevenue,
        todayInvoices,
        topProducts,
        topCategories,
        revenueData,
      });
    } finally {
      this.setState({ loading: false });
    }
  }

  /* 🧾 ĐÓNG CA LÀM VIỆC */
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

    if (!shiftId || shiftId === 0) {
      alert("❌ Không tìm thấy ShiftId hợp lệ để đóng ca!");
      return;
    }

    if (shiftStatus === 2) {
      // 🔄 Nếu ca đã đóng → chuyển hướng sang mở ca
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
        body: JSON.stringify({ shiftId: Number(shiftId) }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && (data?.status === 2 || data?.success)) {
        alert("✅ Đã đóng ca thành công!");
        this.setState({ shiftStatus: 2 });

        const currentShift = JSON.parse(localStorage.getItem("currentShift") || "{}");
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
    const COLORS = ["#00A8B0", "#FF914D", "#CCCCCC"];
    const {
      todayRevenue,
      todayInvoices,
      topProducts,
      topCategories,
      revenueData,
      user,
      closing,
      openedAt,
      shiftStatus,
      loading,
    } = this.state;

    const hasData =
      topProducts.length > 0 ||
      topCategories.length > 0 ||
      (todayRevenue && todayInvoices);

    const isClosed = shiftStatus === 2;

    return (
      <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-[#EAFDFC] to-[#F7E7CE]">
        <Sidebar active="dashboard" />
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Header user info */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <UserCircle2 className="w-10 h-10 text-[#00A8B0]" />
              <div>
                <h2 className="text-lg font-semibold text-[#007E85]">{user?.fullName}</h2>
                <p className="text-sm text-gray-500">{user?.shopName} • {user?.username}</p>
                <div className="flex items-center gap-2 mt-1">
                  <CircleDot className={`w-3 h-3 ${isClosed ? "text-red-500" : "text-green-500"}`} />
                  <span className={`text-sm font-medium ${isClosed ? "text-red-600" : "text-green-700"}`}>
                    {isClosed
                      ? "Ca đã đóng"
                      : `Ca đang mở ${openedAt ? `(Bắt đầu: ${new Date(openedAt).toLocaleTimeString("vi-VN")})` : ""}`}
                  </span>
                </div>
              </div>
            </div>

            {/* 🔘 Nút Đóng/Mở ca */}
            <button
              onClick={this.handleCloseShift}
              disabled={closing}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-white transition-all ${
                closing
                  ? "bg-gray-400 cursor-not-allowed"
                  : isClosed
                  ? "bg-[#00A8B0] hover:bg-[#008f8a]" // nút mở ca
                  : "bg-[#FF6D60] hover:bg-[#ff4c3f]" // nút đóng ca
              }`}
            >
              <Power className="w-5 h-5" />
              {closing
                ? "Đang xử lý..."
                : isClosed
                ? "Mở ca"
                : "Đóng ca"}
            </button>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-extrabold text-[#007E85] mb-8 uppercase tracking-wide">
            Báo cáo doanh thu
          </h1>

          {loading ? (
            <p className="text-center text-gray-500 text-lg mt-10">Đang tải dữ liệu...</p>
          ) : !hasData ? (
            <p className="text-center text-gray-500 text-lg mt-20">
              ⏳ Chưa có dữ liệu thống kê trong ngày hôm nay.
            </p>
          ) : (
            <>
              {/* TOP SECTION */}
              <div className="grid grid-cols-3 gap-6">
                {/* Tổng doanh thu */}
                <Card className="col-span-1 p-6 bg-white shadow-md rounded-2xl">
                  <h2 className="text-lg font-semibold mb-4 text-gray-700">Tổng doanh thu</h2>
                  <div className="flex justify-center items-center h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={topCategories.map((c) => ({
                            name: c.categoryName || "Khác",
                            value: c.totalRevenue || 0,
                          }))}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={80}
                          innerRadius={50}
                          paddingAngle={3}
                        >
                          {topCategories.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-center text-xl font-bold text-[#00A8B0] mt-1">
                    {todayRevenue ? `${(todayRevenue / 1000000).toFixed(1)}M VND` : "0 VND"}
                  </p>
                </Card>

                {/* Tổng giao dịch */}
                <Card className="col-span-2 p-6 bg-white shadow-md rounded-2xl flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 text-[#FF914D] font-semibold">
                        <Receipt className="w-5 h-5" />
                        Tổng giao dịch
                      </div>
                      <p className="text-3xl font-bold mt-1">
                        {todayInvoices.toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-[#00A8B0] font-semibold">
                        <ChartBar className="w-5 h-5" />
                        Tổng hàng bán ra
                      </div>
                      <p className="text-2xl font-bold text-[#007E85] mt-1">
                        {topProducts
                          .reduce((s, p) => s + (p.totalQuantitySold || 0), 0)
                          .toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-[#FF914D] font-semibold">
                        <Wallet className="w-5 h-5" />
                        Chi tiêu
                      </div>
                      <p className="text-2xl font-bold text-[#FF914D] mt-1">
                        {(todayRevenue * 0.7).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* BOTTOM SECTION */}
              <div className="grid grid-cols-3 gap-6 mt-8">
                {/* Biểu đồ */}
                <Card className="col-span-2 p-6 bg-white shadow-md rounded-2xl">
                  <h2 className="text-lg font-semibold mb-4 text-gray-700">Doanh thu hằng ngày</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" />
                      <YAxis tickFormatter={(v) => `${v / 1000000}M`} />
                      <Tooltip formatter={(v) => `${v.toLocaleString()} VND`} />
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

                {/* Bán chạy */}
                <Card className="col-span-1 p-6 bg-white shadow-md rounded-2xl">
                  <h2 className="text-lg font-semibold mb-4 text-gray-700">Bán chạy</h2>
                  {topProducts.length === 0 ? (
                    <p className="text-center text-gray-500 py-10">
                      Không có dữ liệu bán chạy.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left">Mặt hàng</th>
                          <th className="text-right">Số lượng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-3 flex items-center gap-3">
                              <img
                                src={item.imageUrl || "/img/default.jpg"}
                                alt={item.productName}
                                className="w-10 h-10 rounded-md object-cover"
                              />
                              <div>
                                <p className="font-semibold text-gray-800">{item.productName}</p>
                                <p className="text-[#00A8B0] text-xs">
                                  {(item.averagePrice || 0).toLocaleString()} VND
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