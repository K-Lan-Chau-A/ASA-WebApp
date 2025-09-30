"use client";
import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Sidebar from "@/components/sidebar";
import API_URL from "@/config/api";
import { Search, Plus, Edit, Trash2, X } from "lucide-react";

/* ---------- Helper ---------- */
const fmtDate = (s) =>
  s
    ? new Date(s).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

class CategoryPageClass extends React.Component {
  state = {
    shopId: null,
    categories: [],
    search: "",
    loading: false,
    error: "",
    showModal: false,
    editing: null,
    formName: "",
    formDesc: "",
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

    this.setState({ shopId }, () => this.fetchCategories());
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

  fetchCategories = async () => {
    const { shopId } = this.state;
    if (!shopId) return;

    const token = localStorage.getItem("accessToken");
    this.setState({ loading: true, error: "" });

    try {
      const url = `${API_URL}/api/categories?page=1&pageSize=500&shopId=${shopId}`;
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
      });

      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const items = Array.isArray(data.items) ? data.items : [];
      if (this.mounted) this.setState({ categories: items });
    } catch (e) {
      this.setState({
        error: `Lỗi tải danh mục: ${e.message || e}`,
      });
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  };

  /* ---------- CRUD ---------- */
  handleOpenAdd = () =>
    this.setState({ showModal: true, editing: null, formName: "", formDesc: "" });

  handleOpenEdit = (item) =>
    this.setState({
      showModal: true,
      editing: item,
      formName: item.categoryName || "",
      formDesc: item.description || "",
    });

  handleClose = () => this.setState({ showModal: false });

  handleSave = async () => {
    const { formName, formDesc, editing, shopId } = this.state;
    if (!formName.trim()) return alert("Vui lòng nhập tên danh mục");

    const token = localStorage.getItem("accessToken");
    const isEdit = !!editing;
    const url = isEdit
      ? `${API_URL}/api/categories/${editing.categoryId}`
      : `${API_URL}/api/categories`;

    const payload = {
      categoryName: formName.trim(),
      description: formDesc.trim(),
      shopId,
      status: 1,
    };

    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        mode: "cors",
      });

      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      this.fetchCategories();
      this.handleClose();
    } catch (e) {
      alert(`Lỗi lưu danh mục: ${e.message}`);
    }
  };

  handleDelete = async (item) => {
    if (!window.confirm(`Xoá danh mục "${item.categoryName}"?`)) return;
    const token = localStorage.getItem("accessToken");
    const url = `${API_URL}/api/categories/${item.categoryId}`;

    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.fetchCategories();
    } catch (e) {
      alert(`Lỗi xoá: ${e.message}`);
    }
  };

  /* ---------- FILTER ---------- */
  getFiltered = () => {
    const { search, categories } = this.state;
    if (!search.trim()) return categories;
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return categories.filter((c) =>
      c.categoryName.toLowerCase().normalize("NFD").includes(q)
    );
  };

  /* ---------- RENDER ---------- */
  render() {
    const {
      categories,
      search,
      loading,
      error,
      showModal,
      formName,
      formDesc,
      editing,
    } = this.state;
    const filtered = this.getFiltered();

    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />

        {/* MAIN CONTENT */}
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85]">
              DANH MỤC SẢN PHẨM
            </h1>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm kiếm danh mục..."
                  value={search}
                  onChange={(e) => this.setState({ search: e.target.value })}
                  className="pl-12 w-72 h-11 text-base rounded-xl bg-white/80 border border-gray-200 focus-visible:ring-0"
                />
              </div>

              <Button
                className="bg-[#00A8B0] text-white text-base rounded-xl px-6 py-3 hover:bg-[#00929A] flex items-center gap-2"
                onClick={this.handleOpenAdd}
              >
                <Plus className="w-5 h-5" /> Thêm danh mục
              </Button>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <p className="text-gray-500">Đang tải...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Không có danh mục nào.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((cat) => (
                <Card
                  key={cat.categoryId}
                  className="relative p-6 bg-white rounded-2xl shadow-md hover:shadow-lg transition-all border border-gray-100"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                      <h3 className="font-bold text-xl text-[#007E85]">
                        {cat.categoryName}
                      </h3>
                      {cat.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-9 h-9 border-gray-300 hover:bg-[#E0F7FA]"
                        onClick={() => this.handleOpenEdit(cat)}
                      >
                        <Edit className="w-4 h-4 text-[#007E85]" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-9 h-9 border-gray-300 hover:bg-red-50"
                        onClick={() => this.handleDelete(cat)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mã danh mục:</span>
                      <span className="font-semibold text-gray-800">
                        #{cat.categoryId}
                      </span>
                    </div>
                    {/* <div className="flex justify-between">
                      <span className="text-gray-500">Trạng thái:</span>
                      <span
                        className={`font-semibold ${
                          cat.status === 1 ? "text-gray-600" : "text-green-400"
                        }`}
                      >
                        {cat.status === 1 ? "Ngưng" : "Đang hoạt động"}
                      </span>
                    </div> */}
                  </div>

                  {/* Decorative footer */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#00A8B0] to-[#00C1A0] rounded-b-2xl"></div>
                </Card>
              ))}
            </div>
          )}

          {/* Modal thêm/sửa danh mục */}
          {showModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
              <div className="bg-white w-[500px] rounded-2xl shadow-2xl p-8 relative animate-in fade-in-0 zoom-in-95">
                <button
                  onClick={this.handleClose}
                  className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
                >
                  <X className="w-6 h-6" />
                </button>

                <h2 className="text-2xl font-bold text-[#007E85] mb-6">
                  {editing ? "Chỉnh sửa danh mục" : "Thêm danh mục mới"}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Tên danh mục <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formName}
                      onChange={(e) =>
                        this.setState({ formName: e.target.value })
                      }
                      placeholder="Nhập tên danh mục"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Mô tả
                    </label>
                    <Input
                      value={formDesc}
                      onChange={(e) =>
                        this.setState({ formDesc: e.target.value })
                      }
                      placeholder="Nhập mô tả"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="outline" onClick={this.handleClose}>
                    Hủy
                  </Button>
                  <Button
                    className="bg-[#00A8B0] text-white hover:bg-[#00929A]"
                    onClick={this.handleSave}
                  >
                    Lưu
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

/* ---------- Wrapper ---------- */
export default function CategoryPage() {
  const navigate = useNavigate();
  return <CategoryPageClass navigate={navigate} />;
}
