import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, X, Trash2, Gift } from "lucide-react";
import Sidebar from "@/components/sidebar";
import API_URL from "@/config/api";

const fmt = new Intl.NumberFormat("vi-VN");

class VoucherPageClass extends React.Component {
  state = {
    shopId: null,
    vouchers: [],
    loading: false,
    search: "",
    showAddModal: false,

    // form
    code: "",
    value: "",
    type: 1, // 1: tiền, 2: %
    expireDate: "",
    expireTime: "",

    isSubmitting: false,
  };

  /* ---------------- INIT ---------------- */
  componentDidMount() {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    if (!profile?.shopId) return;
    this.setState({ shopId: profile.shopId }, this.loadVouchers);
  }

  getToken = () => localStorage.getItem("accessToken");

  /* ---------------- API ---------------- */
  loadVouchers = async () => {
    const { shopId } = this.state;
    if (!shopId) return;
    this.setState({ loading: true });

    try {
      const token = this.getToken();
      const res = await fetch(
        `${API_URL}/api/vouchers?ShopId=${shopId}&page=1&pageSize=200`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      this.setState({ vouchers: items });
    } catch {
      alert("⚠️ Không thể tải danh sách voucher");
    } finally {
      this.setState({ loading: false });
    }
  };

  handleAddVoucher = async () => {
    const { code, value, type, expireDate, expireTime, shopId } = this.state;
    const token = this.getToken();

    if (!code.trim()) return alert("⚠️ Vui lòng nhập mã voucher");
    if (!/^[A-Z0-9]+$/.test(code.trim()))
      return alert("Mã chỉ gồm CHỮ HOA và SỐ");
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return alert("Giá trị không hợp lệ");
    if (type === 2 && (num < 1 || num > 100))
      return alert("Phần trăm phải từ 1 đến 100");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expireDate))
      return alert("Ngày hết hạn sai định dạng (YYYY-MM-DD)");

    const expired = `${expireDate}T${expireTime || "23:59"}:00`;

    const payload = {
      shopId,
      code: code.trim(),
      value: num,
      type,
      expired,
      createdAt: new Date().toISOString(),
    };

    this.setState({ isSubmitting: true });
    try {
      const res = await fetch(`${API_URL}/api/vouchers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Tạo thất bại");
      alert("🎉 Thêm voucher thành công!");
      this.toggleAddModal();
      await this.loadVouchers();
      this.setState({
        code: "",
        value: "",
        type: 1,
        expireDate: "",
        expireTime: "",
      });
    } catch {
      alert("❌ Lỗi khi thêm voucher");
    } finally {
      this.setState({ isSubmitting: false });
    }
  };

  handleDelete = async (voucherId) => {
    if (!window.confirm("🗑️ Xóa voucher này?")) return;
    const token = this.getToken();
    try {
      const res = await fetch(`${API_URL}/api/vouchers/${voucherId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      alert("✅ Đã xóa voucher!");
      this.loadVouchers();
    } catch {
      alert("❌ Không thể xóa voucher");
    }
  };

  /* ---------------- UI ---------------- */
  toggleAddModal = () =>
    this.setState((s) => ({ showAddModal: !s.showAddModal }));

  renderAddModal() {
    const { code, value, type, expireDate, expireTime, isSubmitting } =
      this.state;

    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white w-[500px] rounded-2xl shadow-2xl p-8 relative">
          <button
            onClick={this.toggleAddModal}
            className="absolute top-5 right-5 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-2xl font-extrabold text-[#007E85] mb-6 flex items-center gap-2">
            <Gift className="w-6 h-6 text-[#00A8B0]" /> TẠO VOUCHER
          </h2>

          <div className="space-y-5">
            <div>
              <label className="font-semibold text-gray-800">
                Mã voucher *
              </label>
              <Input
                placeholder="VD: SALE50"
                value={code}
                onChange={(e) =>
                  this.setState({ code: e.target.value.toUpperCase() })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Chỉ gồm chữ in hoa và số (không dấu)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-gray-800">Loại *</label>
                <select
                  className="w-full border rounded-md p-2"
                  value={type}
                  onChange={(e) =>
                    this.setState({ type: Number(e.target.value) })
                  }
                >
                  <option value={1}>Tiền mặt (₫)</option>
                  <option value={2}>Phần trăm (%)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-gray-800">Giá trị *</label>
                <Input
                  type="number"
                  placeholder={type === 2 ? "1–100" : "Số tiền"}
                  value={value}
                  onChange={(e) => this.setState({ value: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-gray-800">
                  Ngày hết hạn *
                </label>
                <Input
                  type="text"
                  placeholder="YYYY-MM-DD"
                  value={expireDate}
                  onChange={(e) =>
                    this.setState({ expireDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="font-semibold text-gray-800">
                  Giờ hết hạn
                </label>
                <Input
                  type="text"
                  placeholder="HH:mm"
                  value={expireTime}
                  onChange={(e) =>
                    this.setState({ expireTime: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <Button
              variant="outline"
              className="rounded-lg px-6 py-2 text-gray-600"
              onClick={this.toggleAddModal}
            >
              Hủy
            </Button>
            <Button
              className="bg-[#00A8B0] text-white rounded-lg px-6 py-2 hover:bg-[#00929A]"
              onClick={this.handleAddVoucher}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang lưu..." : "Lưu voucher"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { vouchers, loading, search, showAddModal } = this.state;
    const filtered = vouchers.filter((v) =>
      v.code?.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85]">VOUCHER</h1>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm mã voucher..."
                  value={search}
                  onChange={(e) => this.setState({ search: e.target.value })}
                  className="pl-12 w-72 h-11 text-base rounded-xl bg-white/80 border border-gray-200 focus-visible:ring-0"
                />
              </div>
              <Button
                className="bg-[#00A8B0] text-white text-base rounded-xl px-6 py-3 hover:bg-[#00929A] flex items-center gap-2"
                onClick={this.toggleAddModal}
              >
                <Plus className="w-5 h-5" /> Thêm voucher
              </Button>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="text-center text-gray-500">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              Không có voucher nào
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((v) => (
                <Card
                  key={v.voucherId}
                  className="flex items-center justify-between border p-5 rounded-xl bg-white shadow-sm hover:shadow-md transition"
                >
                  <div>
                    <p className="font-bold text-lg text-gray-800">{v.code}</p>
                    <p className="text-gray-500 text-sm">
                      HSD: {new Date(v.expired).toLocaleString("vi-VN")}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={`px-4 py-2 rounded-full font-semibold ${
                        v.type === 2
                          ? "bg-orange-500 text-white"
                          : "bg-[#00A8B0] text-white"
                      }`}
                    >
                      {v.type === 2 ? `${v.value}%` : `${fmt.format(v.value)}₫`}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => this.handleDelete(v.voucherId)}
                      className="hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {showAddModal && this.renderAddModal()}
        </div>
      </div>
    );
  }
}

export default function VoucherPage() {
  return <VoucherPageClass />;
}
