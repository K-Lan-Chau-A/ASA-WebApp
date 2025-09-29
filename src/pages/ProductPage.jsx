import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Sidebar from "@/components/sidebar";
import API_URL from "@/config/api";
import { Search, Filter, Plus, X, Trash2 } from "lucide-react";

/* ---------- Debug logger ---------- */
const DEBUG = true;
const tlog = (ns) => (msg, ...rest) =>
  DEBUG &&
  console.log(
    `%c[${ns}]%c ${msg}`,
    "color:#00A8B0;font-weight:700",
    "color:inherit",
    ...rest
  );
const logApp = tlog("APP");
const logCat = tlog("CATEGORIES");
const logProd = tlog("PRODUCTS");
const logUnit = tlog("UNITS");

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

    // ⚡ Đơn vị
    units: [
      { id: 1, isBase: true, name: "Chai", conversion: 1, price: "" },
    ],
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
    } catch (e) {
      logApp("Parse profile error", e);
    }

    const shopId = Number(profile?.shopId || 0);
    if (!shopId) return;

    logApp("Detected shopId =", shopId);
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
    } catch (e) {
      logUnit("Fetch units error", e);
    }
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
              "https://via.placeholder.com/150",
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

  addUnitRow = () => {
    this.setState((prev) => ({
      units: [
        ...prev.units,
        { id: Date.now(), isBase: false, name: "", conversion: "", price: "" },
      ],
    }));
  };

  updateUnitField = (id, field, value) => {
    this.setState((prev) => ({
      units: prev.units.map((u) =>
        u.id === id ? { ...u, [field]: value } : u
      ),
    }));
  };

  removeUnitRow = (id) => {
    this.setState((prev) => ({
      units: prev.units.filter((u) => u.id !== id),
    }));
  };

  /* ---------- FILTER DATA ---------- */
  getFiltered = (tabValue) => {
    const entry = this.state.productsByTab[tabValue] || { items: [] };
    if (!this.state.search.trim()) return entry.items;
    const q = normalize(this.state.search);
    return entry.items.filter((it) => normalize(it.name).includes(q));
  };

  /* ---------- RENDER ---------- */
  render() {
    const {
      categories,
      activeTab,
      catError,
      loading,
      productsByTab,
      search,
      showFilter,
      showAddModal,
      showUnitModal,
      units,
    } = this.state;

    return (
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />

        {/* CONTENT */}
        <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-extrabold text-[#007E85]">
              KHO HÀNG
            </h1>
            <div className="flex items-center space-x-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Tìm kiếm sản phẩm..."
                  value={search}
                  onChange={(e) => this.setSearch(e.target.value)}
                  className="pl-12 w-72 h-11 text-base rounded-xl bg-white/80 border border-gray-200 focus-visible:ring-0"
                />
              </div>

              {/* Filter */}
              <Button
                variant="outline"
                className="rounded-xl text-base px-5 py-2 flex items-center gap-2"
                onClick={this.toggleFilter}
              >
                <Filter className="w-5 h-5" /> Lọc
              </Button>

              {/* Add */}
              <Button
                className="bg-[#00A8B0] text-white text-base rounded-xl px-6 py-3 hover:bg-[#00929A] flex items-center gap-2"
                onClick={this.toggleAddModal}
              >
                <Plus className="w-5 h-5" /> Thêm sản phẩm
              </Button>
            </div>
          </div>

          {/* Tabs */}
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
                            {/* Name */}
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

                            {/* Stock */}
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

                            {/* Price */}
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

                            {/* Units */}
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

                            {/* Action */}
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

          {/* ✅ Modal Filter */}
          {showFilter && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex justify-end z-50">
              <div className="bg-white w-[420px] h-full p-8 shadow-2xl rounded-l-2xl animate-slide-in-right overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-[#00A8B0]">LỌC</h2>
                  <button
                    onClick={this.toggleFilter}
                    className="text-gray-500 hover:text-gray-800"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="border rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-700 mb-4">
                    Sắp xếp
                  </h3>
                  {["Theo tên", "Theo giá", "Theo tỉ lệ mua hàng"].map(
                    (label) => (
                      <div
                        key={label}
                        className="flex justify-between items-center mb-3 last:mb-0"
                      >
                        <span className="text-gray-700">{label}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            ⬆️
                          </Button>
                          <Button variant="outline" size="sm">
                            ⬇️
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="border rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-700 mb-4">Tồn kho</h3>
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      variant="default"
                      className="bg-[#00A8B0] text-white hover:bg-[#00929A]"
                    >
                      Tất cả
                    </Button>
                    <Button variant="outline">Còn hàng</Button>
                    <Button variant="outline">Hết hàng</Button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={this.toggleFilter}
                    className="rounded-lg px-5"
                  >
                    Thoát
                  </Button>
                  <Button variant="outline" className="rounded-lg px-5">
                    Làm mới
                  </Button>
                  <Button className="bg-[#00A8B0] text-white rounded-lg px-6 hover:bg-[#00929A]">
                    Áp dụng
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ✅ Modal Thêm sản phẩm */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex justify-end z-50">
              <div className="bg-white w-[1000px] h-full shadow-2xl rounded-l-2xl p-10 overflow-y-auto animate-slide-in-right relative">
                <button
                  onClick={this.toggleAddModal}
                  className="absolute top-6 right-6 text-gray-500 hover:text-gray-800"
                >
                  <X className="w-6 h-6" />
                </button>

                <h2 className="text-3xl font-extrabold text-[#007E85] mb-8">
                  SẢN PHẨM
                </h2>

                <div className="grid grid-cols-2 gap-10">
                  {/* LEFT */}
                  <div className="space-y-6">
                    <div>
                      <label className="font-semibold block mb-2">
                        Tên sản phẩm <span className="text-red-500">*</span>
                      </label>
                      <Input placeholder="Vd. Trà sữa Thái xanh" />
                    </div>

                    <div>
                      <label className="font-semibold block mb-2">Mã vạch</label>
                      <Input placeholder="Vd. 1234567890" />
                    </div>

                    <div>
                      <label className="font-semibold block mb-2">
                        Phân loại <span className="text-red-500">*</span>
                      </label>
                      <Input placeholder="Vd. Trà sữa" />
                    </div>

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
                      <input type="checkbox" className="toggle" />
                    </div>

                    <div>
                      <label className="font-semibold block mb-3">
                        Phương thức bán hàng{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-3">
                        {["Mang về", "Giao hàng", "Tại chỗ"].map((label) => (
                          <div
                            key={label}
                            className="border-2 border-[#00A8B0] rounded-xl px-6 py-4 text-center cursor-pointer hover:bg-[#E1FBFF]"
                          >
                            <p className="font-semibold text-[#007E85]">
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold block mb-2">Giá vốn</label>
                        <div className="flex gap-2">
                          <Input placeholder="Vd. 123456" />
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
                          <Input placeholder="Vd. 123456" />
                          <span className="bg-gray-100 border rounded-md px-3 flex items-center">
                            VND
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="space-y-5">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      Thông tin chi tiết
                    </h3>

                    {["Nhiệt độ", "Size", "Đường", "Đá"].map((item) => (
                      <div
                        key={item}
                        className="border rounded-lg p-3 flex justify-between items-center"
                      >
                        <p className="font-semibold">{item}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Tắt</span>
                          <input type="checkbox" className="toggle" />
                        </div>
                      </div>
                    ))}

                    {/* Đơn vị */}
                    <div className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-semibold">Đơn vị</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={this.toggleUnitModal}
                          className="text-sm"
                        >
                          + Thêm đơn vị
                        </Button>
                      </div>
                      {units.map((u, idx) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between py-1 border-b last:border-0 text-sm"
                        >
                          <span>
                            {u.isBase ? "⭐" : idx + 1}. {u.name || "Chưa đặt tên"}
                          </span>
                          <span className="text-gray-500">
                            x{u.conversion || 1} → {u.price || 0} VND
                          </span>
                        </div>
                      ))}
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
                  <Button className="bg-[#00A8B0] text-white rounded-lg px-6 py-2 hover:bg-[#00929A]">
                    Lưu sản phẩm
                  </Button>
                </div>

                {/* ⚡ Modal con: Cấu hình đơn vị */}
                {showUnitModal && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white w-[400px] p-6 rounded-2xl shadow-2xl relative">
                      <button
                        onClick={this.toggleUnitModal}
                        className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <h3 className="text-lg font-bold mb-4">Cấu hình đơn vị</h3>

                      {units.map((u) => (
                        <div key={u.id} className="mb-4 border-b pb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={u.isBase}
                              onChange={(e) => {
                                // chỉ 1 đơn vị cơ bản
                                const checked = e.target.checked;
                                this.setState((prev) => ({
                                  units: prev.units.map((x) => ({
                                    ...x,
                                    isBase: x.id === u.id ? checked : false,
                                  })),
                                }));
                              }}
                            />
                            <Input
                              value={u.name}
                              onChange={(e) =>
                                this.updateUnitField(u.id, "name", e.target.value)
                              }
                              placeholder="Tên đơn vị (vd: chai)"
                            />
                            {!u.isBase && (
                              <button
                                onClick={() => this.removeUnitRow(u.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {!u.isBase && (
                            <>
                              <Input
                                value={u.conversion}
                                onChange={(e) =>
                                  this.updateUnitField(
                                    u.id,
                                    "conversion",
                                    e.target.value
                                  )
                                }
                                placeholder="Giá trị quy đổi"
                                className="mb-2"
                              />
                              <div className="flex gap-2">
                                <Input
                                  value={u.price}
                                  onChange={(e) =>
                                    this.updateUnitField(
                                      u.id,
                                      "price",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Giá bán"
                                />
                                <span className="bg-gray-100 border rounded-md px-2 flex items-center text-sm">
                                  VND
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        className="w-full mb-4"
                        onClick={this.addUnitRow}
                      >
                        + Thêm đơn vị
                      </Button>

                      <div className="flex justify-end gap-3">
                        <Button
                          variant="outline"
                          className="px-5"
                          onClick={this.toggleUnitModal}
                        >
                          Hủy
                        </Button>
                        <Button
                          className="bg-[#00A8B0] text-white px-5 hover:bg-[#00929A]"
                          onClick={this.toggleUnitModal}
                        >
                          Đồng ý
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

/* ---------- Wrapper ---------- */
export default function ProductPage() {
  const navigate = useNavigate();
  return <ProductPageClass navigate={navigate} />;
}
