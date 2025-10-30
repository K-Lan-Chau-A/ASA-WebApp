import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Sidebar from "@/components/sidebar";
import { Plus, Search, Gift, Pencil, Trash2, Tag, Clock } from "lucide-react";
import API_URL from "@/config/api";
import { getAuthToken, getShopId } from "@/services/AuthStore";

class PromotionPage extends React.Component {
  state = {
    promotions: [],
    products: [],
    categories: [],
    selectedProducts: [],
    showAddModal: false,
    showEditModal: false,
    editing: null,
    search: "",
    loading: false,
    form: {
      name: "",
      startDate: "",
      endDate: "",
      type: 1,
      value: "",
    },
  };

  componentDidMount() {
    this.loadPromotions();
  }

  getToken = () => localStorage.getItem("accessToken");

  /* ---------- LOAD DATA ---------- */
  loadPromotions = async () => {
    const token = this.getToken();
    const shopId = (await getShopId()) ?? 0;
    this.setState({ loading: true });
    try {
      const res = await fetch(`${API_URL}/api/promotions?ShopId=${shopId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      this.setState({ promotions: data.items || [] });
    } catch {
      this.setState({ promotions: [] });
    } finally {
      this.setState({ loading: false });
    }
  };

  /* ---------- CRUD ---------- */
  handleCreate = async () => {
    const { form } = this.state;
    const token = this.getToken();
    const shopId = (await getShopId()) ?? 0;

    if (!form.name.trim()) return alert("Vui lòng nhập tên khuyến mãi");
    if (!form.startDate || !form.endDate)
      return alert("Vui lòng nhập thời gian");

    const payload = {
      shopId,
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      type: form.type,
      value: parseFloat(form.value),
      productIds: this.state.selectedProducts,
      status: 1,
    };

    try {
      const res = await fetch(`${API_URL}/api/promotions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      alert("✅ Tạo khuyến mãi thành công!");
      this.setState({
        showAddModal: false,
        form: { name: "", startDate: "", endDate: "", type: 1, value: "" },
      });
      this.loadPromotions();
    } catch {
      alert("❌ Lỗi khi tạo khuyến mãi");
    }
  };

  handleEdit = (p) => {
    this.setState({
      showEditModal: true,
      editing: p,
      form: {
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        type: p.type,
        value: p.value.toString(),
      },
    });
  };

  handleUpdate = async () => {
    const { form, editing } = this.state;
    if (!editing) return;
    const token = this.getToken();
    try {
      const res = await fetch(
        `${API_URL}/api/promotions/${editing.promotionId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...form,
            shopId: await getShopId(),
            value: parseFloat(form.value),
            productIds: this.state.selectedProducts,
          }),
        }
      );
      if (!res.ok) throw new Error();
      alert("✅ Cập nhật thành công!");
      this.setState({ showEditModal: false, editing: null });
      this.loadPromotions();
    } catch {
      alert("❌ Lỗi khi cập nhật khuyến mãi");
    }
  };

  handleDelete = async (id) => {
    if (!window.confirm("Xóa khuyến mãi này?")) return;
    const token = this.getToken();
    try {
      const res = await fetch(`${API_URL}/api/promotions/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      alert("🗑️ Đã xóa khuyến mãi");
      this.loadPromotions();
    } catch {
      alert("❌ Lỗi khi xóa");
    }
  };

  /* ---------- UI ---------- */
  renderModal(isEdit = false) {
    const { form } = this.state;
    const title = isEdit ? "✏️ Chỉnh sửa khuyến mãi" : " Tạo khuyến mãi mới";
    const onSubmit = isEdit ? this.handleUpdate : this.handleCreate;

    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white w-[520px] rounded-2xl shadow-xl p-8 relative">
          <button
            onClick={() =>
              this.setState({ showAddModal: false, showEditModal: false })
            }
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
          <h2 className="text-2xl font-extrabold text-[#007E85] mb-6">
            {title}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="font-semibold">Tên chương trình *</label>
              <Input
                value={form.name}
                onChange={(e) =>
                  this.setState({ form: { ...form, name: e.target.value } })
                }
                placeholder="VD: Giảm giá mùa hè"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="font-semibold">Bắt đầu *</label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    this.setState({
                      form: { ...form, startDate: e.target.value },
                    })
                  }
                />
              </div>
              <div className="flex-1">
                <label className="font-semibold">Kết thúc *</label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    this.setState({
                      form: { ...form, endDate: e.target.value },
                    })
                  }
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="font-semibold">Loại</label>
                <select
                  className="border rounded-lg w-full h-11 px-3"
                  value={form.type}
                  onChange={(e) =>
                    this.setState({
                      form: { ...form, type: Number(e.target.value) },
                    })
                  }
                >
                  <option value={1}>Giảm số tiền</option>
                  <option value={2}>Giảm phần trăm</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="font-semibold">
                  Giá trị ({form.type === 1 ? "VND" : "%"})
                </label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) =>
                    this.setState({ form: { ...form, value: e.target.value } })
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() =>
                this.setState({ showAddModal: false, showEditModal: false })
              }
            >
              Hủy
            </Button>
            <Button className="bg-[#00A8B0]" onClick={onSubmit}>
              {isEdit ? "Lưu thay đổi" : "Tạo khuyến mãi"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { promotions, loading, search, showAddModal, showEditModal } =
      this.state;
    const filtered = promotions.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85]">
              {" "}
              KHUYẾN MÃI
            </h1>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm khuyến mãi..."
                  value={search}
                  onChange={(e) => this.setState({ search: e.target.value })}
                  className="pl-12 w-72 h-11 rounded-xl bg-white/80 border border-gray-200"
                />
              </div>
              <Button
                className="bg-[#00A8B0] text-white text-base rounded-xl px-6 py-3 hover:bg-[#00929A] flex items-center gap-2"
                onClick={() => this.setState({ showAddModal: true })}
              >
                <Plus className="w-5 h-5" /> Tạo mới
              </Button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <p>Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Không có khuyến mãi</p>
          ) : (
            <div className="grid gap-4">
              {filtered.map((p) => (
                <Card
                  key={p.promotionId}
                  className="p-5 flex justify-between items-center"
                >
                  <div>
                    <p className="font-bold text-lg text-gray-800">{p.name}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Clock className="w-4 h-4" />
                      {p.startDate} → {p.endDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-[#00A8B0]/10 text-[#00A8B0] rounded-full text-sm font-semibold">
                      {p.type === 2
                        ? `${p.value}%`
                        : `${p.value.toLocaleString("vi-VN")}₫`}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => this.handleEdit(p)}
                    >
                      <Pencil className="w-5 h-5 text-[#00A8B0]" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => this.handleDelete(p.promotionId)}
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {showAddModal && this.renderModal(false)}
          {showEditModal && this.renderModal(true)}
        </div>
      </div>
    );
  }
}

export default PromotionPage;
