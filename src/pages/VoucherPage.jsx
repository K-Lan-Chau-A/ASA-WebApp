import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, X, Edit3, Trash2 } from "lucide-react";
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
    showEditModal: false,
    showDetailModal: false,

    // form
    code: "",
    value: "",
    type: 1, // 1: tiền, 2: %
    expireDate: "",
    expireTime: "",

    selectedVoucher: null,
  };

  componentDidMount() {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    if (!profile?.shopId) return;
    this.setState({ shopId: profile.shopId }, this.loadVouchers);
  }

  getToken = () => localStorage.getItem("accessToken");

  loadVouchers = async () => {
    const { shopId } = this.state;
    const token = this.getToken();
    if (!shopId) return;
    this.setState({ loading: true });
    try {
      const res = await fetch(`${API_URL}/api/vouchers?ShopId=${shopId}&page=1&pageSize=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      this.setState({ vouchers: items });
    } catch (err) {
      alert("Không thể tải danh sách voucher");
    } finally {
      this.setState({ loading: false });
    }
  };

  handleAddVoucher = async () => {
    const { code, value, type, expireDate, expireTime, shopId } = this.state;
    const token = this.getToken();

    if (!code.trim()) return alert("Vui lòng nhập mã voucher");
    if (!/^[A-Z0-9]+$/.test(code.trim())) return alert("Mã chỉ gồm CHỮ HOA và SỐ");
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return alert("Giá trị không hợp lệ");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) return alert("Ngày hết hạn sai định dạng (YYYY-MM-DD)");

    const expired = `${expireDate}T${(expireTime || "23:59")}:00`;
    const payload = {
      shopId,
      code,
      value: num,
      type,
      expired,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_URL}/api/vouchers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      alert("🎉 Thêm voucher thành công!");
      this.toggleAddModal();
      this.loadVouchers();
    } catch {
      alert("❌ Lỗi khi thêm voucher");
    }
  };

  handleDelete = async (voucherId) => {
    if (!window.confirm("Xóa voucher này?")) return;
    const token = this.getToken();
    try {
      const res = await fetch(`${API_URL}/api/vouchers/${voucherId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      alert("🗑️ Đã xóa voucher!");
      this.loadVouchers();
    } catch {
      alert("Không thể xóa voucher");
    }
  };

  /* ---------- UI ---------- */
  toggleAddModal = () => this.setState((s) => ({ showAddModal: !s.showAddModal }));
  openDetailModal = (v) => this.setState({ selectedVoucher: v, showDetailModal: true });
  closeDetailModal = () => this.setState({ showDetailModal: false, selectedVoucher: null });

  renderAddModal() {
    const { code, value, type, expireDate, expireTime } = this.state;
    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white w-[500px] rounded-2xl shadow-2xl p-8 relative">
          <button
            onClick={this.toggleAddModal}
            className="absolute top-5 right-5 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-2xl font-extrabold text-[#007E85] mb-6">🎁 TẠO VOUCHER</h2>

          <div className="space-y-4">
            <div>
              <label className="font-semibold">Mã voucher *</label>
              <Input
                placeholder="VD: SALE50"
                value={code}
                onChange={(e) => this.setState({ code: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="font-semibold">Loại *</label>
              <select
                className="w-full border rounded-md p-2"
                value={type}
                onChange={(e) => this.setState({ type: Number(e.target.value) })}
              >
                <option value={1}>Tiền mặt (₫)</option>
                <option value={2}>Phần trăm (%)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold">Giá trị *</label>
              <Input
                type="number"
                placeholder={type === 2 ? "1–100" : "Số tiền"}
                value={value}
                onChange={(e) => this.setState({ value: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold">Ngày hết hạn *</label>
              <Input
                type="text"
                placeholder="YYYY-MM-DD"
                value={expireDate}
                onChange={(e) => this.setState({ expireDate: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold">Giờ hết hạn</label>
              <Input
                type="text"
                placeholder="HH:mm"
                value={expireTime}
                onChange={(e) => this.setState({ expireTime: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={this.toggleAddModal}>
              Hủy
            </Button>
            <Button className="bg-[#00A8B0]" onClick={this.handleAddVoucher}>
              Lưu voucher
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
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto">
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

          {loading ? (
            <p>Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Không có voucher</p>
          ) : (
            <div className="grid gap-4">
              {filtered.map((v) => (
                <Card
                  key={v.voucherId}
                  className="flex items-center justify-between border p-4 rounded-xl bg-white shadow-sm"
                >
                  <div>
                    <p className="font-bold text-xl">{v.code}</p>
                    <p className="text-gray-600 text-sm">
                      HSD: {new Date(v.expired).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="bg-[#00A8B0] text-white px-4 py-2 rounded-full font-semibold">
                      {v.type === 2
                        ? `${v.value}%`
                        : `${fmt.format(v.value)}₫`}
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
