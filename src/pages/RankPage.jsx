import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Sidebar from "@/components/sidebar";
import API_URL from "@/config/api";
import { Plus, Search, X, Pencil, Trash2, Percent } from "lucide-react";

const fmt = new Intl.NumberFormat("vi-VN");

class RankPageClass extends React.Component {
  state = {
    shopId: null,
    ranks: [],
    loading: false,
    search: "",
    modalType: null,
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
      const res = await fetch(
        `${API_URL}/api/ranks?ShopId=${shopId}&page=1&pageSize=100`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json();
      this.setState({ ranks: data.items || [] });
    } catch {
      alert("Không thể tải danh sách hạng khách hàng");
    } finally {
      this.setState({ loading: false });
    }
  };

  /* ---------- HANDLERS ---------- */
  openModal = (type, rank = null) => {
    if (type === "add") {
      this.setState({
        modalType: "add",
        rankName: "",
        benefit: "",
        threshold: "",
        selectedRank: null,
      });
    } else if (type === "edit" && rank) {
      this.setState({
        modalType: "edit",
        selectedRank: rank,
        rankName: rank.rankName,
        benefit: (rank.benefit * 100).toString(),
        threshold: rank.threshold ? rank.threshold.toString() : "",
      });
    } else if (type === "detail" && rank) {
      this.setState({ modalType: "detail", selectedRank: rank });
    }
  };

  closeModal = () =>
    this.setState({
      modalType: null,
      selectedRank: null,
      rankName: "",
      benefit: "",
      threshold: "",
    });

  /* ---------- CRUD ---------- */
  handleAddRank = async () => {
    const { rankName, benefit, threshold, shopId } = this.state;
    const token = this.getToken();
    if (!rankName.trim()) return alert("Nhập tên hạng!");
    const b = parseFloat(benefit);
    if (isNaN(b) || b < 0) return alert("Chiết khấu không hợp lệ");

    const payload = {
      rankName: rankName.trim(),
      benefit: parseFloat(benefit) / 100,
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
      this.closeModal();
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
      this.closeModal();
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

  /* ---------- MODAL ---------- */
  renderModal() {
    const { modalType, rankName, benefit, threshold, selectedRank } =
      this.state;
    if (!modalType) return null;

    const title =
      modalType === "add"
        ? " Thêm hạng khách hàng"
        : modalType === "edit"
          ? " Chỉnh sửa hạng"
          : " Chi tiết hạng";

    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-[100]">
        <div className="bg-white w-[400px] rounded-xl shadow-xl p-6 relative animate-fadeIn border border-gray-200">
          <button
            onClick={this.closeModal}
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-lg font-bold text-[#007E85] mb-5">{title}</h2>

          {modalType === "detail" ? (
            <div className="space-y-2 text-gray-700">
              <p>
                <b>Tên:</b> {selectedRank.rankName}
              </p>
              <p>
                <b>Chiết khấu:</b> {(selectedRank.benefit * 100).toFixed(1)}%
              </p>
              <p>
                <b>Ngưỡng:</b>{" "}
                {selectedRank.threshold
                  ? fmt.format(selectedRank.threshold) + "₫"
                  : "Không giới hạn"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên hạng *
                </label>
                <Input
                  placeholder="VD: Vàng, Bạc, Kim Cương"
                  value={rankName}
                  onChange={(e) => this.setState({ rankName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chiết khấu (%) *
                </label>
                <Input
                  type="number"
                  placeholder="VD: 5"
                  value={benefit}
                  onChange={(e) => this.setState({ benefit: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngưỡng tiêu dùng (VNĐ)
                </label>
                <Input
                  type="number"
                  placeholder="VD: 1000000"
                  value={threshold}
                  onChange={(e) => this.setState({ threshold: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="outline" onClick={this.closeModal}>
              Đóng
            </Button>
            {modalType === "add" && (
              <Button className="bg-[#00A8B0]" onClick={this.handleAddRank}>
                Lưu
              </Button>
            )}
            {modalType === "edit" && (
              <Button className="bg-[#00A8B0]" onClick={this.handleUpdateRank}>
                Cập nhật
              </Button>
            )}
            {modalType === "detail" && (
              <Button
                className="bg-[#00A8B0]"
                onClick={() => this.openModal("edit", selectedRank)}
              >
                Sửa
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- UI ---------- */
  render() {
    const { ranks, search, loading } = this.state;
    const filtered = ranks.filter((r) =>
      r.rankName.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-8 overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-[#007E85] uppercase">
              Xếp hạng khách hàng
            </h1>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm hạng..."
                  value={search}
                  onChange={(e) => this.setState({ search: e.target.value })}
                  className="pl-10 w-60 h-10 text-sm rounded-xl bg-white/90 border border-gray-200 focus-visible:ring-0"
                />
              </div>
              <Button
                className="bg-[#00A8B0] text-white text-sm rounded-xl px-5 py-2.5 hover:bg-[#00929A] flex items-center gap-2"
                onClick={() => this.openModal("add")}
              >
                <Plus className="w-4 h-4" /> Thêm hạng
              </Button>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <p>Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">Không có hạng nào</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((r) => (
                <Card
                  key={r.rankId}
                  className="group flex flex-col justify-between p-4 rounded-xl bg-white border hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-[#007E85] text-base truncate">
                        {r.rankName}
                      </h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        ID {r.rankId}
                      </span>
                    </div>
                    <div className="text-gray-700 text-sm mt-1 space-y-1">
                      <div className="flex items-center gap-1">
                        <span>
                          Tỉ lệ chiết khấu:{" "}
                          <b>{(r.benefit * 100).toFixed(1)}%</b>
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>
                          {r.threshold
                            ? `Ngưỡng áp dụng: ${fmt.format(r.threshold)}₫`
                            : "Ngưỡng áp dụng: Không giới hạn"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-3">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => this.openModal("detail", r)}
                    >
                      <Pencil className="w-4 h-4 text-[#00A8B0]" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => this.handleDeleteRank(r.rankId)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {this.renderModal()}
        </div>
      </div>
    );
  }
}

/* Animation */
const style = document.createElement("style");
style.textContent = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn { animation: fadeIn 0.25s ease-out; }
`;
document.head.appendChild(style);

export default function RankPage() {
  const navigate = useNavigate();
  return <RankPageClass navigate={navigate} />;
}
