
import React from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import API_URL from "@/config/api";
import {
  Search, Star, Heart, Plus, LogOut,
  AlertCircle, Bell, ChevronDown, Menu, Printer, Volume2,
  Trash2, X
} from "lucide-react";

const DEBUG = true;
const tlog = (ns) => (msg, ...rest) =>
  DEBUG && console.log(`%c[${ns}]%c ${msg}`, "color:#22d3ee;font-weight:700", "color:inherit", ...rest);
const logApp   = tlog("APP");
const logAuth  = tlog("AUTH");
const logCats  = tlog("CATEGORIES");
const logUnits = tlog("UNITS");
const logProd  = tlog("PRODUCTS");
const logCart  = tlog("CART");

const fmt = new Intl.NumberFormat("vi-VN");

const IconBtn = ({ children, title, ...props }) => (
  <button
    title={title}
    className="w-9 h-9 grid place-items-center rounded-full text-white/90 hover:text-white hover:bg-white/10 transition"
    {...props}
  >
    {children}
  </button>
);

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

class OrdersPageClass extends React.Component {
  state = {
    invoices: [{ id: 1, orders: [] }],
    activeIdx: 0,

    categories: [],
    catError: "",
    loading: false,

    activeTab: "all",
    productsByTab: {}, // tabValue: { items, loading, error }
    search: "",

    shopId: null,
    authErr: "",

    unitsByPid: {},

        customerSearch: "",
    foundCustomer: null,
    loadingCustomer: false,
    showAddCustomer: false,
    addingCustomer: {
      fullName: "",
      phone: "",
      email: "",
      gender: 0,
      birthday: "",
    },

    customerSuggestions: [],
     
  };

  mounted = false;

  /* ===================== LIFECYCLE ===================== */
  componentDidMount() {
    this.mounted = true;
    logApp("OrdersPage mounted");

if (localStorage.getItem("resetCustomer") === "1") {
    this.clearCustomer();
    localStorage.removeItem("resetCustomer");
  }
    const token = localStorage.getItem("accessToken");
    if (!token) return this.props.navigate("/");

    let profile = null;
    try {
      profile =
        JSON.parse(localStorage.getItem("userProfile") || "null") ||
        JSON.parse(localStorage.getItem("auth") || "null")?.profile ||
        null;
    } catch {}
    const sId = Number(profile?.shopId);
    if (!sId) {
      this.setState({ authErr: "Không tìm thấy shopId trong hồ sơ người dùng." });
      return;
    }
    
    const saved = localStorage.getItem("selectedCustomer");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.setState({ foundCustomer: parsed, customerSearch: parsed.phone });
      } catch {}
    }

    this.setState({ shopId: sId }, () => {
      this.fetchUnitsAllByShop();
      this.fetchCategories();
    });
  }

  componentWillUnmount() {
    this.mounted = false;
    logApp("OrdersPage unmounted");
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

  /* ===================== UTILS ===================== */
  safeParse = async (res) => {
    try { return await res.json(); }
    catch {
      const text = await res.text().catch(() => "");
      try { return JSON.parse(text); } catch { return { raw: text }; }
    }
  };
// ===== DEBUG HELPERS & VALIDATION =====
validateCartLines = (orders = []) => {
  const issues = [];
  orders.forEach((o, i) => {
    const pid  = Number(o?.id || 0);
    const puid = Number(o?.productUnitId ?? o?.unitOptions?.[0]?.productUnitId ?? 0);
    const qty  = Number(o?.qty || 0);
    if (!pid)  issues.push({ idx: i, reason: "Missing productId", line: o });
    if (!puid) issues.push({ idx: i, reason: "Missing productUnitId", line: o });
    if (!qty)  issues.push({ idx: i, reason: "Quantity = 0", line: o });
  });
  return issues;
};

logCartMap = (orders = [], orderDetails = []) => {
  console.groupCollapsed("%c[CART→PAYLOAD] Map lines", "color:#22d3ee;font-weight:700");
  console.table(
    orders.map((o, i) => ({
      idx: i,
      name: o.name,
      productId: o.id,
      productUnitId: o.productUnitId,
      unitOptions0: o.unitOptions?.[0]?.productUnitId ?? null,
      qty: o.qty,
      price: o.price,
    }))
  );
  console.table(orderDetails.map((d, i) => ({ idx: i, ...d })));
  console.groupEnd();
};

  /* ===================== FETCH CATALOG ===================== */
  fetchCategories = async () => {
    if (!this.state.shopId) return;
    const token = localStorage.getItem("accessToken");
    const controller = new AbortController();

    logCats("Fetch categories start");
    const t0 = performance.now();
    this.setState({ loading: true, catError: "" });

    try {
      const url = `${API_URL}/api/products?page=1&pageSize=500`;
      const res = await fetch(url, {
        headers: { accept: "application/json, text/plain, */*", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        mode: "cors",
        signal: controller.signal,
      });
      const data = await this.safeParse(res);
      logCats("GET /api/products -> status", res.status, res.ok);

      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const items = Array.isArray(data?.items) ? data.items : [];
      logCats("Products raw.items length", items.length);

      const byShop = items
        .filter((p) => Number(p.shopId) === Number(this.state.shopId))
        .filter((p) => Number(p.status) === 1);

      const map = new Map();
      for (const p of byShop) {
        const id = p.categoryId;
        const name = p.categoryName || `Danh mục ${id}`;
        if (!map.has(id)) map.set(id, { id, name, desc: "", value: `${id}-${slugify(name)}` });
      }
      const withAll = [{ id: "all", name: "Tất cả", desc: "", value: "all" }, ...Array.from(map.values())];

      if (!this.mounted) return;
      this.setState({ categories: withAll, activeTab: "all" });
      logCats("Derived category count", withAll.length, withAll);
    } catch (e) {
      if (!this.mounted) return;
      const msg = String(e).includes("Failed to fetch") ? "Không gọi được API (CORS/mạng?)." : `Lỗi tải danh mục: ${e.message || e}`;
      this.setState({ catError: msg });
      logCats("ERROR", msg);
    } finally {
      if (!this.mounted) return;
      this.setState({ loading: false });
      logCats("Done in", Math.round(performance.now() - t0), "ms");
    }

    return () => controller.abort();
  };

  fetchUnitsAllByShop = async () => {
    if (!this.state.shopId) return;
    const token = localStorage.getItem("accessToken");

    try {
      logUnits("Fetch units (all by shop) start", { shopId: this.state.shopId });
      const url = `${API_URL}/api/product-units?ShopId=${this.state.shopId}&page=1&pageSize=5000`;
      const res = await fetch(url, {
        headers: { accept: "application/json, text/plain, */*", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        mode: "cors",
      });
      const data = await this.safeParse(res);
      logUnits("GET /api/product-units -> status", res.status, res.ok);

      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const items = Array.isArray(data?.items) ? data.items : [];
      logUnits("units.items length", items.length);

      const byPid = new Map();
      for (const it of items) {
        const pid = Number(it.productId);
        if (!byPid.has(pid)) byPid.set(pid, []);
        byPid.get(pid).push(it);
      }

      const unitsByPid = {};
      byPid.forEach((rows, pid) => {
        const base = pickBaseUnit(rows);
        const sorted = base ? [base, ...rows.filter(r => r !== base)] : rows;
        unitsByPid[pid] = sorted.map(u => ({
          productUnitId: Number(u.productUnitId),
          unitName: u.unitName,
          price: Number(u.price ?? 0),
          conversionFactor: Number(u.conversionFactor ?? 1),
        }));
      });

      if (this.mounted) {
        this.setState({ unitsByPid }, () => {
          logUnits("unitsByPid cached keys", Object.keys(this.state.unitsByPid).length);
          this.ensureProducts(this.state.activeTab, true);
        });
      }
    } catch (e) {
      logUnits("failed", e);
    }
  };

  ensureUnitsForProduct = async (productId) => {
    if (this.state.unitsByPid[productId]?.length) return;
    const token = localStorage.getItem("accessToken");
    try {
      const url = `${API_URL}/api/product-units?ShopId=${this.state.shopId}&ProductId=${productId}&page=1&pageSize=500`;
      const res = await fetch(url, {
        headers: { accept: "application/json, text/plain, */*", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        mode: "cors",
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      const rows = Array.isArray(data?.items) ? data.items : [];
      const sorted = (() => {
        const base = pickBaseUnit(rows);
        return base ? [base, ...rows.filter(r => r !== base)] : rows;
      })();
      const mapped = sorted.map(u => ({
        productUnitId: Number(u.productUnitId),
        unitName: u.unitName,
        price: Number(u.price ?? 0),
        conversionFactor: Number(u.conversionFactor ?? 1),
      }));
      this.setState((prev) => ({
        unitsByPid: { ...prev.unitsByPid, [productId]: mapped }
      }), () => logUnits("unitsByPid added product", productId, this.state.unitsByPid[productId]));
    } catch (e) {
      logUnits("ensureUnitsForProduct failed", productId, e);
    }
  };

  /* ===================== PRODUCTS CACHE ===================== */
  ensureProducts = async (tabValue, force = false) => {
    const entry = this.state.productsByTab[tabValue];
    const shouldSkip = entry?.items?.length || entry?.loading;
    logProd("ensureProducts", { tabValue, hasCached: !!entry?.items?.length, loading: !!entry?.loading, force });
    if (shouldSkip && !force) return;
    await this.loadProductsFor(tabValue);
  };

  loadProductsFor = async (tabValue) => {
    if (!this.state.shopId) return;
    const token = localStorage.getItem("accessToken");
    const category = this.state.categories.find((c) => c.value === tabValue);
    const categoryId = category && category.id !== "all" ? Number(category.id) : null;

    this.setState((prev) => ({
      productsByTab: { ...prev.productsByTab, [tabValue]: { items: [], loading: true, error: "" } },
    }));

    try {
      logProd("loadProductsFor", { tabValue, categoryId });
      const url = `${API_URL}/api/products?page=1&pageSize=500`;
      const res = await fetch(url, {
        headers: { accept: "*/*", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        mode: "cors",
      });
      const data = await this.safeParse(res);
      logProd("GET /api/products -> status", res.status, res.ok);

      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const raw = Array.isArray(data?.items) ? data.items : [];
      logProd("raw items length", raw.length);

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
            price: base ? base.price : (p.price ?? 0),
            unit: base ? base.unitName : "—",
            productUnitId: base ? base.productUnitId : undefined,
            unitOptions: unitRows,
            img: p.productImageURL || "https://via.placeholder.com/150",
          };
        });

      logProd("filtered items length", filtered.length);

      this.setState((prev) => ({
        productsByTab: { ...prev.productsByTab, [tabValue]: { items: filtered, loading: false, error: "" } },
      }));
    } catch (e) {
      const errorMsg = String(e).includes("Failed to fetch")
        ? "Không gọi được API sản phẩm."
        : `Lỗi tải sản phẩm: ${e.message || e}`;
      this.setState((prev) => ({
        productsByTab: { ...prev.productsByTab, [tabValue]: { items: [], loading: false, error: errorMsg } },
      }));
      logProd("ERROR", errorMsg);
    }
  };

  /* ===================== CART OPS ===================== */
  setSearch = (v) => this.setState({ search: v });
  setActiveTab = (v) => this.setState({ activeTab: v });
  setActiveIdx = (i) => this.setState({ activeIdx: i });

  getFiltered = (tabValue) => {
    const entry = this.state.productsByTab[tabValue] || { items: [] };
    if (!this.state.search.trim()) return entry.items;
    const q = normalize(this.state.search);
    const result = (entry.items || []).filter((it) => normalize(it.name).includes(q));
    logProd("filter", { tabValue, query: this.state.search, resultCount: result.length });
    return result;
  };

  newInvoice = () => {
    const ids = this.state.invoices.map((x) => x.id);
    logCart("newInvoice BEFORE", ids);
    this.setState(
      (prev) => ({
        invoices: [...prev.invoices, { id: prev.invoices[prev.invoices.length - 1].id + 1, orders: [] }],
        activeIdx: prev.activeIdx + 1,
      }),
      () => logCart("newInvoice AFTER", this.state.invoices.map((x) => x.id), "activeIdx", this.state.activeIdx)
    );
  };

  closeInvoice = (idx) => {
    logCart("closeInvoice", { idx, activeIdx: this.state.activeIdx, ids: this.state.invoices.map(x => x.id) });
    this.setState((prev) => {
      if (prev.invoices.length === 1) {
        logCart("closeInvoice aborted (only 1 invoice)");
        return null;
      }
      const copy = prev.invoices.filter((_, i) => i !== idx);
      let nextActive = prev.activeIdx;
      if (idx < prev.activeIdx) nextActive = prev.activeIdx - 1;
      else if (idx === prev.activeIdx) nextActive = Math.max(0, idx - 1);
      return { invoices: copy, activeIdx: nextActive };
    });
  };

  getActiveOrders = () => this.state.invoices[this.state.activeIdx]?.orders || [];

  setOrdersForActive = (updater) => {
    this.setState((prev) => {
      const cur = prev.invoices[prev.activeIdx]?.orders || [];
      const nextOrders = typeof updater === "function" ? updater(cur) : updater;
      const copy = [...prev.invoices];
      copy[prev.activeIdx] = { ...copy[prev.activeIdx], orders: nextOrders };
      return { invoices: copy };
    });
  };

  addToOrder = async (p) => {
    logCart("addToOrder", p);
    if (!p.unitOptions?.length) {
      await this.ensureUnitsForProduct(p.id);
      const unitRows = this.state.unitsByPid[p.id] || [];
      if (unitRows.length) {
        const base = unitRows[0];
        p = {
          ...p,
          unitOptions: unitRows,
          unit: base.unitName,
          price: base.price,
          productUnitId: base.productUnitId,
        };
      }
    }

    this.setOrdersForActive((prev) => {
      const i = prev.findIndex((x) => x.id === p.id && x.productUnitId === p.productUnitId);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
        logCart("inc qty existing line", { index: i, after: copy[i] });
        return copy;
      }
      const next = [...prev, { ...p, qty: 1, note: "" }];
      logCart("push item", next[next.length - 1]);
      return next;
    });
  };

  removeItem = (idx) => {
    const orders = this.getActiveOrders();
    logCart("removeItem", { idx, item: orders[idx] });
    this.setOrdersForActive((prev) => prev.filter((_, i) => i !== idx));
  };

  updateNote = (i, v) => {
    logCart("updateNote", { index: i, value: v });
    const orders = this.getActiveOrders();
    const next = [...orders];
    next[i] = { ...next[i], note: v };
    this.setOrdersForActive(next);
  };

  setQty = (idx, nextVal) => {
    const normalized = Math.max(1, Number.isFinite(+nextVal) ? Math.floor(+nextVal) : 1);
    logCart("setQty", { idx, input: nextVal, normalized });
    this.setOrdersForActive((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: normalized };
      return copy;
    });
  };

  incQty = (idx) => {
    const orders = this.getActiveOrders();
    logCart("incQty", { idx, before: orders[idx]?.qty });
    this.setQty(idx, (orders[idx]?.qty || 1) + 1);
  };

  decQty = (idx) => {
    const orders = this.getActiveOrders();
    logCart("decQty", { idx, before: orders[idx]?.qty });
    this.setQty(idx, (orders[idx]?.qty || 1) - 1);
  };

  changeOrderUnit = (idx, productUnitId) => {
    const orders = this.getActiveOrders();
    const line = orders[idx];
    if (!line?.unitOptions?.length) {
      logCart("changeOrderUnit: no unitOptions on line", idx);
      return;
    }
    const picked = line.unitOptions.find(u => Number(u.productUnitId) === Number(productUnitId));
    if (!picked) {
      logCart("changeOrderUnit: unit not found", { idx, productUnitId });
      return;
    }
    logCart("changeOrderUnit", { idx, productUnitId, picked });
    this.setOrdersForActive((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        productUnitId: picked.productUnitId,
        unit: picked.unitName,
        price: picked.price,
      };
      return copy;
    });
  };
    /* ========== CUSTOMER LOGIC ========== */
  searchCustomerByPhone = async (phone) => {
    const { shopId } = this.state;
    if (!shopId || !phone) return;
    const token = localStorage.getItem("accessToken");

    this.setState({ loadingCustomer: true, customerSuggestions: [] });

    try {
      const url = `${API_URL}/api/customers?ShopId=${shopId}`;
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || "API error");

      const items = Array.isArray(data.items) ? data.items : [];
      const suggestions = items.filter((c) =>
        String(c.phone || "").startsWith(String(phone).trim())
      );

      if (this.mounted) this.setState({ customerSuggestions: suggestions });
    } catch (e) {
      console.error("Search customer error:", e);
    } finally {
      if (this.mounted) this.setState({ loadingCustomer: false });
    }
  };

  handleSelectCustomer = (c) => {
    this.setState({
      foundCustomer: c,
      customerSearch: c.phone,
      customerSuggestions: [],
    });
    localStorage.setItem("selectedCustomer", JSON.stringify(c));
  };

  clearCustomer = () => {
  localStorage.removeItem("selectedCustomer");
  this.setState({
    selectedCustomer: null,
    foundCustomer: null,
    customerSearch: "",
    customerId: null,
  });
};


  createCustomer = async () => {
    const { shopId, addingCustomer } = this.state;
    const token = localStorage.getItem("accessToken");
    if (!addingCustomer.fullName || !addingCustomer.phone)
      return alert("Vui lòng nhập đủ họ tên và số điện thoại");

    try {
      const payload = {
        ...addingCustomer,
        shopId,
        spent: 0,
        status: 1,
        rankid: "1",
        rankName: "Đồng",
      };

      const res = await fetch(`${API_URL}/api/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await this.safeParse(res);
      if (!res.ok) throw new Error(data?.message || "Lỗi tạo khách hàng");

      this.setState({
        foundCustomer: data,
        showAddCustomer: false,
        customerSearch: data.phone,
      });
    } catch (e) {
      alert(e.message);
    }
  };


  /* ===================== AUTH / MISC ===================== */
  logout = () => {
    logAuth("logout");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userProfile");
    localStorage.removeItem("auth");
    this.props.navigate("/");
  };

 //ORDER API
  buildOrderPayload = () => {
  // shopId từ profile
  let profile = null;
  try {
    profile =
      JSON.parse(localStorage.getItem("userProfile") || "null") ||
      JSON.parse(localStorage.getItem("auth") || "null")?.profile || null;
  } catch {}
  const shopId = Number(profile?.shopId || 0) || null;

  // shiftId từ auth/currentShift
  let shiftId = null;
  try {
    const auth = JSON.parse(localStorage.getItem("auth") || "null");
    if (auth?.currentShift?.shiftId != null) shiftId = Number(auth.currentShift.shiftId);
    if (!shiftId && auth?.shiftId != null)   shiftId = Number(auth.shiftId);
  } catch {}
  if (!shiftId) {
    const cur = JSON.parse(localStorage.getItem("currentShift") || "null");
    if (cur?.shiftId != null) shiftId = Number(cur.shiftId);
  }

  const orders = this.state.invoices[this.state.activeIdx]?.orders || [];

  const issues = this.validateCartLines(orders);
  if (issues.length) {
    console.group("%c[CART] Validation issues", "color:#ef4444;font-weight:700");
    console.table(issues.map(x => ({ idx: x.idx, reason: x.reason, name: x.line?.name })));
    console.groupEnd();
  }

  // Map có fallback productUnitId
  const mapped = orders.map((it, idx) => {
    const pid  = Number(it.id || 0);
    const puid = Number(it.productUnitId ?? it.unitOptions?.[0]?.productUnitId ?? 0);
    const qty  = Number(it.qty || 0);
    return {
      __debug: { idx, name: it.name }, 
      quantity: qty,
      productUnitId: puid,
      productId: pid,
    };
  });

  const orderDetails = mapped.filter(d => d.productId > 0 && d.productUnitId > 0 && d.quantity > 0);

  if (orderDetails.length !== orders.length) {
    const dropped = mapped
      .map((d, i) => ({ i, ok: d.productId > 0 && d.productUnitId > 0 && d.quantity > 0, name: d.__debug.name }))
      .filter(x => !x.ok);
    console.warn("[CART] Dropped invalid lines:", dropped);
  }

  this.logCartMap(orders, orderDetails);

  const payload = {
    customerId: this.state.foundCustomer?.customerId ?? null,                       // Khách lẻ
    paymentMethod: this.state.payMethodId || 1, // tạm tiền mặt
    status: 0,                              // chờ thanh toán
    shiftId: shiftId ?? null,               // từ auth
    shopId,                                 // từ profile
    voucherId: null,
    discount: null,
    note: "",
    orderDetails,
  };

  console.groupCollapsed("%c[BUILD] Final payload /api/orders", "color:#22c55e;font-weight:700");
  console.log(payload);
  console.groupEnd();

  return payload;
};


submitOrder = async () => {
  this.setState({ loading: true, error: "" });

  const token = localStorage.getItem("accessToken") || "";
  const payload = this.buildOrderPayload();

  try {
    console.groupCollapsed("%c[POST] /api/orders request", "color:#06b6d4;font-weight:700");
    console.log("Headers: {Content-Type: application/json, Authorization: Bearer ...}");
    console.log("Body:", JSON.stringify(payload, null, 2));
    console.groupEnd();

    const res = await fetch(`${API_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json, text/plain, */*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      mode: "cors",
      body: JSON.stringify(payload),
    });

    const data = await this.safeParse(res);

    console.groupCollapsed("%c[POST] /api/orders response", "color:#ea580c;font-weight:700");
    console.log("status:", res.status, res.ok);
    console.log("body:", data);
    console.groupEnd();

    if (!res.ok) {
      if (data?.errors) {
        console.warn("[POST] validation errors:", data.errors);
      }
      throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    }

    const orderId = data?.orderId ?? data?.id ?? data?.data?.orderId ?? 0;
    const currentOrders = this.getActiveOrders();

    this.props.navigate("/payment", {
      state: {
        orderId,
        customerId: payload.customerId ?? null,
        note: payload.note || "",
        paymentMethod: payload.paymentMethod ?? 1,
        orders: currentOrders,
        total: currentOrders.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0),
      },
    });
    this.clearCustomer();
  } catch (e) {
    console.error("[Orders] POST /api/orders error:", e);
    this.setState({ error: e.message || "Lỗi tạo đơn hàng" });
  } finally {
    this.setState({ loading: false });
  }
};



  /* ===================== RENDER ===================== */
  render() {
    const {
      invoices, activeIdx,
      categories, catError, loading,
      activeTab, productsByTab, search,
      shopId, authErr,
    } = this.state;

    const orders = invoices[activeIdx]?.orders || [];
    const total = orders.reduce((s, it) => s + it.price * it.qty, 0);

    return (
      <div className="h-screen w-full bg-[#012E40] border-[4px] border-[#012E40] rounded-2xl p-3">
        <div className="flex gap-[5px] bg-[#012E40] h-full">
          {/* LEFT */}
          <div className="w-1/2 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-3 mb-2">
              <button className="px-5 py-2 bg-white text-black rounded-[15px] font-semibold -ml-4">Bán hàng</button>
              <div className="relative w-1/2 ml-[4px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#DCDCDC]" />
                <Input
                  value={search}
                  onChange={(e) => this.setSearch(e.target.value)}
                  placeholder="Tìm món"
                  className="pl-10 rounded-[15px] bg-[#00A8B0]/75 text-[#DCDCDC] placeholder-[#DCDCDC] border-0 focus:ring-0"
                />
              </div>
            </div>

            <div className="flex-1 bg-white rounded-xl min-h-0 flex flex-col">
              {!shopId ? (
                <div className="p-4 text-sm text-red-600">{authErr || "Chưa xác định được shopId."}</div>
              ) : !categories.length ? (
                <div className="p-4 text-sm">
                  {catError ? (
                    <div className="flex items-center justify-between">
                      <span className="text-red-600">{catError}</span>
                      <Button size="sm" variant="outline" onClick={() => this.fetchCategories()}>Thử lại</Button>
                    </div>
                  ) : (
                    <span className="text-gray-500">{loading ? "Đang tải danh mục…" : "Không có danh mục"}</span>
                  )}
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={(v) => this.setActiveTab(v)} className="flex flex-col h-full">
                  <div className="sticky top-0 z-10 bg-white">
                    <TabsList className="flex items-center gap-10 px-6 bg-white border-b overflow-x-auto rounded-tl-xl rounded-tr-xl">
                      {categories.map((c) => (
                        <TabsTrigger
                          key={c.id}
                          value={c.value}
                          className="
                            px-0 py-3
                            font-medium
                            text-gray-500 hover:text-gray-700
                            data-[state=active]:text-[#00A8B0]
                            rounded-none shadow-none focus-visible:ring-0
                          "
                        >
                          {c.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {categories.map((c) => {
                      const entry = productsByTab[c.value] || { items: [], loading: false, error: "" };
                      const list = c.id === "all" ? (entry.items?.length ? this.getFiltered(c.value) : []) : this.getFiltered(c.value);

                      return (
                        <TabsContent key={c.id} value={c.value} className="p-4 grid grid-cols-4 gap-4">
                          {entry.loading ? (
                            <div className="col-span-full text-sm text-gray-500">Đang tải sản phẩm…</div>
                          ) : entry.error ? (
                            <div className="col-span-full flex items-center justify-between">
                              <span className="text-red-600">{entry.error}</span>
                              <Button size="sm" variant="outline" onClick={() => this.loadProductsFor(c.value)}>Thử lại</Button>
                            </div>
                          ) : list && list.length ? (
                            list.map((p) => (
                              <Card key={`${c.id}-${p.id}`} className="relative overflow-hidden">
                                <CardContent className="p-2 flex flex-col items-center text-center">
                                  <img
                                    src={p.img}
                                    alt={p.name}
                                    className="w-full h-32 object-cover rounded-lg"
                                    onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/150"; }}
                                  />

                                  {/* Tên sản phẩm */}
                                  <h3 className="mt-2 text-sm font-semibold line-clamp-2 min-h-[2.5rem]">
                                    {p.name}
                                  </h3>

                                  {/* Giá */}
                                  <p className="text-orange-500 font-bold min-h-[1.5rem]">{fmt.format(p.price)}đ</p>

                                  {/* Đơn vị */}
                                  <div className="text-xs text-gray-500 min-h-[1rem]">
                                    Đơn vị mặc định: {p.unit || "—"}
                                  </div>

                                  {/* Đánh giá + Add */}
                                  <div className="flex items-center justify-between w-full mt-2">
                                    <div className="flex items-center text-yellow-500 text-xs">
                                      <Star size={14} fill="currentColor" /> 4.5
                                    </div>
                                    <Button size="sm" onClick={() => this.addToOrder(p)}>Add</Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          ) : (
                            <div className="col-span-full text-sm text-gray-500">
                              {c.id === "all" ? "Chưa có sản phẩm." : `Chưa có sản phẩm cho “${c.name}”.`}
                            </div>
                          )}
                        </TabsContent>
                      );
                    })}
                  </div>
                </Tabs>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="w-1/2 flex flex-col">
            <div className="mb-2 rounded-t-2xl bg-[#07323b] px-3 sm:px-4 py-2 flex items-center justify-between ">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pr-2 custom-scrollbar">
                {invoices.map((inv, i) => {
                  const active = i === activeIdx;
                  return (
                    <div key={inv.id} className="flex items-center">
                      <button
                        onClick={() => this.setActiveIdx(i)}
                        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition
                          ${active ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"}`}
                        title={`Chuyển tới hóa đơn #${String(inv.id).padStart(4, "0")}`}
                      >
                        {`Hóa đơn #${String(inv.id).padStart(4, "0")}`}
                      </button>
                      {invoices.length > 1 && (
                        <button
                          onClick={() => this.closeInvoice(i)}
                          className="ml-1 px-2 py-1 rounded-full text-white/80 hover:bg-white/10"
                          title="Đóng hóa đơn"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={this.newInvoice}
                  title="Hóa đơn mới"
                  className="ml-1 w-9 h-9 rounded-full bg-[#00A8B0] text-white grid place-items-center hover:opacity-90 shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <IconBtn title="Âm lượng"><Volume2 className="w-5 h-5" /></IconBtn>
                <IconBtn title="Cảnh báo"><AlertCircle className="w-5 h-5" /></IconBtn>
                <IconBtn title="In hoá đơn"><Printer className="w-5 h-5" /></IconBtn>
                <IconBtn title="Thông báo"><Bell className="w-5 h-5" /></IconBtn>
                <div className="ml-1 flex items-center">
                  <button className="px-2.5 h-9 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-semibold">VN</button>
                  <button className="w-8 h-9 grid place-items-center text-white/90 hover:text-white">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <IconBtn
                  title="Menu"
                  onClick={() => this.props.navigate("/products")}
                >
                  <Menu className="w-6 h-6" />
                </IconBtn>
                <IconBtn title="Đăng xuất" onClick={this.logout}><LogOut className="w-5 h-5" /></IconBtn>
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-white rounded-xl overflow-hidden">
              {/* === THANH KHÁCH HÀNG FULL WIDTH === */}
<div className="flex items-center gap-3 w-full px-6 py-2 bg-white">
  {/* Icon KH */}
  <div className="w-8 h-8 rounded-md bg-[#EAF7F8] grid place-items-center text-[#0c5e64] text-[10px] font-bold">
    KH
  </div>

  {/* Thông tin KH */}
  <div className="flex items-center gap-2 flex-1 min-w-0">
    {this.state.foundCustomer ? (
      <div className="flex flex-col leading-tight truncate">
        <div className="flex items-center gap-1 truncate">
          <span className="font-semibold text-[#0c5e64] text-sm truncate">
            {this.state.foundCustomer.fullName}
          </span>
          {this.state.foundCustomer.rankName && (
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#00A8B0]/10 text-[#00A8B0] font-medium whitespace-nowrap">
              {this.state.foundCustomer.rankName}
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-500 truncate flex items-center gap-1">
          <span className="text-pink-500 text-xs">📞</span>
          {this.state.foundCustomer.phone}
        </span>
      </div>
    ) : (
      <span className="text-[#0c5e64] font-semibold text-sm">Khách lẻ</span>
    )}
  </div>

  {/* Ô tìm kiếm + nút bên phải */}
  <div className="flex items-center gap-2 w-[55%] justify-end">
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
      <Input
        placeholder="Nhập SĐT khác"
        className="h-9 w-full rounded-full pl-9 pr-4 border border-gray-300 focus:border-[#00A8B0] focus-visible:ring-0 text-sm shadow-none"
        value={this.state.customerSearch}
        onChange={(e) => {
          const v = e.target.value;
          this.setState({ customerSearch: v });
          if (v.length >= 5) this.searchCustomerByPhone(v);
          else this.setState({ customerSuggestions: [] });
        }}
      />

      {/* Dropdown gợi ý khách hàng */}
      {this.state.customerSuggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-md max-h-48 overflow-y-auto">
          {this.state.customerSuggestions.map((c) => (
            <div
              key={c.customerId}
              onClick={() => this.handleSelectCustomer(c)}
              className="px-3 py-2 hover:bg-[#E6FFFA] cursor-pointer text-sm"
            >
              <div className="font-semibold text-gray-800">{c.fullName}</div>
              <div className="text-xs text-gray-500">📞 {c.phone}</div>
              {c.rankName && (
                <div className="text-xs text-[#00A8B0]">{c.rankName}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    {this.state.foundCustomer ? (
      <Button
        variant="outline"
        className="h-9 px-4 border-red-400 text-red-500 hover:bg-red-50 flex items-center justify-center rounded-full whitespace-nowrap"
        onClick={this.clearCustomer}
      >
        <X className="w-4 h-4 mr-1" /> Bỏ
      </Button>
    ) : (
      <Button
        className="h-9 px-4 bg-[#00A8B0] text-white rounded-full hover:bg-[#00939a] flex items-center justify-center whitespace-nowrap"
        onClick={() =>
          this.setState({
            showAddCustomer: true,
            addingCustomer: {
              ...this.state.addingCustomer,
              phone: this.state.customerSearch,
            },
          })
        }
      >
        <Plus className="w-4 h-4 mr-1" /> Thêm
      </Button>
    )}
  </div>
</div>


              <div className="px-5 py-2 text-sm text-gray-700 font-semibold border-b">
                <div className="grid grid-cols-[1fr_110px_150px_120px_150px_40px]">
                  <span>Sản phẩm</span>
                  <span className="text-center">Đơn giá</span>
                  <span className="text-center">Đơn vị</span>
                  <span className="text-center">Số lượng</span>
                  <span className="text-right">Thành tiền</span>
                  <span className="text-center"></span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 ghost-scrollbar">
                {orders.length === 0 ? (
                  <div className="text-center text-gray-500 py-16">Chưa có sản phẩm trong đơn hàng</div>
                ) : (
                  orders.map((o, i) => {
                    const line = o.price * o.qty;
                    return (
                      <div key={`${o.id}-${o.productUnitId || "base"}-${i}`}>
                        <div className="grid items-center grid-cols-[1fr_110px_150px_120px_150px_40px]">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 font-medium">{i + 1}.</span>
                            <span className="font-semibold">{o.name}</span>
                          </div>

                          <div className="text-center">{fmt.format(o.price)}</div>

                          <div className="flex justify-center">
                            <select
                              className="h-8 px-2 border rounded-md text-sm"
                              value={o.productUnitId ?? (o.unitOptions?.[0]?.productUnitId || "")}
                              onChange={(e) => this.changeOrderUnit(i, Number(e.target.value))}
                            >
                              {(o.unitOptions || [{ productUnitId: o.productUnitId, unitName: o.unit, price: o.price }]).map(u => (
                                <option key={u.productUnitId} value={u.productUnitId}>
                                  {u.unitName}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => this.decQty(i)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 font-bold">−</button>
                            <input
                              value={o.qty}
                              onChange={(e) => {
                                const v = e.target.value.replace(/\D+/g, "");
                                this.setQty(i, v || 1);
                              }}
                              className="w-16 h-7 text-center border rounded-md"
                              inputMode="numeric"
                              pattern="[0-9]*"
                            />
                            <button onClick={() => this.incQty(i)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 font-bold">+</button>
                          </div>

                          <div className="text-right font-bold">{fmt.format(line)} VND</div>

                          <div className="flex justify-center">
                            <button
                              onClick={() => this.removeItem(i)}
                              className="w-8 h-8 rounded-full grid place-items-center text-red-600 hover:bg-red-50"
                              title="Xóa sản phẩm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <Input
                          placeholder="Ghi chú"
                          value={o.note || ""}
                          onChange={(e) => this.updateNote(i, e.target.value)}
                          className="mt-2 h-8 text-sm rounded-full bg-[#F3F4F6] border"
                        />
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t px-6 py-3">
                <div className="flex items-center justify-end gap-2 text-base">
                  <span className="text-gray-700">Tổng cộng</span>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#00A8B0] text-white">$</span>
                  <span className="font-bold">{fmt.format(total)} VND</span>
                </div>
                <div className="pt-3 flex items-center gap-4">
                  <Button variant="outline" className="rounded-xl border-[#00A8B0] text-[#00A8B0] w-[220px]">
                    Thông báo
                  </Button>
                  <Button
  className="rounded-xl bg-[#00A8B0] flex-1"
  onClick={this.submitOrder}
  disabled={(this.state.invoices[this.state.activeIdx]?.orders?.length ?? 0) === 0}
>
  Thanh toán
</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* MODAL THÊM KHÁCH HÀNG */}
{this.state.showAddCustomer && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-xl w-[400px] shadow-2xl">
      <h3 className="text-lg font-bold mb-4 text-[#007E85]">
        ➕ Thêm khách hàng mới
      </h3>
      <div className="space-y-3">
        <Input
          placeholder="Họ tên"
          value={this.state.addingCustomer.fullName}
          onChange={(e) =>
            this.setState({
              addingCustomer: {
                ...this.state.addingCustomer,
                fullName: e.target.value,
              },
            })
          }
        />
        <Input
          placeholder="Số điện thoại"
          value={this.state.addingCustomer.phone}
          readOnly
        />
        <Input
          placeholder="Email"
          value={this.state.addingCustomer.email}
          onChange={(e) =>
            this.setState({
              addingCustomer: {
                ...this.state.addingCustomer,
                email: e.target.value,
              },
            })
          }
        />
      </div>

      <div className="flex justify-end gap-3 mt-5">
        <Button
          variant="outline"
          onClick={() => this.setState({ showAddCustomer: false })}
        >
          Hủy
        </Button>
        <Button
          className="bg-[#00A8B0] text-white"
          onClick={this.createCustomer}
        >
          Lưu
        </Button>
      </div>
    </div>
  </div>
)}

      </div>
    );
  }
}

/* ---------- Wrapper để dùng navigate (React Router v6) ---------- */
export default function OrdersPage() {
  const navigate = useNavigate();
  return <OrdersPageClass navigate={navigate} />;
}
