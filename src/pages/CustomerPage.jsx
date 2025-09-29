"use client";
import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Sidebar from "@/components/sidebar";
import API_URL from "@/config/api";
import { Search, Plus, Trash2, Edit, User, CreditCard } from "lucide-react";
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

const rankMap = {
  "1": { name: "Đồng", color: "bg-[#CD7F32]", text: "text-white" },
  "2": { name: "Bạc", color: "bg-gray-400", text: "text-white" },
  "3": { name: "Vàng", color: "bg-yellow-400", text: "text-black" },
  "4": { name: "Kim cương", color: "bg-blue-400", text: "text-white" },
};

class CustomerPageClass extends React.Component {
  state = {
    shopId: null,
    customers: [],
    nfcs: [],
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
    },
  };

  mounted = false;

  /* ---------- LIFECYCLE ---------- */
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
    });
  };

  /* ---------- API ---------- */
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
      },
    });

  handleClose = () => this.setState({ showDialog: false });

  handleSave = async () => {
    const { form, shopId, editing } = this.state;
    if (!form.fullName.trim() || !form.phone.trim())
      return alert("Vui lòng nhập tên và số điện thoại!");

    const token = localStorage.getItem("accessToken");
    const isEdit = !!editing;

    const url = isEdit
      ? `${API_URL}/api/customers/${editing.customerId}`
      : `${API_URL}/api/customers`;

    const payload = { ...form, shopId, status: 1 };

    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      this.fetchCustomers();
      this.handleClose();
    } catch (e) {
      alert(`Lỗi lưu khách hàng: ${e.message}`);
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
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return customers.filter((c) =>
      c.fullName.toLowerCase().normalize("NFD").includes(q)
    );
  };

  /* ---------- RENDER ---------- */
  render() {
    const { customers, nfcs, search, loading, error, showDialog, form, editing } =
      this.state;
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
                const rank = rankMap[cus.rankid] || rankMap["2"];
                const nfc = nfcs.find((n) => n.customerId === cus.customerId);
                return (
                  <Card
                    key={cus.customerId}
                    className="p-6 bg-white rounded-2xl shadow-md hover:shadow-lg border border-gray-100 transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#E0F7FA] rounded-full p-3">
                          <User className="w-6 h-6 text-[#007E85]" />
                        </div>
                        <div>
                          <h3 className="font-bold text-xl text-[#007E85]">
                            {cus.fullName}
                          </h3>
                          <div
                            className={`flex items-center gap-1 px-2 py-1 mt-1 text-xs rounded-full ${rank.color} ${rank.text}`}
                          >
                            {rank.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-9 h-9"
                          onClick={() => this.handleOpenEdit(cus)}
                        >
                          <Edit className="w-4 h-4 text-[#007E85]" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-9 h-9"
                          onClick={() => this.handleDelete(cus)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mt-2">
                      📞 {cus.phone || "—"}
                    </p>
                    <p className="text-sm text-gray-600">
                      📧 {cus.email || "—"}
                    </p>
                    <p className="text-sm text-gray-600">
                      🎂 {fmtDate(cus.birthday)}
                    </p>
                    <p className="text-sm text-gray-600 font-medium mt-1">
                      💰 Chi tiêu:{" "}
                      <span className="text-[#007E85]">{fmtMoney(cus.spent)}</span>
                    </p>

                    {/* NFC Info */}
                    <div className="mt-3">
                      {nfc ? (
                        <div className="flex items-center gap-2 bg-[#E1FBFF] text-[#007E85] px-3 py-2 rounded-xl text-sm">
                          <CreditCard className="w-4 h-4" />
                          <span>
                            NFC: <b>{nfc.nfcCode}</b> – Số dư:{" "}
                            <b>{fmtMoney(nfc.balance)}</b>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm">
                          <CreditCard className="w-4 h-4" />
                          <span>Chưa có NFC</span>
                        </div>
                      )}
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
                      this.setState({ form: { ...form, fullName: e.target.value } })
                    }
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Số điện thoại *
                  </label>
                  <Input
                    value={form.phone}
                    onChange={(e) =>
                      this.setState({ form: { ...form, phone: e.target.value } })
                    }
                    placeholder="0901234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email
                  </label>
                  <Input
                    value={form.email}
                    onChange={(e) =>
                      this.setState({ form: { ...form, email: e.target.value } })
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
