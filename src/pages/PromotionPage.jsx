import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Sidebar from "@/components/sidebar";
import {
  Plus,
  Search,
  Gift,
  Pencil,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  X,
  Minus,
} from "lucide-react";
import API_URL from "@/config/api";
import { getAuthToken, getShopId } from "@/services/AuthStore";

const fmt = new Intl.NumberFormat("vi-VN");

class PromotionPage extends React.Component {
  state = {
    // list
    promotions: [],
    loading: false,
    search: "",

    // modal
    showAddModal: false,
    showEditModal: false,

    // form
    form: {
      name: "",
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      type: 1, // 1=amount, 2=percent
      value: "",
    },
    isEdit: false,
    editing: null,

    // product + unit
    categories: [], // [{categoryId, categoryName}]
    products: [], // full list product (để group)
    productUnits: [], // full product-units
    // modal chọn SP
    showProductModal: false,
    productSearch: "",
    expandedCategories: [],

    // modal chọn Unit
    showUnitModal: false,
    currentProductForUnit: null, // {productId, productName}
    currentUnitsOfProduct: [], // units của product đang mở modal unit

    // final selected: Map productId -> { product, units:[{productUnitId, unitName}] }
    selectedProductMap: {},

    // to refresh child modal when re-open
    selectCategory: "Tất cả",
  };

  async componentDidMount() {
    await Promise.all([
      this.loadPromotions(),
      this.loadCategories(),
      this.loadProducts(),
      this.loadProductUnits(),
    ]);
  }

  getToken = () => localStorage.getItem("accessToken");
  fmtTime = (time, isEnd = false) => {
    if (!time) return isEnd ? "23:59:59" : "00:00:00";
    const [h = "00", m = "00", s = "00"] = time.split(":");
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
  };

  /* ======================================================
   * LOAD DATA
   * ====================================================== */
  loadPromotions = async () => {
    this.setState({ loading: true });
    try {
      const token = this.getToken();
      const shopId = (await getShopId()) ?? 0;
      const res = await fetch(
        `${API_URL}/api/promotions?ShopId=${shopId}&page=1&pageSize=200`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data?.items) ? data.items : [];
      this.setState({ promotions: items });
    } catch (err) {
      console.warn("loadPromotions err:", err);
      this.setState({ promotions: [] });
    } finally {
      this.setState({ loading: false });
    }
  };

  loadCategories = async () => {
    try {
      const token = this.getToken();
      const shopId = (await getShopId()) ?? 0;
      const res = await fetch(
        `${API_URL}/api/categories?ShopId=${shopId}&page=1&pageSize=100`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data?.items) ? data.items : [];
      this.setState({
        categories: items,
        expandedCategories: items.map((c) => c.categoryId), // mở sẵn hết
      });
    } catch (err) {
      console.warn("loadCategories err:", err);
      this.setState({ categories: [] });
    }
  };

  loadProducts = async () => {
    try {
      const token = this.getToken();
      const shopId = (await getShopId()) ?? 0;
      const res = await fetch(
        `${API_URL}/api/products?ShopId=${shopId}&page=1&pageSize=1000`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data?.items) ? data.items : [];
      // items: {productId, productName, categoryId, categoryName, ...}
      this.setState({ products: items });
    } catch (err) {
      console.warn("loadProducts err:", err);
      this.setState({ products: [] });
    }
  };

  loadProductUnits = async () => {
    try {
      const token = this.getToken();
      const shopId = (await getShopId()) ?? 0;
      const res = await fetch(
        `${API_URL}/api/product-units?ShopId=${shopId}&page=1&pageSize=2000`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data?.items) ? data.items : [];
      // items: { productUnitId, productId, productName, unitName, price... }
      this.setState({ productUnits: items });
    } catch (err) {
      console.warn("loadProductUnits err:", err);
      this.setState({ productUnits: [] });
    }
  };

  /* ======================================================
   * HELPERS
   * ====================================================== */
  resetFormState = () => {
    this.setState({
      form: {
        name: "",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        type: 1,
        value: "",
      },
      isEdit: false,
      editing: null,
      selectedProductMap: {},
      productSearch: "",
      selectCategory: "Tất cả",
      currentProductForUnit: null,
      currentUnitsOfProduct: [],
    });
  };

  openCreateModal = () => {
    this.resetFormState();
    this.setState({ showAddModal: true, showEditModal: false });
  };

  closeAllModals = () => {
    // đóng modal chính thì xoá cache
    this.setState({
      showAddModal: false,
      showEditModal: false,
      showProductModal: false,
      showUnitModal: false,
    });
    this.resetFormState();
  };

  toggleCategoryExpand = (categoryId) => {
    this.setState((prev) => {
      const opened = new Set(prev.expandedCategories);
      if (opened.has(categoryId)) {
        opened.delete(categoryId);
      } else {
        opened.add(categoryId);
      }
      return { expandedCategories: Array.from(opened) };
    });
  };

  /* ======================================================
   * CRUD
   * ====================================================== */
  handleCreate = async () => {
    const { form, selectedProductMap } = this.state;
    const token = this.getToken();
    const shopId = (await getShopId()) ?? 0;

    if (!form.name.trim()) return alert("Vui lòng nhập tên khuyến mãi");
    if (!form.startDate || !form.endDate)
      return alert("Vui lòng nhập ngày bắt đầu / kết thúc");

    // gom tất cả unitId đã chọn
    const productUnitIds = Object.values(selectedProductMap).flatMap((p) =>
      p.units.map((u) => u.productUnitId)
    );

    if (productUnitIds.length === 0) {
      return alert("Vui lòng chọn ít nhất 1 đơn vị sản phẩm áp dụng");
    }

    // chuẩn hoá giờ
    const startTime = this.fmtTime(form.startTime);
    const endTime = this.fmtTime(form.endTime, true);

    const payload = {
      shopId,
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      startTime,
      endTime,
      value:
        form.type === 2
          ? Math.round(parseFloat(form.value || "0") * 100) / 100
          : parseFloat(form.value || "0"),
      type: Number(form.type),
      status: 1,
      productUnitIds,
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

      if (!res.ok) throw new Error("create failed");
      alert("✅ Tạo khuyến mãi thành công!");
      this.closeAllModals();
      this.loadPromotions();
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi tạo khuyến mãi");
    }
  };

  handleEdit = (p) => {
    const { productUnits } = this.state;
    const map = {};

    if (Array.isArray(p.appliedProducts)) {
      p.appliedProducts.forEach((ap) => {
        const matchedUnit = productUnits.find(
          (u) =>
            Number(u.productId) === Number(ap.productId) &&
            u.unitName?.trim().toLowerCase() ===
              ap.unitName?.trim().toLowerCase()
        );

        if (!map[ap.productId]) {
          map[ap.productId] = {
            productId: ap.productId,
            productName: ap.productName,
            categoryName: ap.categoryName || "Chưa phân loại",
            units: [],
          };
        }

        map[ap.productId].units.push({
          productUnitId: matchedUnit?.productUnitId || 0,
          unitName: ap.unitName || "Đơn vị",
        });
      });
    }

    this.setState({
      showEditModal: true,
      showAddModal: false,
      isEdit: true,
      editing: p,
      form: {
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        startTime: p.startTime?.slice(0, 5) || "",
        endTime: p.endTime?.slice(0, 5) || "",
        type: p.type,
        value: p.value?.toString() || "",
      },
      selectedProductMap: map,
    });
  };

  handleUpdate = async () => {
    const { form, editing, selectedProductMap } = this.state;
    if (!editing) return;

    const token = this.getToken();
    const shopId = (await getShopId()) ?? 0;

    const productUnitIds = Object.values(selectedProductMap).flatMap((p) =>
      p.units.map((u) => u.productUnitId)
    );

    if (!form.name.trim()) return alert("Vui lòng nhập tên khuyến mãi");
    if (!form.startDate || !form.endDate)
      return alert("Vui lòng nhập ngày bắt đầu / kết thúc");

    const startTime = this.fmtTime(form.startTime);
    const endTime = this.fmtTime(form.endTime, true);

    const payload = {
      shopId,
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      startTime,
      endTime,
      value:
        form.type === 2
          ? Math.round(parseFloat(form.value || "0") * 100) / 100
          : parseFloat(form.value || "0"),
      type: Number(form.type),
      status: 1,
      productUnitIds,
    };

    try {
      const res = await fetch(
        `${API_URL}/api/promotions/${editing.promotionId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("update failed");
      alert("✅ Cập nhật khuyến mãi thành công!");
      this.closeAllModals();
      this.loadPromotions();
    } catch (err) {
      console.error("PUT /api/promotions error:", err);
      alert("❌ Lỗi khi cập nhật khuyến mãi");
    }
  };

  handleDelete = async (id) => {
    if (!window.confirm("🗑️ Xóa khuyến mãi này?")) return;
    const token = this.getToken();
    try {
      const res = await fetch(`${API_URL}/api/promotions/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("delete failed");
      alert("🗑️ Đã xóa khuyến mãi");
      this.loadPromotions();
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi xóa khuyến mãi");
    }
  };

  /* ======================================================
   * PRODUCT / UNIT MODAL
   * ====================================================== */
  openProductModal = () => {
    this.setState({ showProductModal: true });
  };

  closeProductModal = () => {
    this.setState({
      showProductModal: false,
      productSearch: "",
      selectCategory: "Tất cả",
    });
  };

  openUnitModalForProduct = (product) => {
    // tìm unit của product
    const { productUnits, selectedProductMap } = this.state;
    const unitsOfProduct = productUnits.filter(
      (u) => Number(u.productId) === Number(product.productId)
    );

    // những unit đã chọn trước đó
    const already = selectedProductMap[product.productId]?.units || [];

    this.setState({
      showUnitModal: true,
      currentProductForUnit: product,
      currentUnitsOfProduct: unitsOfProduct.map((u) => ({
        ...u,
        _checked: already.some((au) => au.productUnitId === u.productUnitId),
      })),
    });
  };

  closeUnitModal = () => {
    this.setState({
      showUnitModal: false,
      currentProductForUnit: null,
      currentUnitsOfProduct: [],
    });
  };

  toggleCheckUnit = (productUnitId) => {
    this.setState((prev) => {
      const list = prev.currentUnitsOfProduct.map((u) =>
        u.productUnitId === productUnitId ? { ...u, _checked: !u._checked } : u
      );
      return { currentUnitsOfProduct: list };
    });
  };

  applyUnitSelection = () => {
    const { currentProductForUnit, currentUnitsOfProduct, selectedProductMap } =
      this.state;
    if (!currentProductForUnit) {
      this.closeUnitModal();
      return;
    }

    const picked = currentUnitsOfProduct
      .filter((u) => u._checked)
      .map((u) => ({
        productUnitId: u.productUnitId,
        unitName: u.unitName,
      }));

    if (picked.length === 0) {
      // nếu bỏ hết thì xoá product ra khỏi map
      const newMap = { ...selectedProductMap };
      delete newMap[currentProductForUnit.productId];
      this.setState({ selectedProductMap: newMap });
    } else {
      this.setState({
        selectedProductMap: {
          ...selectedProductMap,
          [currentProductForUnit.productId]: {
            productId: currentProductForUnit.productId,
            productName: currentProductForUnit.productName,
            categoryName: currentProductForUnit.categoryName,
            units: picked,
          },
        },
      });
    }

    this.closeUnitModal();
  };

  removeSelectedProduct = (productId, unitId = null) => {
    this.setState((prev) => {
      const copy = { ...prev.selectedProductMap };
      const target = copy[productId];
      if (!target) return {};
      if (unitId === null) {
        // xoá cả product
        delete copy[productId];
      } else {
        // xoá 1 đơn vị
        const newUnits = target.units.filter((u) => u.productUnitId !== unitId);
        if (newUnits.length === 0) {
          delete copy[productId];
        } else {
          copy[productId] = { ...target, units: newUnits };
        }
      }
      return { selectedProductMap: copy };
    });
  };

  /* ======================================================
   * RENDER MODALS
   * ====================================================== */
  renderProductModal() {
    const {
      showProductModal,
      categories,
      products,
      productSearch,
      selectCategory,
      expandedCategories,
      selectedProductMap,
    } = this.state;
    if (!showProductModal) return null;

    // filter list
    const searchLower = productSearch.trim().toLowerCase();

    return (
      <div className="fixed inset-0 bg-black/40 z-[999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-bold text-[#007E85] flex items-center gap-2">
              <Gift className="w-5 h-5" /> Chọn sản phẩm áp dụng
            </h2>
            <button
              onClick={this.closeProductModal}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* search + filter */}
          <div className="flex gap-3 px-6 py-3 border-b bg-gray-50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                value={productSearch}
                onChange={(e) =>
                  this.setState({ productSearch: e.target.value })
                }
                placeholder="Tìm theo tên sản phẩm..."
                className="pl-9 pr-3 py-2 rounded-lg border w-full"
              />
            </div>
            <select
              value={selectCategory}
              onChange={(e) =>
                this.setState({ selectCategory: e.target.value })
              }
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="Tất cả">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.categoryId} value={c.categoryName}>
                  {c.categoryName}
                </option>
              ))}
            </select>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {categories.map((cat) => {
              const isOpen = expandedCategories.includes(cat.categoryId);

              // sp thuộc category này
              const prods = products.filter((p) => {
                if (p.categoryId !== cat.categoryId) return false;
                if (
                  selectCategory !== "Tất cả" &&
                  selectCategory !== cat.categoryName
                )
                  return false;
                if (!searchLower) return true;
                return p.productName.toLowerCase().includes(searchLower);
              });

              // nếu filter làm rỗng thì không render group
              if (prods.length === 0) return null;

              return (
                <div key={cat.categoryId} className="border rounded-lg">
                  {/* group header */}
                  <button
                    onClick={() => this.toggleCategoryExpand(cat.categoryId)}
                    className="flex items-center justify-between w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-t-lg"
                  >
                    <span className="font-semibold text-gray-700 flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {cat.categoryName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {prods.length} sản phẩm
                    </span>
                  </button>

                  {isOpen && (
                    <div className="divide-y">
                      {prods.map((p) => {
                        const isSelected = !!selectedProductMap[p.productId];
                        const units =
                          selectedProductMap[p.productId]?.units || [];
                        return (
                          <div
                            key={p.productId}
                            className="flex items-center justify-between px-4 py-2 bg-white"
                          >
                            <div>
                              <p className="font-medium text-gray-800">
                                {p.productName}
                              </p>
                              {isSelected ? (
                                <p className="text-xs text-[#007E85] mt-1">
                                  Đã chọn:{" "}
                                  {units.map((u) => u.unitName).join(", ")}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 mt-1">
                                  Chưa chọn đơn vị
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <button
                                  onClick={() =>
                                    this.removeSelectedProduct(p.productId)
                                  }
                                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-500"
                                  title="Xóa khỏi khuyến mãi"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                              )}
                              <Button
                                size="sm"
                                className="bg-[#00A8B0] hover:bg-[#00838a]"
                                onClick={() => this.openUnitModalForProduct(p)}
                              >
                                Chọn đơn vị
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* footer */}
          <div className="px-6 py-3 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {Object.keys(selectedProductMap).length} sản phẩm đã chọn
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={this.closeProductModal}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderUnitModal() {
    const { showUnitModal, currentProductForUnit, currentUnitsOfProduct } =
      this.state;
    if (!showUnitModal) return null;

    return (
      <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <p className="text-sm text-gray-500">Chọn đơn vị cho</p>
              <p className="font-semibold text-gray-800">
                {currentProductForUnit?.productName}
              </p>
            </div>
            <button
              onClick={this.closeUnitModal}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {currentUnitsOfProduct.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Sản phẩm này chưa có đơn vị
              </p>
            ) : (
              currentUnitsOfProduct.map((u) => (
                <label
                  key={u.productUnitId}
                  className="flex items-center justify-between border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <span className="text-gray-700">
                    {u.unitName || "Đơn vị"}
                  </span>
                  <input
                    type="checkbox"
                    checked={!!u._checked}
                    onChange={() => this.toggleCheckUnit(u.productUnitId)}
                    className="w-4 h-4"
                  />
                </label>
              ))
            )}
          </div>
          <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-2">
            <Button variant="outline" onClick={this.closeUnitModal}>
              Hủy
            </Button>
            <Button className="bg-[#00A8B0]" onClick={this.applyUnitSelection}>
              Xong
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ======================================================
   * RENDER MAIN
   * ====================================================== */
  renderMainModal(isEdit = false) {
    const { form, selectedProductMap } = this.state;
    const onSubmit = isEdit ? this.handleUpdate : this.handleCreate;
    const title = isEdit ? "Chỉnh sửa khuyến mãi" : "Tạo khuyến mãi mới";

    return (
      <div className="fixed inset-0 bg-black/40 z-[900] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-[#007E85]">{title}</h2>
            <button
              onClick={this.closeAllModals}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label className="font-semibold text-sm">
                Tên chương trình *
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  this.setState({ form: { ...form, name: e.target.value } })
                }
                placeholder="VD: Giảm giá 11.11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-sm">Ngày bắt đầu *</label>
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
              <div>
                <label className="font-semibold text-sm">Ngày kết thúc *</label>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-sm">Giờ bắt đầu</label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    this.setState({
                      form: { ...form, startTime: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="font-semibold text-sm">Giờ kết thúc</label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) =>
                    this.setState({
                      form: { ...form, endTime: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-sm">Loại giảm</label>
                <select
                  className="border rounded-lg w-full h-10 px-3"
                  value={form.type}
                  onChange={(e) =>
                    this.setState({
                      form: { ...form, type: Number(e.target.value) },
                    })
                  }
                >
                  <option value={1}>Giảm số tiền (VND)</option>
                  <option value={2}>Giảm theo %</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-sm">
                  Giá trị ({form.type === 1 ? "VND" : "%"})
                </label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) =>
                    this.setState({
                      form: { ...form, value: e.target.value },
                    })
                  }
                  placeholder={
                    form.type === 1 ? "Nhập số tiền" : "Nhập phần trăm (1-100)"
                  }
                />
              </div>
            </div>

            {/* selected products */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-sm">
                  Sản phẩm/đơn vị áp dụng *
                </label>
                <Button
                  size="sm"
                  className="bg-[#00A8B0] hover:bg-[#00838a]"
                  onClick={this.openProductModal}
                >
                  Chọn sản phẩm
                </Button>
              </div>
              {Object.keys(selectedProductMap).length === 0 ? (
                <p className="text-gray-400 text-sm">
                  Chưa có sản phẩm áp dụng
                </p>
              ) : (
                <div className="space-y-2">
                  {Object.values(selectedProductMap).map((p) => (
                    <div
                      key={p.productId}
                      className="border rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-800">
                          {p.productName}
                        </p>
                        <button
                          onClick={() =>
                            this.removeSelectedProduct(p.productId, null)
                          }
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mb-1">
                        {p.categoryName || "Không có danh mục"}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {p.units.map((u) => (
                          <span
                            key={u.productUnitId}
                            className="inline-flex items-center gap-1 bg-white border rounded-full px-3 py-1 text-xs text-gray-700"
                          >
                            {u.unitName}
                            <button
                              onClick={() =>
                                this.removeSelectedProduct(
                                  p.productId,
                                  u.productUnitId
                                )
                              }
                              className="text-red-400 hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <Button variant="outline" onClick={this.closeAllModals}>
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
      p.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85] flex items-center gap-2">
              <Gift className="w-8 h-8" />
              Khuyến mãi
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
                onClick={this.openCreateModal}
              >
                <Plus className="w-5 h-5" /> Tạo mới
              </Button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <p>Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Chưa có khuyến mãi</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p) => (
                <Card
                  key={p.promotionId}
                  className="relative p-5 rounded-2xl bg-white/90 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex flex-col h-full justify-between">
                    {/* Tên & thời gian */}
                    <div>
                      <p className="font-bold text-lg text-gray-800 mb-2">
                        {p.name || "Không tên"}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {p.startDate} → {p.endDate}
                      </p>
                    </div>

                    {/* Thông tin giảm giá */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="px-3 py-1 bg-[#00A8B0]/10 text-[#00A8B0] rounded-full text-sm font-semibold">
                        {p.type === 2
                          ? `${p.value}%`
                          : `${Number(p.value || 0).toLocaleString("vi-VN")}₫`}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Chỉnh sửa"
                          onClick={() => this.handleEdit(p)}
                          className="hover:bg-[#00A8B0]/10"
                        >
                          <Pencil className="w-5 h-5 text-[#00A8B0]" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Xóa khuyến mãi"
                          onClick={() => this.handleDelete(p.promotionId)}
                          className="hover:bg-red-50"
                        >
                          <Trash2 className="w-5 h-5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Modals */}
          {showAddModal && this.renderMainModal(false)}
          {showEditModal && this.renderMainModal(true)}
          {this.renderProductModal()}
          {this.renderUnitModal()}
        </div>
      </div>
    );
  }
}

export default PromotionPage;
