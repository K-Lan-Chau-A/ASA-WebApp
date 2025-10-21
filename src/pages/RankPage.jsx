import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Sidebar from "@/components/sidebar";
import API_URL from "@/config/api";
import { Plus, Search, X, Pencil, Trash2 } from "lucide-react";

const fmt = new Intl.NumberFormat("vi-VN");

class RankPageClass extends React.Component {
  state = {
    shopId: null,
    ranks: [],
    loading: false,
    search: "",
    showAddModal: false,
    showEditModal: false,
    showDetailModal: false,
    selectedRank: null,
    rankName: "",
    benefit: "",
    threshold: "",
  };

  componentDidMount() {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    if (profile?.shopId) {
      this.setState({ shopId: profile.shopId }, this.loadRanks);
    }
  }

  getToken = () => localStorage.getItem("accessToken");

  /* ---------- FETCH ---------- */
  loadRanks = async () => {
    const { shopId } = this.state;
    const token = this.getToken();
    if (!shopId) return;
    this.setState({ loading: true });
    try {
      const res = await fetch(`${API_URL}/api/ranks?ShopId=${shopId}&page=1&pageSize=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      this.setState({ ranks: data.items || [] });
    } catch {
      alert("Không thể tải danh sách hạng khách hàng");
    } finally {
      this.setState({ loading: false });
    }
  };

  /* ---------- HANDLERS ---------- */
  toggleAddModal = () => this.setState((s) => ({ showAddModal: !s.showAddModal }));
  toggleEditModal = () => this.setState((s) => ({ showEditModal: !s.showEditModal }));
  closeDetailModal = () => this.setState({ showDetailModal: false, selectedRank: null });

  openDetailModal = (r) => this.setState({ selectedRank: r, showDetailModal: true });

  openEditModal = (r) =>
    this.setState({
      selectedRank: r,
      rankName: r.rankName,
      benefit: (r.benefit * 100).toString(),
      threshold: r.threshold ? r.threshold.toString() : "",
      showEditModal: true,
    });

  /* ---------- CRUD ---------- */
  handleAddRank = async () => {
    const { rankName, benefit, threshold, shopId } = this.state;
    const token = this.getToken();
    if (!rankName.trim()) return alert("Nhập tên hạng");
    const b = parseFloat(benefit);
    if (isNaN(b) || b < 0) return alert("Chiết khấu không hợp lệ");

    const payload = {
      rankName: rankName.trim(),
      benefit: b / 100,
      threshold: threshold ? parseFloat(threshold) : null,
      shopId,
    };

    try {
      const res = await fetch(`${API_URL}/api/ranks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      alert("🎉 Thêm hạng thành công!");
      this.toggleAddModal();
      this.loadRanks();
    } catch {
      alert("❌ Thêm hạng thất bại");
    }
  };

  handleUpdateRank = async () => {
    const { selectedRank, rankName, benefit, threshold, shopId } = this.state;
    const token = this.getToken();
    if (!selectedRank) return;
    const payload = {
      rankName,
      benefit: parseFloat(benefit) / 100,
      threshold: threshold ? parseFloat(threshold) : null,
      shopId,
    };
    try {
      const res = await fetch(`${API_URL}/api/ranks/${selectedRank.rankId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      alert("✅ Cập nhật thành công!");
      this.toggleEditModal();
      this.loadRanks();
    } catch {
      alert("❌ Lỗi khi cập nhật");
    }
  };

  handleDeleteRank = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa hạng này?")) return;
    const token = this.getToken();
    try {
      const res = await fetch(`${API_URL}/api/ranks/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      alert("🗑️ Đã xóa hạng!");
      this.loadRanks();
    } catch {
      alert("Không thể xóa hạng");
    }
  };

  /* ---------- MODALS ---------- */
  renderAddModal() {
    const { rankName, benefit, threshold } = this.state;
    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white w-[500px] rounded-2xl shadow-2xl p-8 relative">
          <button
            onClick={this.toggleAddModal}
            className="absolute top-5 right-5 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-extrabold text-[#007E85] mb-6">🆕 Thêm hạng khách hàng</h2>

          <div className="space-y-4">
            <div>
              <label className="font-semibold">Tên hạng *</label>
              <Input
                placeholder="VD: Bạc, Vàng, Kim Cương"
                value={rankName}
                onChange={(e) => this.setState({ rankName: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold">Chiết khấu (%) *</label>
              <Input
                type="number"
                placeholder="VD: 5"
                value={benefit}
                onChange={(e) => this.setState({ benefit: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold">Ngưỡng tiêu dùng (VNĐ)</label>
              <Input
                type="number"
                placeholder="VD: 1000000"
                value={threshold}
                onChange={(e) => this.setState({ threshold: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={this.toggleAddModal}>
              Hủy
            </Button>
            <Button className="bg-[#00A8B0]" onClick={this.handleAddRank}>
              Lưu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  renderEditModal() {
    const { rankName, benefit, threshold } = this.state;
    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white w-[500px] rounded-2xl shadow-2xl p-8 relative">
          <button
            onClick={this.toggleEditModal}
            className="absolute top-5 right-5 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-extrabold text-[#007E85] mb-6">✏️ Chỉnh sửa hạng</h2>

          <div className="space-y-4">
            <div>
              <label className="font-semibold">Tên hạng *</label>
              <Input
                value={rankName}
                onChange={(e) => this.setState({ rankName: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold">Chiết khấu (%) *</label>
              <Input
                type="number"
                value={benefit}
                onChange={(e) => this.setState({ benefit: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold">Ngưỡng tiêu dùng (VNĐ)</label>
              <Input
                type="number"
                value={threshold}
                onChange={(e) => this.setState({ threshold: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={this.toggleEditModal}>
              Hủy
            </Button>
            <Button className="bg-[#00A8B0]" onClick={this.handleUpdateRank}>
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  renderDetailModal() {
    const { selectedRank } = this.state;
    if (!selectedRank) return null;
    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white w-[480px] rounded-2xl shadow-2xl p-8 relative">
          <button
            onClick={this.closeDetailModal}
            className="absolute top-5 right-5 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-extrabold text-[#007E85] mb-6">🏅 Chi tiết hạng</h2>

          <div className="space-y-4">
            <p><b>Tên:</b> {selectedRank.rankName}</p>
            <p><b>Chiết khấu:</b> {(selectedRank.benefit * 100).toFixed(1)}%</p>
            <p><b>Ngưỡng:</b> {selectedRank.threshold ? fmt.format(selectedRank.threshold) + "đ" : "Không giới hạn"}</p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={this.closeDetailModal}>Đóng</Button>
            <Button className="bg-[#00A8B0]" onClick={() => this.openEditModal(selectedRank)}>
              Sửa
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- UI ---------- */
  render() {
    const { ranks, search, loading, showAddModal, showEditModal, showDetailModal } = this.state;
    const filtered = ranks.filter((r) =>
      r.rankName.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85]">XẾP HẠNG KHÁCH HÀNG</h1>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm hạng..."
                  value={search}
                  onChange={(e) => this.setState({ search: e.target.value })}
                  className="pl-12 w-72 h-11 text-base rounded-xl bg-white/80 border border-gray-200 focus-visible:ring-0"
                />
              </div>
              <Button
                className="bg-[#00A8B0] text-white text-base rounded-xl px-6 py-3 hover:bg-[#00929A] flex items-center gap-2"
                onClick={this.toggleAddModal}
              >
                <Plus className="w-5 h-5" /> Thêm hạng
              </Button>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <p>Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Không có hạng</p>
          ) : (
            <div className="grid gap-4">
              {filtered.map((r) => (
                <Card
                  key={r.rankId}
                  className="flex justify-between items-center p-5 rounded-xl bg-white shadow-sm border"
                >
                  <div>
                    <p className="font-bold text-lg text-gray-800">{r.rankName}</p>
                    <p className="text-gray-600 text-sm">
                      {(r.benefit * 100).toFixed(1)}% chiết khấu &nbsp;|&nbsp;
                      {r.threshold
                        ? `${fmt.format(r.threshold)}₫`
                        : "Không giới hạn"}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => this.openDetailModal(r)}
                    >
                      <Pencil className="w-5 h-5 text-[#00A8B0]" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => this.handleDeleteRank(r.rankId)}
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {showAddModal && this.renderAddModal()}
          {showEditModal && this.renderEditModal()}
          {showDetailModal && this.renderDetailModal()}
        </div>
      </div>
    );
  }
}

export default function RankPage() {
  const navigate = useNavigate();
  return <RankPageClass navigate={navigate} />;
}
