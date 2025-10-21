// @ts-nocheck
import React from "react";
import { Search, Shield, UserCog } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import API_URL from "@/config/api";
import { getAuthToken, getShopId } from "@/services/AuthStore";

export default class UserFeaturePage extends React.Component {
  state = {
    users: [],
    features: [],
    selectedUser: null,
    userFeatures: {},
    search: "",
    loading: false,
    saving: false,
  };

  async componentDidMount() {
    await this.loadUsers();
    await this.loadFeatures();
  }

  // ============ API ==============
  async loadUsers() {
    try {
      this.setState({ loading: true });
      const token = await getAuthToken();
      const shopId = await getShopId();
      if (!token || !shopId) return;

      const res = await fetch(`${API_URL}/api/users?ShopId=${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const users = (json.items || json.data?.items || []).filter(
        (u) => Number(u.role) === 2
      );
      this.setState({ users });
    } catch (e) {
      console.error("[loadUsers] error:", e);
    } finally {
      this.setState({ loading: false });
    }
  }

  async loadFeatures() {
    try {
      const token = await getAuthToken();
      const shopId = await getShopId();
      if (!token || !shopId) return;

      const res = await fetch(`${API_URL}/api/feature?ShopId=${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const features = json.items || json.data?.items || [];
      this.setState({ features });
    } catch (e) {
      console.error("[loadFeatures] error:", e);
    }
  }

  async loadUserFeatures(userId) {
    try {
      this.setState({ loading: true, selectedUser: { userId } });
      const token = await getAuthToken();
      if (!token || !userId) return;

      const res = await fetch(
        `${API_URL}/api/userfeature?UserId=${userId}&page=1&pageSize=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = await res.json();
      const items = json.items || json.data?.items || [];
      const map = {};
      for (const f of items) map[f.featureId] = !!f.isEnabled;
      this.setState({ userFeatures: map });
    } catch (e) {
      console.error("[loadUserFeatures] error:", e);
    } finally {
      this.setState({ loading: false });
    }
  }

  async saveUserFeatures() {
    try {
      const { selectedUser, userFeatures } = this.state;
      if (!selectedUser?.userId) return;

      this.setState({ saving: true });
      const token = await getAuthToken();
      const payload = {
        userId: selectedUser.userId,
        features: Object.keys(userFeatures).map((id) => ({
          featureId: Number(id),
          isEnable: userFeatures[id],
        })),
      };

      const res = await fetch(`${API_URL}/api/userfeature`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("✅ Cập nhật quyền thành công!");
      } else {
        alert("❌ Lưu thất bại, vui lòng thử lại.");
      }
    } catch (e) {
      console.error("[saveUserFeatures] error:", e);
      alert("Đã có lỗi xảy ra.");
    } finally {
      this.setState({ saving: false });
    }
  }

  // ============ Render ==============
  renderHeader() {
    const { search } = this.state;
    return (
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold text-[#007E85] flex items-center gap-2">
          <Shield className="w-7 h-7 text-[#00A8B0]" />
          Quản lý quyền nhân viên
        </h1>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Tìm kiếm nhân viên..."
              value={search}
              onChange={(e) => this.setState({ search: e.target.value })}
              className="pl-12 w-72 h-11 text-base rounded-xl bg-white/80 border border-gray-200 focus-visible:ring-0"
            />
          </div>
          <Button
            onClick={() => this.loadUsers()}
            className="bg-[#00A8B0] text-white text-base rounded-xl px-6 py-3 hover:bg-[#00929A] flex items-center gap-2"
          >
            Làm mới
          </Button>
        </div>
      </div>
    );
  }

  renderUserList() {
    const { users, search, selectedUser } = this.state;
    const filtered = users.filter((u) => {
      const q = search.toLowerCase();
      return (
        u.fullName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
      );
    });

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-10">
        {filtered.map((u) => (
          <Card
            key={u.userId}
            onClick={() => this.loadUserFeatures(u.userId)}
            className={`cursor-pointer transition-all duration-300 p-5 rounded-2xl border-2 hover:shadow-md ${
              selectedUser?.userId === u.userId
                ? "border-[#00A8B0] bg-[#E1FBFF]"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#00A8B0]/10 flex items-center justify-center text-[#00A8B0] font-bold text-lg">
                {u.fullName?.[0] || u.username?.[0]}
              </div>
              <div>
                <p className="font-semibold text-gray-800">
                  {u.fullName || u.username}
                </p>
                <p className="text-sm text-gray-500">
                  {u.phoneNumber || "—"}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  renderFeatureList() {
    const { features, userFeatures, selectedUser, saving } = this.state;
    if (!selectedUser) return null;

    return (
      <div className="border-t pt-6">
        <h2 className="text-2xl font-semibold mb-6 text-[#007E85] flex items-center gap-2">
          <UserCog className="w-6 h-6 text-[#00A8B0]" />
          Quyền truy cập của{" "}
          <span className="text-[#00A8B0]">
            {selectedUser.fullName || selectedUser.username}
          </span>
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <label
              key={f.featureId}
              className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition"
            >
              <input
                type="checkbox"
                checked={!!userFeatures[f.featureId]}
                onChange={(e) =>
                  this.setState((prev) => ({
                    userFeatures: {
                      ...prev.userFeatures,
                      [f.featureId]: e.target.checked,
                    },
                  }))
                }
                className="w-4 h-4 accent-[#00A8B0]"
              />
              <span className="font-medium text-gray-700">
                {f.featureName}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <Button
            onClick={() => this.saveUserFeatures()}
            disabled={saving}
            className="bg-[#00A8B0] text-white rounded-lg px-6 py-2 hover:bg-[#00929A]"
          >
            {saving ? "Đang lưu..." : "💾 Lưu thay đổi"}
          </Button>
          <Button
            variant="outline"
            className="rounded-lg px-6 py-2 text-gray-600"
            onClick={() => this.setState({ selectedUser: null })}
          >
            Đóng
          </Button>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto relative">
          {this.renderHeader()}
          {this.renderUserList()}
          {this.renderFeatureList()}
        </div>
      </div>
    );
  }
}
