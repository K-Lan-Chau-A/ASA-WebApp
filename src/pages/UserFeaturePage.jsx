// @ts-nocheck
import React from "react";
import { Search, Shield, UserCog, Plus, X, Edit, Trash2 } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import API_URL from "@/config/api";
import { getAuthToken, getShopId } from "@/services/AuthStore";

const DEBUG = true;
const log = (...a) =>
  DEBUG &&
  console.log(
    "%c[UserFeature]%c",
    "color:#00A8B0;font-weight:700",
    "color:inherit",
    ...a
  );
const err = (...a) =>
  console.error(
    "%c[UserFeature]%c ❌",
    "color:#FF4444;font-weight:700",
    "color:inherit",
    ...a
  );

export default class UserFeaturePage extends React.Component {
  state = {
    users: [],
    features: [],
    selectedUser: null,
    userFeatures: {},
    search: "",
    loading: false,
    saving: false,

    // modals
    showAddModal: false,
    showEditModal: false,

    // form data
    newStaff: {
      username: "",
      password: "",
      fullName: "",
      phoneNumber: "",
      avatarFile: null,
    },
    editingUser: null,
    editData: {
      fullName: "",
      phoneNumber: "",
      citizenIdNumber: "",
      avatarFile: null,
    },
  };

  async componentDidMount() {
    await this.loadUsers();
  }

  /* =========================================================
   * USERS CRUD
   * ========================================================= */
  async loadUsers() {
    try {
      this.setState({ loading: true });
      const token = await getAuthToken();
      const shopId = await getShopId();
      const res = await fetch(
        `${API_URL}/api/users?ShopId=${shopId}&page=1&pageSize=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = await res.json().catch(() => null);
      const users = (json?.items || json?.data?.items || []).filter(
        (u) => Number(u.role) === 2
      );
      this.setState({ users });
      log("👥 Loaded users:", users.length);
    } catch (e) {
      err("loadUsers:", e);
    } finally {
      this.setState({ loading: false });
    }
  }

  async createStaff() {
    try {
      const token = await getAuthToken();
      const shopId = await getShopId();
      const { newStaff } = this.state;

      if (!newStaff.username || !newStaff.password || !newStaff.fullName)
        return alert("⚠️ Vui lòng nhập đủ Tên đăng nhập, Mật khẩu và Họ tên!");

      // ✅ Chuẩn bị FormData gửi đủ trường
      const formData = new FormData();
      formData.append("ShopId", shopId);
      formData.append("Username", newStaff.username);
      formData.append("Password", newStaff.password);
      formData.append("FullName", newStaff.fullName);
      formData.append("PhoneNumber", newStaff.phoneNumber || "");
      formData.append("CitizenIdNumber", newStaff.citizenIdNumber || "");
      formData.append("Status", 1); // đang hoạt động
      formData.append("Role", 2); // 2 = nhân viên
      formData.append("CreatedAt", new Date().toISOString());
      if (newStaff.avatarFile) {
        formData.append("AvatarFile", newStaff.avatarFile);
      } else {
        formData.append("Avatar", "");
      }

      const res = await fetch(`${API_URL}/api/users/create-staff`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const text = await res.text();
      if (!res.ok)
        throw new Error(`create-staff failed (${res.status}) → ${text}`);

      alert("✅ Tạo nhân viên thành công!");
      log("✅ Created:", text);

      this.setState({
        showAddModal: false,
        newStaff: {
          username: "",
          password: "",
          fullName: "",
          phoneNumber: "",
          citizenIdNumber: "",
          avatarFile: null,
        },
      });

      await this.loadUsers();
    } catch (e) {
      err("createStaff:", e);
      alert("❌ Lỗi khi tạo nhân viên mới!");
    }
  }

  openEditModal(user) {
    this.setState({
      showEditModal: true,
      editingUser: user,
      editData: {
        fullName: user.fullName || "",
        phoneNumber: user.phoneNumber || "",
        citizenIdNumber: user.citizenIdNumber || "",
        avatarFile: null,
      },
    });
  }

  async updateUser() {
    try {
      const { editingUser, editData } = this.state;
      const token = await getAuthToken();
      const shopId = await getShopId();

      const formData = new FormData();
      formData.append("ShopId", shopId);
      formData.append("Status", editingUser.status ?? 1);
      if (editData.fullName) formData.append("FullName", editData.fullName);
      if (editData.phoneNumber)
        formData.append("PhoneNumber", editData.phoneNumber);
      if (editData.citizenIdNumber)
        formData.append("CitizenIdNumber", editData.citizenIdNumber);
      if (editData.avatarFile)
        formData.append("AvatarFile", editData.avatarFile);

      const res = await fetch(`${API_URL}/api/users/${editingUser.userId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error(`update failed (${res.status})`);
      alert("✅ Cập nhật nhân viên thành công!");
      this.setState({ showEditModal: false, editingUser: null });
      await this.loadUsers();
    } catch (e) {
      err("updateUser:", e);
      alert("❌ Lỗi khi cập nhật nhân viên");
    }
  }

  async deleteUser(userId) {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nhân viên này?")) return;
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      alert("🗑️ Xóa nhân viên thành công!");
      await this.loadUsers();
    } catch (e) {
      err("deleteUser:", e);
      alert("❌ Lỗi khi xóa nhân viên");
    }
  }

  /* =========================================================
   * FEATURES
   * ========================================================= */
  async loadUserFeatures(user) {
    try {
      const token = await getAuthToken();
      const res = await fetch(
        `${API_URL}/api/userfeature?UserId=${user.userId}&page=1&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json().catch(() => null);
      const items = json?.items || json?.data?.items || [];

      const features = items.map((f) => ({
        featureId: f.featureId,
        featureName: f.featureName,
      }));
      const map = {};
      for (const f of items) map[f.featureId] = !!f.isEnabled;

      this.setState({ selectedUser: user, features, userFeatures: map });
      log(`🔑 Loaded ${items.length} features for ${user.username}`);
    } catch (e) {
      err("loadUserFeatures:", e);
    }
  }

  async saveUserFeatures() {
    try {
      const { selectedUser, userFeatures } = this.state;
      const token = await getAuthToken();
      const payload = {
        userId: selectedUser.userId,
        features: Object.keys(userFeatures).map((id) => ({
          featureId: Number(id),
          isEnable: Boolean(userFeatures[id]),
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

      if (!res.ok) throw new Error(`saveUserFeatures failed (${res.status})`);
      alert("✅ Quyền đã được cập nhật!");
    } catch (e) {
      err("saveUserFeatures:", e);
      alert("❌ Lỗi khi lưu quyền.");
    }
  }

  /* =========================================================
   * UI
   * ========================================================= */
  renderHeader() {
    const { search } = this.state;
    return (
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold text-[#007E85] flex items-center gap-2">
          <Shield className="w-7 h-7 text-[#00A8B0]" />
          Quản lý nhân viên & quyền truy cập
        </h1>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Tìm kiếm nhân viên..."
              value={search}
              onChange={(e) => this.setState({ search: e.target.value })}
              className="pl-12 w-72 h-11 text-base rounded-xl bg-white/80 border border-gray-200"
            />
          </div>
          <Button
            onClick={() => this.setState({ showAddModal: true })}
            className="bg-[#00A8B0] text-white rounded-xl px-6 py-3 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Thêm nhân viên
          </Button>
        </div>
      </div>
    );
  }

  renderUserList() {
    const { users, search, selectedUser } = this.state;
    const q = search.toLowerCase();
    const filtered = users.filter((u) =>
      [u.fullName, u.username, u.phoneNumber]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-10">
        {filtered.map((u) => (
          <Card
            key={u.userId}
            onClick={() => this.loadUserFeatures(u)} // 👈 click card = mở quyền
            className={`transition p-5 rounded-2xl border-2 cursor-pointer hover:shadow-md ${
              selectedUser?.userId === u.userId
                ? "border-[#00A8B0] bg-[#E1FBFF]"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-4">
              <img
                src={u.avatar || "https://placehold.co/60x60?text=User"}
                alt=""
                className="w-12 h-12 rounded-full object-cover border"
              />
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  {u.fullName || u.username}
                </p>
                <p className="text-sm text-gray-500">{u.phoneNumber || "—"}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {/* Nút sửa */}
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-[#00A8B0] text-[#00A8B0]"
                onClick={(e) => {
                  e.stopPropagation();
                  this.openEditModal(u);
                  this.loadUserFeatures(u);
                }}
              >
                <Edit className="w-4 h-4 mr-1" /> Sửa
              </Button>

              {/* Nút xóa */}
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 bg-red-500 text-white hover:bg-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  this.openEditModal(u);
                  this.loadUserFeatures(u);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Xóa
              </Button>
            </div>
          </Card>
        ))}

        {!filtered.length && (
          <p className="col-span-full text-center text-gray-500 mt-6">
            Không tìm thấy nhân viên phù hợp.
          </p>
        )}
      </div>
    );
  }

  renderEditModalCombined() {
    const { showEditModal, editData, editingUser, features, userFeatures } =
      this.state;
    if (!showEditModal || !editingUser) return null;

    const previewImage = editData.avatarFile
      ? URL.createObjectURL(editData.avatarFile)
      : editingUser.avatar || "https://placehold.co/100x100?text=User";

    return (
      <div className="fixed inset-0 bg-black/40 z-[999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b">
            <h2 className="font-bold text-[#007E85] text-xl flex items-center gap-2">
              <UserCog className="w-5 h-5 text-[#00A8B0]" />
              Chỉnh sửa nhân viên & quyền truy cập
            </h2>
            <X
              className="w-5 h-5 cursor-pointer hover:text-red-500 transition"
              onClick={() =>
                this.setState({
                  showEditModal: false,
                  editData: {
                    fullName: "",
                    phoneNumber: "",
                    citizenIdNumber: "",
                    avatarFile: null,
                  },
                  editingUser: null,
                  features: [],
                  userFeatures: {},
                })
              }
            />
          </div>

          {/* Body */}
          <div className="grid grid-cols-2 gap-6 px-6 py-6 max-h-[80vh] overflow-y-auto">
            {/* Cột trái: Thông tin nhân viên */}
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <img
                  src={previewImage}
                  alt="avatar"
                  className="w-24 h-24 rounded-full object-cover border-2 border-[#00A8B0]"
                />
                <label className="mt-3 text-sm font-medium text-gray-600">
                  Thay ảnh đại diện
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    this.setState({
                      editData: { ...editData, avatarFile: e.target.files[0] },
                    })
                  }
                  className="block w-full text-sm border rounded-md p-2 mt-2"
                />
              </div>

              <Input
                placeholder="Họ tên"
                value={editData.fullName}
                onChange={(e) =>
                  this.setState({
                    editData: { ...editData, fullName: e.target.value },
                  })
                }
              />
              <Input
                placeholder="Số điện thoại"
                value={editData.phoneNumber}
                onChange={(e) =>
                  this.setState({
                    editData: { ...editData, phoneNumber: e.target.value },
                  })
                }
              />
              <Input
                placeholder="CMND/CCCD"
                value={editData.citizenIdNumber}
                onChange={(e) =>
                  this.setState({
                    editData: { ...editData, citizenIdNumber: e.target.value },
                  })
                }
              />
            </div>

            {/* Cột phải: Quyền truy cập */}
            <div>
              <h3 className="font-semibold text-lg text-[#007E85] mb-3">
                Quyền truy cập
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {features.map((f) => (
                  <label
                    key={f.featureId}
                    className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-3"
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
                    <span>{f.featureName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <Button
              variant="outline"
              className="rounded-lg text-gray-600"
              onClick={() =>
                this.setState({
                  showEditModal: false,
                  editingUser: null,
                  editData: {
                    fullName: "",
                    phoneNumber: "",
                    citizenIdNumber: "",
                  },
                })
              }
            >
              Hủy
            </Button>
            <Button
              className="bg-[#00A8B0] text-white rounded-lg px-6 py-2 hover:bg-[#00929A]"
              onClick={() => this.saveUserAndFeatures()}
            >
              💾 Lưu thay đổi
            </Button>
          </div>
        </div>
      </div>
    );
  }
  async saveUserAndFeatures() {
    await this.updateUser();
    await this.saveUserFeatures();
  }
  renderAddModal() {
    const { showAddModal, newStaff } = this.state;
    if (!showAddModal) return null;

    const imagePreview = newStaff.avatarFile
      ? URL.createObjectURL(newStaff.avatarFile)
      : null;

    return (
      <div className="fixed inset-0 bg-black/40 z-[999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex justify-between px-5 py-4 border-b">
            <h2 className="font-bold text-[#007E85] text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#00A8B0]" /> Thêm nhân viên
            </h2>
            <X
              className="w-5 h-5 cursor-pointer hover:text-red-500 transition"
              onClick={() =>
                this.setState({
                  showAddModal: false,
                  newStaff: {
                    username: "",
                    password: "",
                    fullName: "",
                    phoneNumber: "",
                    citizenIdNumber: "",
                    avatarFile: null,
                  },
                })
              }
            />
          </div>

          {/* Form body */}
          <div className="px-5 py-4 space-y-4">
            <Input
              placeholder="Tên đăng nhập"
              value={newStaff.username}
              onChange={(e) =>
                this.setState({
                  newStaff: { ...newStaff, username: e.target.value },
                })
              }
            />
            <Input
              placeholder="Mật khẩu"
              type="password"
              value={newStaff.password}
              onChange={(e) =>
                this.setState({
                  newStaff: { ...newStaff, password: e.target.value },
                })
              }
            />
            <Input
              placeholder="Họ tên"
              value={newStaff.fullName}
              onChange={(e) =>
                this.setState({
                  newStaff: { ...newStaff, fullName: e.target.value },
                })
              }
            />
            <Input
              placeholder="Số điện thoại"
              value={newStaff.phoneNumber}
              onChange={(e) =>
                this.setState({
                  newStaff: { ...newStaff, phoneNumber: e.target.value },
                })
              }
            />
            <Input
              placeholder="CMND/CCCD"
              value={newStaff.citizenIdNumber || ""}
              onChange={(e) =>
                this.setState({
                  newStaff: { ...newStaff, citizenIdNumber: e.target.value },
                })
              }
            />

            {/* Upload ảnh + Preview */}
            <div>
              <label className="block text-sm text-gray-600 font-medium mb-1">
                Ảnh đại diện
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  this.setState({
                    newStaff: { ...newStaff, avatarFile: e.target.files[0] },
                  })
                }
                className="block w-full text-sm text-gray-600 border border-gray-300 rounded-md p-2"
              />
              {imagePreview && (
                <div className="mt-3 flex justify-center">
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="w-24 h-24 object-cover rounded-full border-2 border-[#00A8B0]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end px-5 py-4 border-t bg-gray-50 gap-3">
            <Button
              variant="outline"
              className="rounded-lg text-gray-600"
              onClick={() =>
                this.setState({
                  showAddModal: false,
                  newStaff: {
                    username: "",
                    password: "",
                    fullName: "",
                    phoneNumber: "",
                    citizenIdNumber: "",
                    avatarFile: null,
                  },
                })
              }
            >
              Hủy
            </Button>
            <Button
              className="bg-[#00A8B0] text-white rounded-lg px-6 py-2 hover:bg-[#00929A]"
              onClick={() => this.createStaff()}
            >
              ✅ Tạo nhân viên
            </Button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { loading } = this.state;
    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 text-[#007E85]">
              Đang tải...
            </div>
          )}
          {this.renderHeader()}
          {this.renderUserList()}
          {this.renderAddModal()}
          {this.renderEditModalCombined()}
        </div>
      </div>
    );
  }
}
