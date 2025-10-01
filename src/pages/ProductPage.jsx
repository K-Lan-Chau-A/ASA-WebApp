import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Sidebar from "@/components/sidebar";
import API_URL from "@/config/api";
import { Search, Filter, Plus, X, Trash2, Upload } from "lucide-react";

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

    // ⚡ Form thêm sản phẩm
    productName: "",
    barcode: "",
    cost: "",
    price: "",
    isLow: false,
    categoryId: "",
    quantity: "",
    imageUrl: "",
    units: [], // { id, isBase, name, conversion, price }
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
  fetchCategories = async () => {
    if (!this.state.shopId) return;
    const token = localStorage.getItem("accessToken");
    this.setState({ loading: true, catError: "" });

    try {
      const url = `${API_URL}/api/products?page=1&pageSize=500`;
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
      const byShop = items
        .filter((p) => Number(p.shopId) === Number(this.state.shopId))
        .filter((p) => Number(p.status) === 1);

      const map = new Map();
      for (const p of byShop) {
        const id = p.categoryId;
        const name = p.categoryName || `Danh mục ${id}`;
        if (!map.has(id))
          map.set(id, { id, name, value: `${id}-${slugify(name)}` });
      }

      const withAll = [
        { id: "all", name: "Tất cả", value: "all" },
        ...Array.from(map.values()),
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
        .filter((p) => (categoryId ? Number(p.categoryId) === categoryId : true))
        .map((p) => {
          const pid = Number(p.productId);
          const unitRows = this.state.unitsByPid[pid] || [];
          const base = unitRows.length ? unitRows[0] : null;
          return {
            id: pid,
            name: p.productName,
            category: p.categoryName,
            stock: p.quantity ?? 0,
            price: base ? base.price : p.price ?? 0,
            img:
  p.productImageURL ||
  p.imageUrl ||
  "/no-image.png",

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

  /* ---------- HANDLERS ---------- */
  toggleFilter = () => this.setState((s) => ({ showFilter: !s.showFilter }));
  toggleAddModal = () => this.setState((s) => ({ showAddModal: !s.showAddModal }));
  toggleUnitModal = () => this.setState((s) => ({ showUnitModal: !s.showUnitModal }));
  setActiveTab = (v) => this.setState({ activeTab: v });
  setSearch = (v) => this.setState({ search: v });

  /* ---------- Unit Handlers ---------- */
  handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  this.setState({
    imageFile: file, // lưu file thật
    imageUrl: URL.createObjectURL(file), // preview
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
  const { shopId, units, categoryId, isLow, imageUrl, quantity } = this.state;

  // Lấy dữ liệu từ form state (không dùng querySelector)
  const { productName, barcode, cost, price } = this.state;

  // Kiểm tra dữ liệu bắt buộc
  if (!productName || !categoryId || !price) {
    alert("⚠️ Vui lòng nhập đầy đủ thông tin bắt buộc");
    return;
  }

  try {
    /* 1️⃣ Tạo sản phẩm */
    const productPayload = {
      productName,
      quantity: Number(quantity || 0),
      cost: Number(cost || 0),
      price: Number(price || 0),
      promotionPrice: 0,
      productImageURL: imageUrl || "",
      barcode,
      discount: 0,
      isLow,
      status: 1,
      shopId,
      categoryId: Number(categoryId),
      categoryName: "",
      unitIdFk: 0,
    };

    console.log("📦 Gửi sản phẩm:", productPayload);

    const resProd = await fetch(`${API_URL}/api/products`, {
      method: "POST",
      headers: {
        accept: "text/plain",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(productPayload),
    });

    const prodData = await this.safeParse(resProd);
    if (!resProd.ok) throw new Error(prodData?.message || "Lỗi tạo sản phẩm");

    const productId = prodData.productId;
    console.log("✅ Tạo sản phẩm thành công:", prodData);

    /* 2️⃣ Gọi API tạo đơn vị quy đổi */
    for (const u of units) {
      const unitPayload = {
        shopId,
        productId,
        unitId: 0,
        unitName: u.name,
        conversionFactor: Number(u.conversion || 1), // ✅ FIX đúng field
        price: Number(u.price || 0),
      };

      console.log("📏 Gửi đơn vị:", unitPayload);

      const resUnit = await fetch(`${API_URL}/api/product-units`, {
        method: "POST",
        headers: {
          accept: "text/plain",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(unitPayload),
      });

      const unitData = await this.safeParse(resUnit);
      if (!resUnit.ok) {
        console.error("⚠️ Lỗi tạo đơn vị:", u.name, unitData);
      } else {
        console.log("✅ Đã thêm đơn vị:", unitData);
      }
    }

    alert("🎉 Thêm sản phẩm và đơn vị thành công!");
    this.toggleAddModal();
    this.ensureProducts(this.state.activeTab, true); // reload danh sách
  } catch (err) {
    console.error(err);
    alert("❌ Thêm sản phẩm thất bại: " + err.message);
  }
};



  /* ---------- UI - Modal thêm sản phẩm ---------- */
  renderAddModal() {
    const { categories, categoryId, productName, barcode, cost, price, isLow, quantity } =
      this.state;
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
                <div>
                  <label className="font-semibold block mb-1">
                    Tên sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Vd. Trà sữa Thái xanh"
                    value={productName}
                    onChange={(e) =>
                      this.setState({ productName: e.target.value })
                    }
                  />
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
                  onChange={(e) => this.setState({ categoryId: e.target.value })}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold block mb-2">
                    Giá vốn <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Vd. 123456"
                      value={cost}
                      onChange={(e) => this.setState({ cost: e.target.value })}
                    />
                    <span className="bg-gray-100 border rounded-md px-3 flex items-center">
                      VND
                    </span>
                  </div>
                </div>
                <div>
                  <label className="font-semibold block mb-2">
                    Giá bán <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Vd. 123456"
                      value={price}
                      onChange={(e) => this.setState({ price: e.target.value })}
                    />
                    <span className="bg-gray-100 border rounded-md px-3 flex items-center">
                      VND
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Số lượng</label>
                <Input
                  placeholder="Vd. 10"
                  value={quantity}
                  onChange={(e) => this.setState({ quantity: e.target.value })}
                />
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

  {/* ✅ Danh sách đơn vị hiển thị sau khi cấu hình */}
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
            <span className="font-semibold text-gray-700">{u.name || "—"}</span>
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
              className="bg-[#00A8B0] text-white rounded-lg px-6 py-2 hover:bg-[#00929A]"
              onClick={this.handleSaveProduct}
            >
              Lưu sản phẩm
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex justify-center items-center z-50">
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
                  onChange={(e) => this.handleSetBaseUnit(idx, e.target.checked)}
                />
                <label className="font-semibold text-gray-800">
                  Đơn vị cơ bản
                </label>
                <Input
                  placeholder="Vd. chai"
                  value={u.name}
                  onChange={(e) => this.handleChangeUnit(idx, "name", e.target.value)}
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
                        this.handleChangeUnit(idx, "conversion", e.target.value)
                      }
                      className="w-[120px]"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-gray-800">Giá bán</label>
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

        {/* Nút hành động */}
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
            onClick={this.toggleUnitModal}
          >
            Đồng ý
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
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto relative">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85]">
              KHO HÀNG
            </h1>
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
              {loading ? "Đang tải danh mục..." : catError || "Không có danh mục"}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={this.setActiveTab}>
              <TabsList className="flex gap-3 mb-8 flex-wrap">
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
                                <p className="font-semibold text-lg">{p.stock}</p>
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
                                variant="outline"
                                className="rounded-full w-10 h-10 grid place-items-center"
                              >
                                <span className="text-2xl">&gt;</span>
                              </Button>
                            </div>
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
        </div>
      </div>
    );
  }
}

export default function ProductPage() {
  const navigate = useNavigate();
  return <ProductPageClass navigate={navigate} />;
}
