"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, X, Trash2, Gift, Edit } from "lucide-react";
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

    // Form
    code: "",
    value: "",
    type: 1,
    expirePreset: "30",
    customExpireDate: "",
    isSubmitting: false,

    // Editing
    editingVoucher: null,
  };

  componentDidMount() {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    if (!profile?.shopId) return;
    this.setState({ shopId: profile.shopId }, this.loadVouchers);
  }

  getToken = () => localStorage.getItem("accessToken");

  /* ---------------- LOAD ---------------- */
  loadVouchers = async () => {
    const { shopId } = this.state;
    if (!shopId) return;
    this.setState({ loading: true });

    try {
      const token = this.getToken();
      const res = await fetch(
        `${API_URL}/api/vouchers?ShopId=${shopId}&page=1&pageSize=200`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const data = await res.json();
      this.setState({ vouchers: Array.isArray(data.items) ? data.items : [] });
    } catch {
      alert("⚠️ Không thể tải danh sách voucher");
    } finally {
      this.setState({ loading: false });
    }
  };

  /* ---------------- ADD ---------------- */
  handleAddVoucher = async () => {
    const { code, value, type, expirePreset, customExpireDate, shopId } =
      this.state;
    const token = this.getToken();

    if (!code.trim()) return alert("⚠️ Vui lòng nhập mã voucher");
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return alert("Giá trị không hợp lệ");
    if (type === 2 && (num < 1 || num > 100))
      return alert("Phần trăm phải từ 1–100");

    const expiredDate =
      expirePreset === "custom"
        ? customExpireDate
        : new Date(
            Date.now() + Number(expirePreset) * 24 * 60 * 60 * 1000
          ).toISOString();

    const payload = {
      shopId,
      code: code.trim().toUpperCase(),
      value: num,
      type,
      expired: expiredDate,
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
      if (!res.ok) throw new Error();
      alert("✅ Thêm voucher thành công!");
      this.toggleAddModal();
      await this.loadVouchers();
    } catch {
      alert("❌ Lỗi khi thêm voucher");
    } finally {
      this.setState({ isSubmitting: false });
    }
  };

  /* ---------------- EDIT ---------------- */
  openEditModal = (voucher) => {
    const expired = new Date(voucher.expired);
    const formattedDate = expired.toISOString().split("T")[0];
    this.setState({
      editingVoucher: voucher,
      showEditModal: true,
      code: voucher.code,
      value: voucher.value,
      type: voucher.type,
      customExpireDate: formattedDate,
    });
  };

  handleUpdateVoucher = async () => {
    const { editingVoucher, code, value, type, customExpireDate, shopId } =
      this.state;
    const token = this.getToken();
    if (!editingVoucher) return;

    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return alert("Giá trị không hợp lệ");
    if (type === 2 && (num < 1 || num > 100))
      return alert("Phần trăm phải từ 1–100");

    const payload = {
      shopId,
      code: code.trim().toUpperCase(),
      value: num,
      type,
      expired: new Date(customExpireDate).toISOString(),
      createdAt: editingVoucher.createdAt,
    };

    this.setState({ isSubmitting: true });
    try {
      const res = await fetch(
        `${API_URL}/api/vouchers/${editingVoucher.voucherId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error();
      alert("✅ Cập nhật thành công!");
      this.toggleEditModal();
      await this.loadVouchers();
    } catch {
      alert("❌ Lỗi khi cập nhật voucher");
    } finally {
      this.setState({ isSubmitting: false });
    }
  };

  /* ---------------- DELETE ---------------- */
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

  /* ---------------- TOGGLES ---------------- */
  toggleAddModal = () =>
    this.setState((s) => ({ showAddModal: !s.showAddModal }));

  toggleEditModal = () =>
    this.setState((s) => ({ showEditModal: !s.showEditModal }));

  /* ---------------- UI ---------------- */
  renderAddModal() {
    const { code, value, type, expirePreset, customExpireDate, isSubmitting } =
      this.state;

    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white w-[460px] rounded-2xl shadow-2xl p-7 relative animate-fadeIn">
          <button
            onClick={this.toggleAddModal}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-2xl font-bold text-[#007E85] mb-5 flex items-center gap-2">
            <Gift className="w-6 h-6 text-[#00A8B0]" /> Thêm Voucher
          </h2>

          <div className="space-y-4">
            <div>
              <label className="font-medium text-gray-800">Mã voucher *</label>
              <Input
                placeholder="vd: sale50"
                value={code}
                onChange={(e) => this.setState({ code: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-gray-800">Loại *</label>
                <select
                  className="w-full border rounded-lg p-2 mt-1"
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
                <label className="font-medium text-gray-800">Giá trị *</label>
                <Input
                  type="number"
                  placeholder={type === 2 ? "1–100" : "Số tiền (₫)"}
                  value={value}
                  onChange={(e) => this.setState({ value: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-gray-800">Hết hạn *</label>
              <select
                className="w-full border rounded-lg p-2 mt-1"
                value={expirePreset}
                onChange={(e) =>
                  this.setState({ expirePreset: e.target.value })
                }
              >
                <option value="7">7 ngày</option>
                <option value="30">1 tháng</option>
                <option value="90">3 tháng</option>
                <option value="180">6 tháng</option>
                <option value="365">1 năm</option>
                <option value="custom">Tùy chọn...</option>
              </select>

              {expirePreset === "custom" && (
                <Input
                  type="date"
                  className="mt-2"
                  value={customExpireDate}
                  onChange={(e) =>
                    this.setState({ customExpireDate: e.target.value })
                  }
                />
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-lg px-6 text-gray-600"
              onClick={this.toggleAddModal}
            >
              Hủy
            </Button>
            <Button
              className="bg-[#00A8B0] text-white rounded-lg px-6 hover:bg-[#00929A]"
              onClick={this.handleAddVoucher}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  renderEditModal() {
    const { code, value, type, customExpireDate, isSubmitting } = this.state;
    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white w-[460px] rounded-2xl shadow-2xl p-7 relative animate-fadeIn">
          <button
            onClick={this.toggleEditModal}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-2xl font-bold text-[#007E85] mb-5 flex items-center gap-2">
            <Edit className="w-6 h-6 text-[#00A8B0]" /> Cập nhật voucher
          </h2>

          <div className="space-y-4">
            <div>
              <label className="font-medium text-gray-800">Mã voucher *</label>
              <Input
                value={code}
                onChange={(e) => this.setState({ code: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-gray-800">Loại *</label>
                <select
                  className="w-full border rounded-lg p-2 mt-1"
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
                <label className="font-medium text-gray-800">Giá trị *</label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => this.setState({ value: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-gray-800">
                Ngày hết hạn *
              </label>
              <Input
                type="date"
                value={customExpireDate}
                onChange={(e) =>
                  this.setState({ customExpireDate: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-lg px-6 text-gray-600"
              onClick={this.toggleEditModal}
            >
              Hủy
            </Button>
            <Button
              className="bg-[#00A8B0] text-white rounded-lg px-6 hover:bg-[#00929A]"
              onClick={this.handleUpdateVoucher}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang cập nhật..." : "Cập nhật"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { vouchers, loading, search, showAddModal, showEditModal } =
      this.state;
    const filtered = vouchers.filter((v) =>
      v.code?.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-[#007E85] flex items-center gap-2">
              <Gift className="w-7 h-7" /> Voucher
            </h1>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm mã voucher..."
                  value={search}
                  onChange={(e) => this.setState({ search: e.target.value })}
                  className="pl-12 w-72 h-11 text-base rounded-xl bg-white border border-gray-200 focus-visible:ring-0"
                />
              </div>
              <Button
                className="bg-[#00A8B0] text-white rounded-xl px-5 py-2.5 hover:bg-[#00929A] flex items-center gap-2"
                onClick={this.toggleAddModal}
              >
                <Plus className="w-5 h-5" /> Thêm
              </Button>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="text-center text-gray-500 mt-20">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              Không có voucher nào
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((v) => (
                <Card
                  key={v.voucherId}
                  className="p-5 bg-white rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-xl text-[#007E85] uppercase">
                        {v.code}
                      </p>
                      <p className="text-sm text-gray-500">
                        Hết hạn:{" "}
                        {new Date(v.expired).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => this.openEditModal(v)}
                        className="hover:bg-blue-50 text-blue-600"
                      >
                        <Edit className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => this.handleDelete(v.voucherId)}
                        className="hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>

                  <div
                    className={`mt-4 px-4 py-2 text-center rounded-xl font-semibold text-lg ${
                      v.type === 1
                        ? "bg-[#00A8B0] text-white"
                        : "bg-orange-500 text-white"
                    }`}
                  >
                    {v.type === 1 ? `${fmt.format(v.value)}₫` : `${v.value}%`}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {showAddModal && this.renderAddModal()}
          {showEditModal && this.renderEditModal()}
        </div>
      </div>
    );
  }
}

export default function VoucherPage() {
  return <VoucherPageClass />;
}
