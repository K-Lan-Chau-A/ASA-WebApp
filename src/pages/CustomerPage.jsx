"use client";
import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Sidebar from "@/components/sidebar";
import API_URL from "@/config/api";
import { Search, Plus, Trash2, Edit, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/* ---------- Helper ---------- */
const fmtDate = (s) =>
  s
    ? new Date(s).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
  });

class CustomerPageClass extends React.Component {
  state = {
    shopId: null,
    customers: [],
    nfcs: [],
    // 👇 thêm
    ranks: [],
    search: "",
    loading: false,
    error: "",
    showDialog: false,
    editing: null,
    form: {
      fullName: "",
      phone: "",
      email: "",
      spent: 0,
      gender: 0,
      birthday: "",
      avatar: "",
    },
    avatarFile: null,
  };

  mounted = false;

  componentDidMount() {
    this.mounted = true;
    this.initShop();
  }
  componentWillUnmount() {
    this.mounted = false;
  }

  /* ---------- INIT ---------- */
  initShop = () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return this.props.navigate("/");

    let profile = null;
    try {
      profile =
        JSON.parse(localStorage.getItem("userProfile") || "null") ||
        JSON.parse(localStorage.getItem("auth") || "null")?.profile;
    } catch (e) {
      console.log("Parse profile error", e);
    }

    const shopId = Number(profile?.shopId || 0);
    if (!shopId) return;

    this.setState({ shopId }, () => {
      this.fetchCustomers();
      this.fetchNFCs();
      this.fetchRanks(); // 👈 lấy rank từ backend
    });
  };

  /* ---------- API common ---------- */
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

  fetchCustomers = async () => {
    const { shopId } = this.state;
    if (!shopId) return;
    const token = localStorage.getItem("accessToken");
    this.setState({ loading: true, error: "" });

    try {
      const url = `${API_URL}/api/customers?ShopId=${shopId}&page=1&pageSize=500`;
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const items = Array.isArray(data.items) ? data.items : [];
      if (this.mounted) this.setState({ customers: items });
    } catch (e) {
      this.setState({ error: `Lỗi tải khách hàng: ${e.message || e}` });
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  };

  fetchNFCs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/nfcs?page=1&pageSize=500`);
      const data = await this.safeParse(res);
      if (res.ok) {
        this.setState({ nfcs: data.items || [] });
      }
    } catch (e) {
      console.log("Fetch NFC error:", e);
    }
  };

  // 👇 LẤY RANK TỪ API
  fetchRanks = async () => {
    const { shopId } = this.state;
    if (!shopId) return;
    try {
      const res = await fetch(
        `${API_URL}/api/ranks?ShopId=${shopId}&page=1&pageSize=100`,
        { headers: { accept: "application/json" } }
      );
      const data = await this.safeParse(res);
      if (res.ok) {
        // items: [{ rankId, rankName, benefit, threshold, shopId }]
        this.setState({ ranks: Array.isArray(data.items) ? data.items : [] });
      }
    } catch (e) {
      console.log("Fetch ranks error:", e);
    }
  };

  /* ---------- CRUD ---------- */
  handleOpenAdd = () =>
    this.setState({
      showDialog: true,
      editing: null,
      form: {
        fullName: "",
        phone: "",
        email: "",
        spent: 0,
        gender: 0,
        birthday: "",
        // rankId: null, // nếu muốn chọn rank tay thì để đây
      },
    });

  handleOpenEdit = (item) =>
    this.setState({
      showDialog: true,
      editing: item,
      form: {
        fullName: item.fullName || "",
        phone: item.phone || "",
        email: item.email || "",
        spent: item.spent || 0,
        gender: item.gender || 0,
        birthday: item.birthday?.split("T")[0] || "",
        // rankId: item.rankId || item.rankid || null,
      },
    });

  handleClose = () => this.setState({ showDialog: false });

  handleSave = async () => {
    const { form, shopId, editing, avatarFile } = this.state;
    if (!form.fullName.trim() || !form.phone.trim())
      return alert("Vui lòng nhập tên và số điện thoại!");

    const token = localStorage.getItem("accessToken");
    const isEdit = !!editing;
    const url = isEdit
      ? `${API_URL}/api/customers/${editing.customerId}`
      : `${API_URL}/api/customers`;

    try {
      let body, headers;

      if (avatarFile) {
        const formData = new FormData();
        formData.append("fullName", form.fullName);
        formData.append("phone", form.phone);
        formData.append("email", form.email || "");
        formData.append("gender", form.gender || 0);
        formData.append("birthday", form.birthday || null);
        formData.append("shopId", shopId);
        // nếu cho phép chọn rank ở form thì:
        // if (form.rankId) formData.append("rankId", form.rankId);
        formData.append("avatar", avatarFile);
        body = formData;
        headers = token ? { Authorization: `Bearer ${token}` } : {};
      } else {
        body = JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || "",
          gender: form.gender || 0,
          birthday: form.birthday || null,
          avatar: form.avatar || "",
          shopId,
          // rankId: form.rankId || null,
        });
        headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
      }

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers,
        body,
      });

      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      alert(
        isEdit
          ? "✅ Cập nhật khách hàng thành công!"
          : "✅ Thêm khách hàng thành công!"
      );
      this.fetchCustomers();
      this.handleClose();
    } catch (e) {
      alert(`❌ Lỗi lưu khách hàng: ${e.message}`);
    }
  };

  handleDelete = async (item) => {
    if (!window.confirm(`Xoá khách hàng "${item.fullName}"?`)) return;
    const token = localStorage.getItem("accessToken");
    const url = `${API_URL}/api/customers/${item.customerId}`;

    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.fetchCustomers();
    } catch (e) {
      alert(`Lỗi xoá: ${e.message}`);
    }
  };

  /* ---------- FILTER ---------- */
  getFiltered = () => {
    const { search, customers } = this.state;
    if (!search.trim()) return customers;
    const q = search
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return customers.filter((c) =>
      (c.fullName || "").toLowerCase().normalize("NFD").includes(q)
    );
  };

  /* ---------- Rank resolve ---------- */
  // lấy rank từ ranks theo id
  resolveRankById = (rankId) => {
    const { ranks } = this.state;
    if (!rankId) return null;
    return ranks.find(
      (r) =>
        Number(r.rankId) === Number(rankId) ||
        Number(r.rankID) === Number(rankId)
    );
  };

  // nếu KH không có rankId → suy ra từ spent
  resolveRankBySpent = (spent) => {
    const { ranks } = this.state;
    if (!ranks.length) return null;
    // API của bạn: threshold nhỏ → cấp thấp; threshold lớn → cấp cao
    // mình sort tăng theo threshold rồi lấy rank cao nhất mà spent >= threshold
    const sorted = [...ranks].sort(
      (a, b) => Number(a.threshold || 0) - Number(b.threshold || 0)
    );
    let found = null;
    for (const r of sorted) {
      if (Number(spent || 0) >= Number(r.threshold || 0)) {
        found = r;
      }
    }
    return found;
  };

  /* ---------- RENDER ---------- */
  render() {
    const {
      customers,
      nfcs,
      search,
      loading,
      error,
      showDialog,
      form,
      editing,
      ranks,
    } = this.state;
    const filtered = this.getFiltered();

    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />

        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85]">
              KHÁCH HÀNG
            </h1>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm kiếm khách hàng..."
                  value={search}
                  onChange={(e) => this.setState({ search: e.target.value })}
                  className="pl-12 w-72 h-11 text-base rounded-xl bg-white/80 border border-gray-200 focus-visible:ring-0"
                />
              </div>

              <Button
                className="bg-[#00A8B0] text-white text-base rounded-xl px-6 py-3 hover:bg-[#00929A] flex items-center gap-2"
                onClick={this.handleOpenAdd}
              >
                <Plus className="w-5 h-5" /> Thêm khách hàng
              </Button>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <p className="text-gray-500">Đang tải...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Không có khách hàng nào.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((cus) => {
                // 👇 lấy rankId từ mọi kiểu tên field
                const rawRankId =
                  cus.rankId ?? cus.rankID ?? cus.rankid ?? cus.RankId ?? null;

                // ưu tiên lấy theo id
                let rank = this.resolveRankById(rawRankId);

                // nếu không có id mà có spent → suy từ threshold
                if (!rank) {
                  rank = this.resolveRankBySpent(cus.spent || cus.totalSpent);
                }

                // nếu vẫn không có → fallback Đồng
                const displayRank = rank || {
                  rankId: 1,
                  rankName: "Đồng",
                  color: "bg-[#CD7F32]",
                };

                const nfc = nfcs.find((n) => n.customerId === cus.customerId);

                const genderLabel =
                  cus.gender === 0 ? "Nam" : cus.gender === 1 ? "Nữ" : "Khác";
                const avatarUrl =
                  cus.avatar && cus.avatar !== "string" ? cus.avatar : null;

                return (
                  <Card
                    key={cus.customerId}
                    className="p-6 bg-white rounded-2xl shadow-md hover:shadow-xl border border-gray-100 transition-all"
                  >
                    {/* Ảnh + Tên + Hạng */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={cus.fullName}
                            className="w-16 h-16 rounded-full object-cover border-2 border-[#00A8B0]"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border">
                            <User className="w-7 h-7 text-gray-400" />
                          </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] bg-[#00A8B0] text-white">
                          {displayRank.rankName || displayRank.name || "Đồng"}
                        </span>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-[#007E85] leading-snug">
                          {cus.fullName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          👤 {genderLabel} | 🎂 {fmtDate(cus.birthday)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-9 h-9 hover:bg-[#E0F7FA]"
                          onClick={() => this.handleOpenEdit(cus)}
                        >
                          <Edit className="w-4 h-4 text-[#007E85]" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-9 h-9 hover:bg-red-50"
                          onClick={() => this.handleDelete(cus)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {/* Thông tin chi tiết */}
                    <div className="space-y-1 text-sm text-gray-700">
                      <p>
                        📞{" "}
                        <span className="font-medium">{cus.phone || "—"}</span>
                      </p>
                      <p>📧 {cus.email || "—"}</p>

                      {nfc ? (
                        <p className="bg-[#E0F7FA]/80 px-2 py-1 rounded-lg mt-1 text-[#007E85]">
                          💳 NFC: <b>{nfc.nfcCode}</b> — Số dư:{" "}
                          <b>{fmtMoney(nfc.balance)}</b>
                        </p>
                      ) : (
                        <p className="text-gray-500 italic">
                          💳 Chưa có thẻ NFC
                        </p>
                      )}

                      <p className="pt-1 text-[#007E85] font-semibold">
                        💰 Chi tiêu: {fmtMoney(cus.spent || 0)}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Modal thêm/sửa khách */}
          <Dialog
            open={showDialog}
            onOpenChange={(open) => !open && this.handleClose()}
          >
            <DialogContent className="sm:max-w-[550px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#007E85]">
                  {editing ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={form.fullName}
                    onChange={(e) =>
                      this.setState({
                        form: { ...form, fullName: e.target.value },
                      })
                    }
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Số điện thoại <span className="text-red-500"> *</span>
                  </label>
                  <Input
                    value={form.phone}
                    onChange={(e) =>
                      this.setState({
                        form: { ...form, phone: e.target.value },
                      })
                    }
                    placeholder="0901234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email<span className="text-red-500"> *</span>
                  </label>
                  <Input
                    value={form.email}
                    onChange={(e) =>
                      this.setState({
                        form: { ...form, email: e.target.value },
                      })
                    }
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Ngày sinh
                  </label>
                  <Input
                    type="date"
                    value={form.birthday}
                    onChange={(e) =>
                      this.setState({
                        form: { ...form, birthday: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              {/* Giới tính */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Giới tính
                </label>
                <select
                  className="border rounded-md px-3 py-2 w-full"
                  value={form.gender}
                  onChange={(e) =>
                    this.setState({
                      form: { ...form, gender: Number(e.target.value) },
                    })
                  }
                >
                  <option value={0}>Nam</option>
                  <option value={1}>Nữ</option>
                  <option value={2}>Khác</option>
                </select>
              </div>

              <DialogFooter className="flex justify-end gap-3">
                <Button variant="outline" onClick={this.handleClose}>
                  Hủy
                </Button>
                <Button
                  className="bg-[#00A8B0] text-white hover:bg-[#00929A]"
                  onClick={this.handleSave}
                >
                  Lưu
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }
}

export default function CustomerPage() {
  const navigate = useNavigate();
  return <CustomerPageClass navigate={navigate} />;
}
