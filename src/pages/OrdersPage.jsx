// src/pages/OrdersPage.jsx
import React, { Component } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import API_URL from "@/config/api";
import { Search, Star, Heart, Plus } from "lucide-react";

const DEBUG = true; // ← bật/tắt log ở đây
const tag = (s) => `%c[Orders]%c ${s}`;
const c1 = "color:#0ea5e9;font-weight:700";
const c2 = "color:inherit";

// helper log
const dlog = (...a) => DEBUG && console.log(...a);
const dgroup = (title, fn) => {
  if (!DEBUG) return fn?.();
  console.groupCollapsed(tag(title), c1, c2);
  try { fn?.(); } finally { console.groupEnd(); }
};

const sampleProducts = [
  { id: 1, name: "Cà phê sữa", price: 30000, img: "https://via.placeholder.com/150" },
  { id: 2, name: "Cà phê đen", price: 25000, img: "https://via.placeholder.com/150" },
  { id: 3, name: "Bạc sỉu", price: 35000, img: "https://via.placeholder.com/150" },
  { id: 4, name: "Latte", price: 50000, img: "https://via.placeholder.com/150" },
];

const fmt = new Intl.NumberFormat("vi-VN");
const slugify = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default class OrdersPage extends Component {
  state = {
    orders: [],
    invoiceNo: 1,
    categories: [],
    catLoading: false,
    catError: "",
    activeTab: "",
  };

  _unmounted = false;
  _didFetch = false;

  componentDidMount() {
    dlog(tag("componentDidMount"), c1, c2, { API_URL });
    if (!this._didFetch) {
      this._didFetch = true;
      this.fetchCategories();
    }
  }
  componentWillUnmount() { this._unmounted = true; }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.categories !== this.state.categories) {
      dlog(tag("categories updated"), c1, c2, {
        count: this.state.categories.length,
        first: this.state.categories[0],
      });
    }
    if (prevState.activeTab !== this.state.activeTab) {
      dlog(tag("activeTab changed"), c1, c2, {
        from: prevState.activeTab, to: this.state.activeTab
      });
    }
  }

  safeSet = (u) => { if (!this._unmounted) this.setState(u); };

  // ===== API: Categories =====
  fetchCategories = async () => {
    const t0 = performance.now();
    this.safeSet({ catLoading: true, catError: "" });
    const url = `${API_URL}/api/categories?page=1&pageSize=50`;

    dgroup("FETCH /api/categories", async () => {
      dlog("→ url:", url);

      try {
        const res = await fetch(url, { headers: { accept: "text/plain" }, mode: "cors" });
        dlog("← status:", res.status, "| CORS:", res.headers.get("access-control-allow-origin"));

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        let data;
        try {
          data = await res.json();
          dlog("✓ parsed as JSON");
        } catch {
          const text = await res.text();
          data = JSON.parse(text || "{}");
          dlog("✓ parsed from text/plain");
        }

        const items = Array.isArray(data?.items) ? data.items : [];
        dlog("items length:", items.length);
        if (DEBUG && items.length) console.table(items);

        const mapped = items.map((it) => ({
          id: it.categoryId,
          name: it.categoryName,
          desc: it.description,
          value: `${it.categoryId}-${slugify(it.categoryName)}`,
        }));

        dlog("mapped length:", mapped.length);
        if (DEBUG && mapped.length) console.table(mapped);

        const withAll = [{ id: "all", name: "Tất cả", desc: "Tất cả sản phẩm", value: "all" }, ...mapped];

        this.safeSet((prev) => {
          const next = {
            categories: withAll,
            activeTab: prev.activeTab || "all",
            catLoading: false,
          };
          dlog("setState(categories):", {
            count: next.categories.length,
            activeTab: next.activeTab,
          });
          return next;
        });
      } catch (err) {
        const msg = String(err)?.includes("Failed to fetch")
          ? "Không gọi được API. Có thể BE chưa bật CORS cho http://localhost:5173."
          : `Lỗi tải danh mục: ${err.message || err}`;
        this.safeSet({ catError: msg, catLoading: false });
        console.error("[Orders] fetchCategories error:", err);
      } finally {
        dlog("⏱ fetchCategories took:", Math.round(performance.now() - t0), "ms");
      }
    });
  };

  // ===== ORDER actions =====
  addToOrder = (p) => {
    dlog(tag("addToOrder"), c1, c2, p);
    this.setState((prev) => {
      const orders = [...prev.orders];
      const i = orders.findIndex((x) => x.id === p.id);
      if (i >= 0) orders[i] = { ...orders[i], qty: orders[i].qty + 1 };
      else orders.push({ ...p, qty: 1, note: "" });
      return { orders };
    });
  };
  updateNote = (idx, v) => {
    dlog(tag("updateNote"), c1, c2, { idx, v });
    this.setState((prev) => {
      const orders = [...prev.orders];
      orders[idx] = { ...orders[idx], note: v };
      return { orders };
    });
  };
  total = () => this.state.orders.reduce((s, it) => s + it.price * it.qty, 0);
  prevInvoice = () => this.setState((p) => ({ invoiceNo: Math.max(1, p.invoiceNo - 1) }));
  nextInvoice = () => this.setState((p) => ({ invoiceNo: p.invoiceNo + 1 }));
  newInvoice  = () => this.setState((p) => ({ invoiceNo: p.invoiceNo + 1, orders: [] }));

  // ===== UI: Left pane (tabs) =====
  renderLeftTabs() {
    const { categories, catError, activeTab } = this.state;

    if (categories.length === 0) {
      dlog(tag("renderLeftTabs → loading"), c1, c2, { catError });
      if (catError) return <div className="p-4 text-sm text-red-600">{catError}</div>;
      return <div className="p-4 text-sm text-gray-500">Đang tải danh mục…</div>;
    }

    const initial = activeTab || "all";
    dlog(tag("renderLeftTabs → ready"), c1, c2, {
      categories: categories.length,
      initial,
    });

    return (
      <Tabs
        defaultValue={initial}
        key={`${categories.length}-${initial}`}
        className="flex flex-col h-full"
      >
        <TabsList className="sticky top-0 z-10 bg-white px-3 py-2 border-b flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <TabsTrigger
              key={c.id}
              value={c.value}
              onClick={() => dlog(tag("tab click"), c1, c2, c)}
              className="
                rounded-full px-4 py-2 text-sm whitespace-nowrap
                text-[#0c5e64] bg-transparent border border-transparent
                hover:bg-[#EAF7F8]
                data-[state=active]:bg-[#00A8B0]
                data-[state=active]:text-white
                data-[state=active]:border-[#00A8B0]
                transition
              "
            >
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((c) => (
          <TabsContent key={c.id} value={c.value} className="p-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            {c.id === "all" ? (
              sampleProducts.map((p) => (
                <Card key={`${c.id}-${p.id}`} className="relative overflow-hidden">
                  <CardContent className="p-2 flex flex-col items-center">
                    <button className="absolute top-2 right-2 text-gray-500 hover:text-red-500"><Heart size={18} /></button>
                    <img src={p.img} alt={p.name} className="w-full h-32 object-cover rounded-lg" />
                    <h3 className="mt-2 text-sm font-semibold text-[#0c5e64]">{p.name}</h3>
                    <p className="text-orange-500 font-bold">{fmt.format(p.price)}đ</p>
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
                Chưa gắn dữ liệu sản phẩm cho danh mục “{c.name}”.
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  // ===== Main render =====
  render() {
    const { orders, invoiceNo } = this.state;

    return (
      <div className="h-screen w-full bg-[#012E40] border-[4px] border-[#012E40] rounded-2xl p-3">
        <div className="flex gap-[5px] bg-[#012E40] h-full">
          {/* LEFT - MENU */}
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 mb-2">
              <button className="px-5 py-2 bg-white text-black rounded-[15px] font-semibold -ml-4">
                Bán hàng
              </button>
              <div className="relative w-1/2 ml-[4px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#DCDCDC]" />
                <Input placeholder="Tìm món" className="pl-10 rounded-[15px] bg-[#00A8B0]/75 text-[#DCDCDC] placeholder-[#DCDCDC] border-0 focus:ring-0" />
              </div>
            </div>

            <div className="flex-1 bg-white rounded-xl overflow-hidden">
              {this.renderLeftTabs()}
            </div>
          </div>

          {/* RIGHT - ORDER */}
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="px-5 py-2 bg-white rounded-[15px] font-semibold -ml-4 shadow-sm">
                  Hóa đơn #{String(invoiceNo).padStart(4, "0")}
                </div>
                <button onClick={this.newInvoice} title="Hóa đơn mới" className="w-9 h-9 rounded-full bg-[#00A8B0] text-white grid place-items-center hover:opacity-90">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={this.prevInvoice} className="w-9 h-9 grid place-items-center rounded-full bg-white/20 text-white hover:bg-white/30">‹</button>
                <button onClick={this.nextInvoice} className="w-9 h-9 grid place-items-center rounded-full bg-white/20 text-white hover:bg-white/30">›</button>
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-white rounded-xl overflow-hidden">
              <div className="px-5 py-2 text-sm text-gray-700 font-semibold border-b">
                <div className="grid grid-cols-[1fr_110px_90px_150px]">
                  <span>Sản phẩm</span>
                  <span className="text-center">Đơn giá</span>
                  <span className="text-center">Số lượng</span>
                  <span className="text-right">Thành tiền</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {orders.length === 0 ? (
                  <div className="text-center text-gray-500 py-16">Chưa có sản phẩm trong đơn hàng</div>
                ) : (
                  orders.map((o, i) => {
                    const line = o.price * o.qty;
                    return (
                      <div key={o.id}>
                        <div className="grid items-center grid-cols-[1fr_110px_90px_150px]">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 font-medium">{i + 1}.</span>
                            <span className="font-semibold">{o.name}</span>
                          </div>
                          <div className="text-center">{fmt.format(o.price)}</div>
                          <div className="text-center">{o.qty}</div>
                          <div className="text-right font-bold">{fmt.format(line)} VND</div>
                        </div>
                        <Input
                          placeholder="Ghi chú, Thêm Topping"
                          value={o.note}
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
                  <span className="font-bold">{fmt.format(this.total())} VND</span>
                </div>
                <div className="pt-3 flex items-center gap-4">
                  <Button variant="outline" className="rounded-xl border-[#00A8B0] text-[#00A8B0] w-[220px]">Thông báo</Button>
                  <Button className="rounded-xl bg-[#00A8B0] flex-1">Thanh toán</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
