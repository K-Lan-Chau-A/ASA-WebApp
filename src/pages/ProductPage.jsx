import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Sidebar from "@/components/sidebar";
import API_URL from "@/config/api";
import { Search, Plus, X, Upload } from "lucide-react";
import { Info, ChevronRight } from "lucide-react";
import debounce from "lodash.debounce";

/* ---------- Helper ---------- */
const fmt = new Intl.NumberFormat("vi-VN");
const slugify = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const normalize = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const pickBaseUnit = (rows = []) => {
  if (!rows.length) return null;
  const base = rows.find((u) => Number(u.conversionFactor) === 1);
  return base || rows[0];
};

class ProductPageClass extends React.Component {
  state = {
    shopId: null,
    categories: [],
    catError: "",
    loading: false,
    activeTab: "all",
    productsByTab: {},
    unitsByPid: {},
    search: "",
    showFilter: false,
    showAddModal: false,
    showUnitModal: false,

    productName: "",
    barcode: "",
    cost: "",
    price: "",
    isLow: 0,
    categoryId: "",
    quantity: "",
    imageUrl: "",
    units: [],
    importPrice: "",

    showDetailModal: false,
    selectedProduct: null,
    showEditModal: false,

    suggestList: [], // danh sách gợi ý sản phẩm
    showSuggest: false,

    saving: false,
  };

  mounted = false;

  /* ---------- LIFECYCLE ---------- */
  componentDidMount() {
    document.addEventListener("click", this.handleOutsideClick);
    this.mounted = true;
    this.initShop();
  }

  componentWillUnmount() {
    document.removeEventListener("click", this.handleOutsideClick);
    this.mounted = false;
  }
  handleOutsideClick = (e) => {
    if (!e.target.closest(".relative")) {
      this.setState({ showSuggest: false });
    }
  };
  componentDidUpdate(prevProps, prevState) {
    if (
      prevState.activeTab !== this.state.activeTab ||
      prevState.categories !== this.state.categories
    ) {
      if (this.state.categories?.length) {
        this.ensureProducts(this.state.activeTab);
      }
    }
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
    } catch (e) {}

    const shopId = Number(profile?.shopId || 0);
    if (!shopId) return;

    this.setState({ shopId }, () => {
      this.fetchUnitsAllByShop();
      this.fetchCategories();
    });
  };

  safeParse = async (res) => {
    try {
      return await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    }
  };

  /* ---------- FETCH CATEGORIES ---------- */
  getCategoryNameById = (id) => {
    const cat = this.state.categories.find(
      (c) => Number(c.id || c.categoryId) === Number(id)
    );
    return cat ? cat.name || cat.categoryName : "Không phân loại";
  };

  fetchCategories = async () => {
    if (!this.state.shopId) return;
    const token = localStorage.getItem("accessToken");
    this.setState({ loading: true, catError: "" });

    try {
      const url = `${API_URL}/api/categories?ShopId=${this.state.shopId}`;
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
      const withAll = [
        { id: "all", name: "Tất cả", value: "all" },
        ...items.map((c) => ({
          id: c.categoryId,
          name: c.categoryName,
          value: `${c.categoryId}-${slugify(c.categoryName)}`,
        })),
      ];
      if (!this.mounted) return;
      this.setState({ categories: withAll, activeTab: "all" });
    } catch (e) {
      const msg = String(e).includes("Failed to fetch")
        ? "Không gọi được API (CORS/mạng?)."
        : `Lỗi tải danh mục: ${e.message || e}`;
      this.setState({ catError: msg });
    } finally {
      if (!this.mounted) return;
      this.setState({ loading: false });
    }
  };

  /* ---------- FETCH UNITS ---------- */
  fetchUnitsAllByShop = async () => {
    if (!this.state.shopId) return;
    const token = localStorage.getItem("accessToken");

    try {
      const url = `${API_URL}/api/product-units?ShopId=${this.state.shopId}&page=1&pageSize=5000`;
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
      const byPid = new Map();
      for (const it of items) {
        const pid = Number(it.productId);
        if (!byPid.has(pid)) byPid.set(pid, []);
        byPid.get(pid).push(it);
      }

      const unitsByPid = {};
      byPid.forEach((rows, pid) => {
        const base = pickBaseUnit(rows);
        const sorted = base ? [base, ...rows.filter((r) => r !== base)] : rows;
        unitsByPid[pid] = sorted.map((u) => ({
          productUnitId: Number(u.productUnitId),
          unitName: u.unitName,
          price: Number(u.price ?? 0),
          conversionFactor: Number(u.conversionFactor ?? 1),
        }));
      });

      if (this.mounted) this.setState({ unitsByPid });
    } catch {}
  };
  /* ---------- Search sản phẩm gợi ý ---------- */
  handleSearchProduct = debounce(async (query) => {
    if (!query || query.length < 2) {
      this.setState({ suggestList: [], showSuggest: false });
      return;
    }

    const token = localStorage.getItem("accessToken");
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const shopId = profile.shopId || this.state.shopId;
    if (!shopId || !token) return;

    try {
      const url = `${API_URL}/api/products?ShopId=${shopId}&page=1&pageSize=1000`;
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      const q = query
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const filtered = items.filter((p) =>
        (p.productName || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(q)
      );

      this.setState({
        suggestList: filtered.slice(0, 5),
        showSuggest: true,
      });
    } catch (err) {
      console.warn("❌ Lỗi search:", err.message);
    }
  }, 400);

  /* ---------- PRODUCTS ---------- */
  ensureProducts = async (tabValue, force = false) => {
    const entry = this.state.productsByTab[tabValue];
    const shouldSkip = entry?.items?.length || entry?.loading;
    if (shouldSkip && !force) return;
    await this.loadProductsFor(tabValue);
  };

  loadProductsFor = async (tabValue) => {
    if (!this.state.shopId) return;
    const token = localStorage.getItem("accessToken");
    const category = this.state.categories.find((c) => c.value === tabValue);
    const categoryId =
      category && category.id !== "all" ? Number(category.id) : null;

    this.setState((prev) => ({
      productsByTab: {
        ...prev.productsByTab,
        [tabValue]: { items: [], loading: true, error: "" },
      },
    }));

    try {
      const url = `${API_URL}/api/products?page=1&pageSize=500`;
      const res = await fetch(url, {
        headers: {
          accept: "*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const raw = Array.isArray(data.items) ? data.items : [];
      const filtered = raw
        .filter((p) => Number(p.shopId) === Number(this.state.shopId))
        .filter((p) => Number(p.status) === 1)
        .filter((p) =>
          categoryId ? Number(p.categoryId) === categoryId : true
        )
        .map((p) => {
          const pid = Number(p.productId);
          const unitRows = this.state.unitsByPid[pid] || [];
          const base = unitRows.length ? unitRows[0] : null;
          return {
            id: pid,
            name: p.productName,
            category: this.getCategoryNameById(p.categoryId),
            stock: p.quantity ?? 0,
            price: base ? base.price : (p.price ?? 0),
            cost: p.cost ?? 0,
            barcode: p.barcode ?? "",
            discount: p.discount ?? 0,
            isLow: p.isLow ?? 0,
            status: p.status,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt || p.updateAt || null,
            unitIdFk: p.unitIdFk,
            shopId: p.shopId,
            img: p.productImageURL || p.imageUrl || "/no-image.png",
            unitOptions: unitRows,
          };
        });

      this.setState((prev) => ({
        productsByTab: {
          ...prev.productsByTab,
          [tabValue]: { items: filtered, loading: false, error: "" },
        },
      }));
    } catch (e) {
      const msg = String(e).includes("Failed to fetch")
        ? "Không gọi được API sản phẩm."
        : `Lỗi tải sản phẩm: ${e.message || e}`;
      this.setState((prev) => ({
        productsByTab: {
          ...prev.productsByTab,
          [tabValue]: { items: [], loading: false, error: msg },
        },
      }));
    }
  };
  openProductDetail = (product) => {
    this.setState({ selectedProduct: product, showDetailModal: true });
  };

  closeProductDetail = () => {
    this.setState({ showDetailModal: false, selectedProduct: null });
  };

  openEditProduct = () => {
    const p = this.state.selectedProduct;
    if (!p) return;

    this.setState({ showDetailModal: false }, () => {
      setTimeout(() => {
        this.setState({
          showEditModal: true,
          productName: p.name || "",
          barcode: p.barcode || "",
          cost: p.cost || 0,
          price: p.price || 0,
          isLow: p.isLow || 0,
          categoryId: p.categoryId || "",
          categoryName: this.getCategoryNameById(p.categoryId),
          quantity: p.stock || 0,
          imageUrl: p.img || "",
          units:
            p.unitOptions?.map((u) => ({
              id: u.productUnitId,
              name: u.unitName,
              conversion: u.conversionFactor,
              price: u.price,
              isBase: u.conversionFactor === 1,
            })) || [],
        });
      }, 100);
    });
  };

  closeEditModal = () => {
    this.setState({ showEditModal: false });
  };

  /* ---------- HANDLERS ---------- */
  toggleFilter = () => this.setState((s) => ({ showFilter: !s.showFilter }));
  toggleAddModal = () => {
    if (this.state.showAddModal) {
      this.setState({
        showAddModal: false,
        productName: "",
        barcode: "",
        cost: "",
        price: "",
        isLow: 0,
        categoryId: "",
        quantity: "",
        imageUrl: "",
        imageFile: null,
        units: [],
        importPrice: "",
        suggestList: [],
        showSuggest: false,
      });
    } else {
      this.setState({ showAddModal: true });
    }
  };

  toggleUnitModal = () =>
    this.setState((s) => ({ showUnitModal: !s.showUnitModal }));
  setActiveTab = (v) => this.setState({ activeTab: v });
  setSearch = (v) => this.setState({ search: v });

  /* ---------- Unit Handlers ---------- */
  handleConfirmUnits = () => {
    const validUnits = (this.state.units || []).filter(
      (u) => u.name?.trim() && (u.isBase || Number(u.conversion) > 0) // nếu không phải cơ bản thì cần conversion > 0
    );

    // Nếu không có đơn vị cơ bản nào, tự động chọn đơn vị đầu tiên làm cơ bản
    if (!validUnits.some((u) => u.isBase) && validUnits.length > 0) {
      validUnits[0].isBase = true;
      validUnits[0].conversion = 1;
    }

    this.setState({ units: validUnits, showUnitModal: false });
  };

  handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    this.setState({
      imageFile: file,
      imageUrl: URL.createObjectURL(file),
    });
  };

  handleAddUnit = () => {
    this.setState((prev) => ({
      units: [
        ...prev.units,
        { id: Date.now(), isBase: false, name: "", conversion: 1, price: "" },
      ],
    }));
  };

  handleRemoveUnit = (idx) => {
    this.setState((prev) => {
      const newUnits = [...prev.units];
      newUnits.splice(idx, 1);
      return { units: newUnits };
    });
  };

  handleChangeUnit = (idx, key, value) => {
    this.setState((prev) => {
      const newUnits = [...prev.units];
      newUnits[idx][key] = value;
      return { units: newUnits };
    });
  };

  handleSetBaseUnit = (idx, checked) => {
    this.setState((prev) => {
      const newUnits = prev.units.map((u, i) => ({
        ...u,
        isBase: i === idx ? checked : false,
        conversion: i === idx ? 1 : u.conversion,
      }));
      return { units: newUnits };
    });
  };

  /* ---------- Lưu sản phẩm ---------- */
  handleSaveProduct = async () => {
    const token = localStorage.getItem("accessToken");
    const {
      shopId,
      units,
      categoryId,
      productName,
      barcode,
      cost,
      price,
      quantity,
      imageFile,
    } = this.state;

    if (!productName || !categoryId || !price) {
      alert("⚠️ Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }

    this.setState({ saving: true }); // 🔹 bật loading

    try {
      const formData = new FormData();
      formData.append("ShopId", shopId);
      formData.append("ProductName", productName.trim());
      formData.append("Barcode", barcode || null);
      formData.append("CategoryId", categoryId ? Number(categoryId) : null);
      formData.append("Price", Number(price));
      formData.append("Cost", Number(cost || 0));
      formData.append("Quantity", Number(quantity || 0));
      formData.append("Status", 1);
      formData.append("Discount", 0);
      formData.append("IsLow", Number(this.state.isLow || 0));

      const baseUnits = units.length
        ? units
        : [{ name: "Cái", conversion: 1, price: Number(price), isBase: true }];

      const unitsPayload = baseUnits.map((u) => ({
        name: u.name || "Cái",
        conversionFactor: Number(u.conversion || 1),
        price: Number(u.price || price),
        isBaseUnit: Boolean(u.isBase),
      }));

      formData.append("UnitsJson", JSON.stringify(unitsPayload));

      if (imageFile) formData.append("ProductImageFile", imageFile);
      formData.append("InventoryTransaction.Quantity", String(quantity || 0));
      formData.append("InventoryTransaction.Price", String(cost || 0));

      const res = await fetch(`${API_URL}/api/products`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || "Lỗi tạo sản phẩm");

      alert("🎉 Tạo sản phẩm thành công!");
      this.toggleAddModal();

      await Promise.all([this.fetchUnitsAllByShop(), this.fetchCategories()]);
      await new Promise((r) => setTimeout(r, 500));

      await this.ensureProducts(this.state.activeTab, true);
    } catch (err) {
      console.error(err);
      alert("❌ Thêm sản phẩm thất bại: " + err.message);
    } finally {
      this.setState({ saving: false });
    }
  };

  handleUpdateProduct = async () => {
    const token = localStorage.getItem("accessToken");
    const {
      selectedProduct,
      shopId,
      productName,
      barcode,
      cost,
      price,
      categoryId,
      isLow,
      units,
      imageFile,
    } = this.state;

    if (!selectedProduct) return;
    const productId = selectedProduct.id;

    try {
      const formData = new FormData();
      formData.append("ProductId", productId);
      formData.append("ShopId", shopId);
      formData.append("ProductName", productName.trim());
      formData.append("Barcode", barcode || null);
      formData.append("CategoryId", categoryId ? Number(categoryId) : null);
      formData.append("Price", Number(price));
      formData.append("Cost", Number(cost || 0));
      formData.append("Status", 1);
      formData.append("Discount", 0);
      formData.append("IsLow", Number(isLow || 0));

      const unitsPayload = (
        units.length
          ? units
          : [{ name: "Cái", conversion: 1, price: Number(price), isBase: true }]
      ).map((u) => ({
        name: u.name || "Cái",
        conversionFactor: Number(u.conversion || 1),
        price: Number(u.price || price),
        isBaseUnit: Boolean(u.isBase),
      }));

      formData.append("UnitsJson", JSON.stringify(unitsPayload));
      if (imageFile) formData.append("ProductImageFile", imageFile);

      this.setState({ saving: true });

      const res = await fetch(`${API_URL}/api/products/${productId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || "Lỗi cập nhật sản phẩm");

      alert("✅ Cập nhật thành công!");
      this.closeEditModal();

      await Promise.all([this.fetchUnitsAllByShop(), this.fetchCategories()]);
      await this.ensureProducts(this.state.activeTab, true);
    } catch (err) {
      alert("❌ Lỗi khi cập nhật: " + err.message);
    } finally {
      this.setState({ saving: false });
    }
  };

  /* ---------- UI - Modal thêm sản phẩm ---------- */
  formatMoney = (value) => {
    if (value === "" || value == null) return "";
    return Number(value).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
    });
  };

  parseNumber = (str) => {
    if (!str) return 0;
    return Number(String(str).replace(/[^\d]/g, "")) || 0;
  };

  renderAddModal() {
    const {
      categories,
      categoryId,
      productName,
      barcode,
      cost,
      price,
      isLow,
      quantity,
    } = this.state;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex justify-center items-center z-50">
        <div className="bg-white w-[1100px] h-[90vh] shadow-2xl rounded-2xl p-10 overflow-y-auto relative">
          <button
            onClick={this.toggleAddModal}
            className="absolute top-6 right-6 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-3xl font-extrabold text-[#007E85] mb-8">
            SẢN PHẨM
          </h2>

          <div className="grid grid-cols-2 gap-8">
            {/* LEFT */}
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <label
                  htmlFor="imageUpload"
                  className="w-[140px] h-[140px] rounded-xl border-2 border-dashed border-[#00A8B0] bg-[#E1FBFF] grid place-items-center text-[#00A8B0] font-semibold text-sm cursor-pointer hover:bg-[#D5F7F9] transition overflow-hidden"
                >
                  {this.state.imageUrl ? (
                    <img
                      src={this.state.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mb-1" />
                      ẢNH
                    </>
                  )}
                </label>
                <input
                  id="imageUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={this.handleImageUpload}
                />
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Nhấn để tải ảnh lên
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 🔍 Tên sản phẩm có gợi ý dropdown */}
                <div className="relative">
                  <label className="font-semibold block mb-1">
                    Tên sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="VD: Pepsi Cola 330ml"
                    value={this.state.productName}
                    onChange={(e) => {
                      const name = e.target.value;
                      this.setState({ productName: name });
                      this.handleSearchProduct(name);
                    }}
                  />

                  {/* Dropdown gợi ý sản phẩm */}
                  {this.state.showSuggest &&
                    this.state.suggestList.length > 0 && (
                      <ul className="absolute z-50 bg-white border border-gray-200 rounded-lg mt-1 w-full max-h-60 overflow-auto shadow-lg">
                        {this.state.suggestList.map((p) => (
                          <li
                            key={p.productId}
                            className="px-3 py-2 hover:bg-[#E1FBFF] cursor-pointer flex justify-between items-center"
                            onClick={() => {
                              this.setState({
                                productName: p.productName,
                                barcode: p.barcode || "",
                                price: p.price || "",
                                cost: p.cost || "",
                                importPrice: p.cost * (p.quantity || 1),
                                categoryId: p.categoryId || "",
                                quantity: p.quantity || "",
                                imageUrl: p.productImageURL || p.imageUrl || "",
                                isLow: p.isLow || 0,
                                units:
                                  (p.units || p.unitOptions || []).map((u) => ({
                                    id: u.unitId || u.productUnitId,
                                    name: u.unitName,
                                    conversion: u.conversionFactor,
                                    price: u.price,
                                    isBase: u.conversionFactor === 1,
                                  })) || [],
                                showSuggest: false,
                              });
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  p.productImageURL ||
                                  p.imageUrl ||
                                  "/no-image.png"
                                }
                                alt=""
                                className="w-8 h-8 rounded object-cover"
                              />
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {p.productName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {p.categoryName || "Không phân loại"}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500">
                              {fmt.format(p.price)}đ
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>

                <div>
                  <label className="font-semibold block mb-1">Mã vạch</label>
                  <Input
                    placeholder="Vd. 1234567890"
                    value={barcode}
                    onChange={(e) => this.setState({ barcode: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Phân loại <span className="text-red-500">*</span>
                </label>
                <select
                  className="border rounded-md px-3 py-2 w-full"
                  value={categoryId}
                  onChange={(e) =>
                    this.setState({
                      categoryId: Number(e.target.value),
                      categoryName: this.getCategoryNameById(e.target.value),
                    })
                  }
                >
                  <option value="">-- Chọn danh mục --</option>
                  {categories
                    .filter((c) => c.id !== "all")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.categoryName}
                      </option>
                    ))}
                </select>
              </div>

              {/* <div className="bg-[#E1FBFF] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/60 rounded-lg grid place-items-center">
                    🧋
                  </div>
                  <div>
                    <p className="font-semibold">Báo hết món</p>
                    <p className="text-sm text-gray-500">
                      Hiển thị thông báo hết món
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={isLow}
                  onChange={(e) => this.setState({ isLow: e.target.checked })}
                />
              </div> */}

              {/* --- Giá nhập hàng, Giá vốn, Giá bán --- */}
              <div className="grid grid-cols-3 gap-6">
                {/* Giá nhập hàng */}
                <div className="flex flex-col">
                  <label className="font-semibold mb-1">Giá nhập hàng *</label>
                  <Input
                    placeholder="VD: 120000"
                    value={
                      this.state.importPrice
                        ? this.state.importPrice.toLocaleString("vi-VN")
                        : ""
                    }
                    onChange={(e) => {
                      const raw =
                        Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                      const quantity = Number(this.state.quantity) || 1;
                      const cost = quantity > 0 ? raw / quantity : raw;
                      this.setState({ importPrice: raw, cost });
                    }}
                    className="text-left font-medium"
                  />
                  <span className="text-sm text-gray-500 mt-1">
                    {this.state.importPrice
                      ? `${fmt.format(this.state.importPrice)} đ`
                      : ""}
                  </span>
                </div>

                {/* Giá vốn */}
                <div className="flex flex-col">
                  <label className="font-semibold mb-1">Giá vốn</label>
                  <Input
                    readOnly
                    value={
                      this.state.cost
                        ? this.state.cost.toLocaleString("vi-VN")
                        : ""
                    }
                    className="text-left font-medium bg-gray-50"
                  />
                  <span className="text-sm text-gray-500 mt-1">
                    {this.state.cost ? `${fmt.format(this.state.cost)} đ` : ""}
                  </span>
                </div>

                {/* Giá bán */}
                <div className="flex flex-col">
                  <label className="font-semibold mb-1">Giá bán *</label>
                  <Input
                    placeholder="VD: 150000"
                    value={
                      this.state.price
                        ? this.state.price.toLocaleString("vi-VN")
                        : ""
                    }
                    onChange={(e) => {
                      const raw =
                        Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                      this.setState({ price: raw });
                    }}
                    className="text-left font-medium"
                  />
                  <span className="text-sm text-gray-500 mt-1">
                    {this.state.price
                      ? `${fmt.format(this.state.price)} đ`
                      : ""}
                  </span>
                </div>
              </div>

              {/* --- Số lượng --- */}
              <div className="mt-4">
                <label className="font-semibold block mb-1">Số lượng</label>
                <Input
                  placeholder="VD: 10"
                  value={this.state.quantity}
                  onChange={(e) => {
                    const quantity = Number(e.target.value) || 0;
                    const importPrice = Number(this.state.importPrice) || 0;
                    const cost =
                      quantity > 0 ? importPrice / quantity : importPrice;
                    this.setState({ quantity, cost });
                  }}
                  className="text-left font-medium"
                />
                <span className="text-sm text-gray-500 mt-1">
                  {this.state.quantity ? `${this.state.quantity} sản phẩm` : ""}
                </span>
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-gray-800 mb-2">
                Thông tin chi tiết
              </h3>
              <div className="bg-[#E1FBFF] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/60 rounded-lg grid place-items-center">
                    ⚠️
                  </div>
                  <div>
                    <p className="font-semibold">Ngưỡng cảnh báo nhập hàng</p>
                    <p className="text-sm text-gray-500">
                      Nếu tồn kho &lt; giá trị này → hệ thống gửi cảnh báo
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    className="w-24 text-center"
                    placeholder="VD: 5"
                    value={isLow}
                    onChange={(e) =>
                      this.setState({ isLow: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="text-gray-600 text-sm">sản phẩm</span>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold">Đơn vị</p>
                    <p className="text-sm text-gray-500">
                      Thiết lập các đơn vị quy đổi
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-lg px-4 py-2 text-sm"
                    onClick={this.toggleUnitModal}
                  >
                    Cấu hình
                  </Button>
                </div>

                {/*  Danh sách đơn vị hiển thị sau khi cấu hình */}
                <div className="space-y-2">
                  {this.state.units.length === 0 ? (
                    <p className="text-gray-400 text-sm">Chưa có đơn vị</p>
                  ) : (
                    this.state.units.map((u, idx) => (
                      <div
                        key={u.id}
                        className="flex justify-between items-center bg-white border rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700">
                            {u.name || "—"}
                          </span>
                          {u.isBase && (
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                              cơ bản
                            </span>
                          )}
                          {!u.isBase && (
                            <span className="text-xs text-gray-500">
                              x{u.conversion || 1}
                            </span>
                          )}
                        </div>
                        {!u.isBase && (
                          <span className="text-sm text-[#00A8B0] font-semibold">
                            + {u.price ? fmt.format(u.price) : 0}đ
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <Button
              variant="outline"
              className="rounded-lg px-6 py-2 text-gray-600"
              onClick={this.toggleAddModal}
            >
              Hủy
            </Button>
            <Button
              disabled={this.state.saving}
              className={`rounded-lg px-6 py-2 text-white transition-all ${
                this.state.saving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#00A8B0] hover:bg-[#00929A]"
              }`}
              onClick={this.handleSaveProduct}
            >
              {this.state.saving ? (
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                  <span>Đang lưu...</span>
                </div>
              ) : (
                "Lưu sản phẩm"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  renderEditModal() {
    const { categories, categoryId, productName, barcode, cost, price, isLow } =
      this.state;

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex justify-center items-center z-50">
        <div className="bg-white w-[1100px] h-[90vh] shadow-2xl rounded-2xl p-10 overflow-y-auto relative">
          <button
            onClick={this.closeEditModal}
            className="absolute top-6 right-6 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-3xl font-extrabold text-[#007E85] mb-8">
            ✏️ CHỈNH SỬA SẢN PHẨM
          </h2>

          <div className="grid grid-cols-2 gap-8">
            {/* LEFT */}
            <div className="space-y-6">
              {/* Ảnh sản phẩm */}
              <div className="flex flex-col items-center">
                <label
                  htmlFor="editImageUpload"
                  className="w-[140px] h-[140px] rounded-xl border-2 border-dashed border-[#00A8B0] bg-[#E1FBFF] grid place-items-center text-[#00A8B0] font-semibold text-sm cursor-pointer hover:bg-[#D5F7F9] transition overflow-hidden"
                >
                  {this.state.imageUrl ? (
                    <img
                      src={this.state.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mb-1" />
                      ẢNH
                    </>
                  )}
                </label>
                <input
                  id="editImageUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={this.handleImageUpload}
                />
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Nhấn để tải ảnh lên
                </p>
              </div>

              {/* Tên sản phẩm & Mã vạch */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold block mb-1">
                    Tên sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="VD: Trà sữa Matcha"
                    value={productName}
                    onChange={(e) =>
                      this.setState({ productName: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Mã vạch</label>
                  <Input
                    placeholder="VD: 8938505974132"
                    value={barcode}
                    onChange={(e) => this.setState({ barcode: e.target.value })}
                  />
                </div>
              </div>

              {/* Danh mục */}
              <div>
                <label className="font-semibold block mb-1">
                  Danh mục <span className="text-red-500">*</span>
                </label>
                <select
                  className="border rounded-md px-3 py-2 w-full"
                  value={categoryId}
                  onChange={(e) =>
                    this.setState({ categoryId: Number(e.target.value) })
                  }
                >
                  <option value="">-- Chọn danh mục --</option>
                  {categories
                    .filter((c) => c.id !== "all")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Giá vốn & Giá bán */}
              <div className="grid grid-cols-2 gap-6">
                {/* Giá vốn */}
                <div className="flex flex-col">
                  <label className="font-semibold mb-1">Giá vốn</label>
                  <Input
                    readOnly
                    value={cost ? cost.toLocaleString("vi-VN") : ""}
                    className="text-left font-medium bg-gray-50"
                  />
                  <span className="text-sm text-gray-500 mt-1">
                    {cost ? `${fmt.format(cost)} đ` : ""}
                  </span>
                </div>

                {/* Giá bán */}
                <div className="flex flex-col">
                  <label className="font-semibold mb-1">Giá bán *</label>
                  <Input
                    placeholder="VD: 35000"
                    value={price ? price.toLocaleString("vi-VN") : ""}
                    onChange={(e) => {
                      const raw =
                        Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                      this.setState({ price: raw });
                    }}
                    className="text-left font-medium"
                  />
                  <span className="text-sm text-gray-500 mt-1">
                    {price ? `${fmt.format(price)} đ` : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-gray-800 mb-2">
                Thông tin chi tiết
              </h3>

              {/* Ngưỡng cảnh báo */}
              <div className="bg-[#E1FBFF] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/60 rounded-lg grid place-items-center">
                    ⚠️
                  </div>
                  <div>
                    <p className="font-semibold">Ngưỡng cảnh báo nhập hàng</p>
                    <p className="text-sm text-gray-500">
                      Nếu tồn kho &lt; giá trị này → hệ thống gửi cảnh báo
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    className="w-24 text-center"
                    placeholder="VD: 5"
                    value={isLow}
                    onChange={(e) =>
                      this.setState({ isLow: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="text-gray-600 text-sm">sản phẩm</span>
                </div>
              </div>

              {/* Đơn vị */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold">Đơn vị</p>
                    <p className="text-sm text-gray-500">
                      Thiết lập các đơn vị quy đổi
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-lg px-4 py-2 text-sm"
                    onClick={this.toggleUnitModal}
                  >
                    Cấu hình
                  </Button>
                </div>

                <div className="space-y-2">
                  {this.state.units.length === 0 ? (
                    <p className="text-gray-400 text-sm">Chưa có đơn vị</p>
                  ) : (
                    this.state.units.map((u) => (
                      <div
                        key={u.id}
                        className="flex justify-between items-center bg-white border rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700">
                            {u.name || "—"}
                          </span>
                          {u.isBase ? (
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                              cơ bản
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              x{u.conversion || 1}
                            </span>
                          )}
                        </div>
                        {!u.isBase && (
                          <span className="text-sm text-[#00A8B0] font-semibold">
                            + {u.price ? fmt.format(u.price) : 0}đ
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BUTTON */}
          <div className="mt-8 flex justify-end gap-4">
            <Button
              variant="outline"
              className="rounded-lg px-6 py-2 text-gray-600"
              onClick={this.closeEditModal}
            >
              Hủy
            </Button>
            <Button
              disabled={this.state.saving}
              className={`rounded-lg px-6 py-2 text-white transition-all ${
                this.state.saving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#00A8B0] hover:bg-[#00929A]"
              }`}
              onClick={this.handleUpdateProduct}
            >
              {this.state.saving ? (
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                  <span>Đang lưu...</span>
                </div>
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Unit Modal ---------- */
  renderUnitModal() {
    const { units } = this.state;

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex justify-center items-center z-[60]">
        <div className="bg-white w-[600px] rounded-2xl shadow-2xl p-8 relative">
          <button
            onClick={this.toggleUnitModal}
            className="absolute top-5 right-5 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-2xl font-extrabold text-[#007E85] mb-6">
            CẤU HÌNH ĐƠN VỊ
          </h2>

          {/* Danh sách đơn vị */}
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            {units.map((u, idx) => (
              <div
                key={u.id}
                className="border border-gray-200 rounded-xl p-4 space-y-3 relative"
              >
                {idx > 0 && (
                  <button
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                    onClick={() => this.handleRemoveUnit(idx)}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={u.isBase}
                    onChange={(e) =>
                      this.handleSetBaseUnit(idx, e.target.checked)
                    }
                  />
                  <label className="font-semibold text-gray-800">
                    Đơn vị cơ bản
                  </label>
                  <Input
                    placeholder="Vd. chai"
                    value={u.name}
                    onChange={(e) =>
                      this.handleChangeUnit(idx, "name", e.target.value)
                    }
                    className="ml-auto w-[150px]"
                  />
                </div>

                {!u.isBase && (
                  <>
                    <div className="flex items-center gap-3">
                      <label className="font-semibold text-gray-800">
                        Giá trị quy đổi
                      </label>
                      <Input
                        placeholder="Vd. 6"
                        type="number"
                        value={u.conversion}
                        onChange={(e) =>
                          this.handleChangeUnit(
                            idx,
                            "conversion",
                            e.target.value
                          )
                        }
                        className="w-[120px]"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="font-semibold text-gray-800">
                        Giá bán
                      </label>
                      <Input
                        placeholder="Vd. 120000"
                        type="number"
                        value={u.price}
                        onChange={(e) =>
                          this.handleChangeUnit(idx, "price", e.target.value)
                        }
                        className="w-[150px]"
                      />
                      <span className="text-gray-500">VND</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Thêm đơn vị */}
          <Button
            variant="outline"
            className="mt-4 w-full border-[#00A8B0] text-[#00A8B0] hover:bg-[#E1FBFF]"
            onClick={this.handleAddUnit}
          >
            + Thêm đơn vị
          </Button>

          <div className="mt-8 flex justify-end gap-4">
            <Button
              variant="outline"
              className="rounded-lg px-6 py-2 text-gray-600"
              onClick={this.toggleUnitModal}
            >
              Hủy
            </Button>
            <Button
              className="bg-[#00A8B0] text-white rounded-lg px-6 py-2 hover:bg-[#00929A]"
              onClick={this.handleConfirmUnits}
            >
              Đồng ý
            </Button>
          </div>
        </div>
      </div>
    );
  }

  renderDetailModal() {
    const { selectedProduct } = this.state;
    if (!selectedProduct) return null;

    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white w-[650px] rounded-2xl shadow-2xl p-8 relative">
          <button
            onClick={this.closeProductDetail}
            className="absolute top-5 right-5 text-gray-500 hover:text-gray-800"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-2xl font-extrabold text-[#007E85] mb-6">
            🧾 Chi tiết sản phẩm
          </h2>

          {/* Ảnh + Tên */}
          <div className="flex items-center gap-4 mb-6">
            <img
              src={selectedProduct.img}
              alt={selectedProduct.name}
              className="w-24 h-24 rounded-lg object-cover border"
            />
            <div>
              <p className="font-bold text-lg text-gray-800">
                {selectedProduct.name}
              </p>
              <p className="text-sm text-gray-500">ID: {selectedProduct.id}</p>
            </div>
          </div>

          {/* Thông tin tổng quan */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Mã vạch</p>
              <p className="font-semibold">{selectedProduct.barcode || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Danh mục</p>
              <p className="font-semibold">{selectedProduct.category}</p>
            </div>
            <div>
              <p className="text-gray-500">Giá bán</p>
              <p className="font-semibold text-[#007E85]">
                {fmt.format(selectedProduct.price)} đ
              </p>
            </div>
            <div>
              <p className="text-gray-500">Giá vốn</p>
              <p className="font-semibold">
                {fmt.format(selectedProduct.cost || 0)} đ
              </p>
            </div>
            <div>
              <p className="text-gray-500">Số lượng tồn</p>
              <p className="font-semibold">{selectedProduct.stock ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Ngưỡng cảnh báo</p>
              <p className="font-semibold text-orange-600">
                {selectedProduct.isLow ?? 0}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Giảm giá (%)</p>
              <p className="font-semibold">{selectedProduct.discount ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Trạng thái</p>
              <p
                className={`font-semibold ${
                  selectedProduct.status === 1
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {selectedProduct.status === 1 ? "Đang hoạt động" : "Ngưng"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Ngày tạo</p>
              <p className="font-semibold">
                {new Date(selectedProduct.createdAt).toLocaleString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Cập nhật</p>
              <p className="font-semibold">
                {selectedProduct.updatedAt &&
                !["0001-01-01T00:00:00", "null", "undefined", ""].includes(
                  String(selectedProduct.updatedAt).trim()
                )
                  ? new Date(selectedProduct.updatedAt).toLocaleString(
                      "vi-VN",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }
                    )
                  : "—"}
              </p>
            </div>
          </div>

          {/* Đơn vị quy đổi */}
          <div className="mt-6">
            <p className="text-gray-500 mb-2 font-semibold">Đơn vị quy đổi</p>
            <div className="flex flex-wrap gap-2">
              {selectedProduct.unitOptions?.length > 0 ? (
                selectedProduct.unitOptions.map((u) => (
                  <span
                    key={u.productUnitId}
                    className="px-3 py-1 bg-[#E1FBFF] text-[#007E85] rounded-full text-sm border"
                  >
                    {u.unitName} (x{u.conversionFactor}) - {fmt.format(u.price)}
                    đ
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm">Không có</span>
              )}
            </div>
          </div>

          {/* Nút đóng */}
          <div className="mt-8 flex justify-end gap-4">
            <Button
              onClick={this.closeProductDetail}
              variant="outline"
              className="px-6 py-2 rounded-lg text-gray-600"
            >
              Đóng
            </Button>
            <Button
              onClick={this.openEditProduct}
              className="bg-[#00A8B0] text-white px-6 py-2 rounded-lg hover:bg-[#00929A]"
            >
              Chỉnh sửa
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- FILTER DATA ---------- */
  getFiltered = (tabValue) => {
    const entry = this.state.productsByTab[tabValue] || { items: [] };
    if (!this.state.search.trim()) return entry.items;
    const q = normalize(this.state.search);
    return entry.items.filter((it) => normalize(it.name).includes(q));
  };

  render() {
    const {
      categories,
      activeTab,
      catError,
      loading,
      productsByTab,
      search,
      showAddModal,
    } = this.state;

    return (
      <div className="flex h-screen w-screen overflow-x-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto relative">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85]">KHO HÀNG</h1>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm kiếm sản phẩm..."
                  value={search}
                  onChange={(e) => this.setSearch(e.target.value)}
                  className="pl-12 w-72 h-11 text-base rounded-xl bg-white/80 border border-gray-200 focus-visible:ring-0"
                />
              </div>
              <Button
                className="bg-[#00A8B0] text-white text-base rounded-xl px-6 py-3 hover:bg-[#00929A] flex items-center gap-2"
                onClick={this.toggleAddModal}
              >
                <Plus className="w-5 h-5" /> Thêm sản phẩm
              </Button>
            </div>
          </div>

          {!categories.length ? (
            <div className="text-gray-500">
              {loading
                ? "Đang tải danh mục..."
                : catError || "Không có danh mục"}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={this.setActiveTab}>
              <TabsList className="flex gap-3 mb-8 flex-wrap shadow-none">
                {categories.map((cat) => (
                  <TabsTrigger
                    key={cat.value}
                    value={cat.value}
                    className="
                      rounded-full px-7 py-3 text-base font-semibold
                      border-2 border-[#00A8B0]
                      transition-all duration-300
                      data-[state=active]:bg-[#00A8B0]
                      data-[state=active]:text-white
                      data-[state=inactive]:bg-transparent
                      data-[state=inactive]:text-[#00A8B0]
                      hover:bg-[#00A8B0]/10 hover:scale-[1.03]
                      shadow-sm
                    "
                  >
                    {cat.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {categories.map((cat) => {
                const entry = productsByTab[cat.value] || { items: [] };
                const list = this.getFiltered(cat.value);

                return (
                  <TabsContent key={cat.value} value={cat.value}>
                    <div className="text-gray-600 font-semibold text-base mb-4">
                      {list.length} Sản phẩm
                    </div>
                    <div className="space-y-5">
                      {entry.loading ? (
                        <div>Đang tải sản phẩm...</div>
                      ) : entry.error ? (
                        <div className="text-red-600">{entry.error}</div>
                      ) : (
                        list.map((p) => (
                          <Card
                            key={p.id}
                            className={`grid grid-cols-[1.5fr_0.5fr_0.8fr_1fr_0.2fr] items-center gap-4 p-5 border rounded-xl ${
                              p.stock === 0
                                ? "bg-gray-100 opacity-70"
                                : "bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <img
                                src={p.img}
                                alt={p.name}
                                className="w-20 h-20 rounded-lg object-cover"
                              />
                              <div>
                                <h3
                                  className={`font-bold text-xl ${
                                    p.stock === 0
                                      ? "text-gray-400"
                                      : "text-gray-800"
                                  }`}
                                >
                                  {p.name}
                                </h3>
                                <p className="text-base text-[#00A8B0]">
                                  {p.category}
                                </p>
                              </div>
                            </div>

                            <div className="text-center">
                              <p className="text-base text-gray-500">Kho</p>
                              {p.stock > 0 ? (
                                <p className="font-semibold text-lg">
                                  {p.stock}
                                </p>
                              ) : (
                                <span className="text-red-500 font-bold text-sm bg-red-100 px-3 py-1 rounded">
                                  Hết hàng
                                </span>
                              )}
                            </div>

                            <div className="text-right">
                              <p
                                className={`font-bold text-lg ${
                                  p.stock === 0
                                    ? "text-gray-400"
                                    : "text-gray-800"
                                }`}
                              >
                                {fmt.format(p.price)} VND
                              </p>
                            </div>

                            <div className="flex flex-col items-start">
                              <p className="text-base text-gray-500 mb-2">
                                Đơn vị
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {p.unitOptions.length > 0 ? (
                                  p.unitOptions.map((u) => (
                                    <Button
                                      key={u.productUnitId}
                                      variant="outline"
                                      className="text-sm px-4 py-2 rounded-md"
                                    >
                                      {u.unitName}
                                    </Button>
                                  ))
                                ) : (
                                  <span className="text-gray-400 text-sm">
                                    Không có
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full w-10 h-10 hover:bg-[#E1FBFF] hover:text-[#007E85]"
                                onClick={() => this.openProductDetail(p)}
                              >
                                <ChevronRight className="w-5 h-5" />
                              </Button>
                            </div>
                            {p.stock <= p.isLow && (
                              <span className="text-orange-600 text-sm font-semibold">
                                ⚠️ Cần nhập hàng
                              </span>
                            )}
                          </Card>
                        ))
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
          {showAddModal && this.renderAddModal()}
          {this.state.showUnitModal && this.renderUnitModal()}
          {this.state.showDetailModal && this.renderDetailModal()}
          {this.state.showEditModal && this.renderEditModal()}
        </div>
      </div>
    );
  }
}

export default function ProductPage() {
  const navigate = useNavigate();
  return <ProductPageClass navigate={navigate} />;
}
