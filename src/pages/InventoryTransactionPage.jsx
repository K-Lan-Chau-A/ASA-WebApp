import React, { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Sidebar from "@/components/sidebar";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import API_URL from "@/config/api";

const fmt = new Intl.NumberFormat("vi-VN", { style: "decimal" });

const CACHE_EXPIRY = 30 * 60 * 1000;

export default function InventoryTransactionPage() {
  const [loading, setLoading] = useState(false);
  const [txns, setTxns] = useState([]);
  const [filterType, setFilterType] = useState(0); // 0: all, 1: sell, 2: import
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [productMap, setProductMap] = useState({});
  const [unitMap, setUnitMap] = useState({});

  const token = localStorage.getItem("accessToken");
  const shopId =
    JSON.parse(localStorage.getItem("userProfile") || "{}")?.shopId || 0;

  const safeParse = async (res) => {
    try {
      return await res.json();
    } catch {
      const txt = await res.text().catch(() => "");
      try {
        return JSON.parse(txt);
      } catch {
        return {};
      }
    }
  };

  const loadCache = (key) => {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { timestamp, data } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_EXPIRY) return null;
    return data;
  };

  const saveCache = (key, data) => {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  };
  const fetchProducts = async () => {
    const cached = loadCache("cachedProducts");
    if (cached) return setProductMap(cached);

    const res = await fetch(
      `${API_URL}/api/products?ShopId=${shopId}&page=1&pageSize=500`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await safeParse(res);
    const items = Array.isArray(data.items) ? data.items : [];
    const map = {};
    items.forEach((p) => (map[p.productId] = p.productName));
    setProductMap(map);
    saveCache("cachedProducts", map);
  };

  const fetchUnits = async () => {
    const cached = loadCache("cachedUnits");
    if (cached) return setUnitMap(cached);

    const res = await fetch(
      `${API_URL}/api/product-units?ShopId=${shopId}&page=1&pageSize=2000`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await safeParse(res);
    const items = Array.isArray(data.items) ? data.items : [];
    const map = {};
    items.forEach((u) => (map[u.unitId] = u.unitName));
    setUnitMap(map);
    saveCache("cachedUnits", map);
  };

  // 🧾 Load transactions
  const loadTransactions = async (targetPage = 1) => {
    if (!shopId) return;
    setLoading(true);
    try {
      const typeQuery = filterType ? `&Type=${filterType}` : "";
      const res = await fetch(
        `${API_URL}/api/inventory-transactions?ShopId=${shopId}${typeQuery}&page=${targetPage}&pageSize=15`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await safeParse(res);
      const items = Array.isArray(data.items) ? data.items : [];
      const mapped = items.map((i) => ({
        id: i.inventoryTransactionId ?? i.id,
        type: Number(i.type ?? 0),
        productId: Number(i.productId ?? 0),
        orderId: i.orderId ?? null,
        unitId: i.unitId ?? null,
        quantity: Number(i.quantity ?? 0),
        imageUrl: i.imageUrl || i.inventoryTransImageURL || "",
        price: Number(i.price ?? 0),
        createdAt: new Date(i.createdAt).toLocaleString("vi-VN"),
      }));
      setTxns(mapped);
      setPage(targetPage);
      setTotalPages(Number(data.totalPages ?? 1));
    } catch (err) {
      console.error("❌ Lỗi load:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchUnits();
    loadTransactions(1);
  }, [filterType]);

  // 🔍 Filter search
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return txns;
    return txns.filter((t) =>
      (productMap[t.productId] || "").toLowerCase().includes(s)
    );
  }, [search, txns, productMap]);

  const renderTxn = (t) => {
    const isOut = t.type === 1;
    const pname = productMap[t.productId] || `#${t.productId}`;
    const uname = t.unitId ? unitMap[t.unitId] || "" : "";

    return (
      <Card
        key={t.id}
        className="p-4 border border-gray-100 shadow-sm rounded-xl bg-white hover:shadow-md transition-all"
      >
        <div className="flex justify-between items-start">
          {/* Trái: tên sản phẩm */}
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-full grid place-items-center ${
                isOut
                  ? "bg-red-100 text-red-600"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {isOut ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{pname}</p>
              <p className="text-xs text-gray-500">
                {isOut ? "Bán hàng" : "Nhập hàng"}
                {uname ? ` • ${uname}` : ""}
                {t.orderId ? ` • Đơn #${t.orderId}` : ""}
              </p>
            </div>
          </div>

          {/* Phải: số lượng và giá */}
          <div className="text-right">
            <p
              className={`text-base font-semibold ${
                isOut ? "text-red-600" : "text-green-600"
              }`}
            >
              {isOut ? "-" : "+"}
              {t.quantity}
            </p>
            <p className="text-[#00A8B0] font-semibold text-sm">
              {fmt.format(t.price)} đ
            </p>
          </div>
        </div>

        {/* Dòng dưới: thời gian + hình ảnh */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <p>{t.createdAt}</p>
          {t.imageUrl ? (
            <a
              href={t.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              Xem ảnh
            </a>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 bg-gradient-to-r from-[#EAFDFC] via-[#F7E7CE] to-[#E0F7FA] p-10 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold text-[#007E85]">
            LỊCH SỬ KHO
          </h1>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Tìm kiếm sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 h-11 rounded-xl bg-white border-gray-200 focus-visible:ring-0"
            />
            <Button
              variant="outline"
              onClick={() => loadTransactions(1)}
              className="rounded-xl flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" /> Làm mới
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-3 mb-6">
          {[
            { label: "Tất cả", val: 0 },
            { label: "Bán hàng", val: 1 },
            { label: "Nhập hàng", val: 2 },
          ].map((f) => (
            <Button
              key={f.val}
              onClick={() => setFilterType(f.val)}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                filterType === f.val
                  ? "bg-[#00A8B0] text-white shadow-md"
                  : "bg-white text-[#00A8B0] border border-[#00A8B0]"
              }`}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center text-gray-500 py-10 animate-pulse">
            Đang tải dữ liệu...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            Không có giao dịch
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 transition-all">
            {filtered.map(renderTxn)}
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-center items-center gap-4 mt-8">
          <Button
            variant="outline"
            onClick={() => page > 1 && loadTransactions(page - 1)}
            disabled={page <= 1}
            className="rounded-full"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-gray-700 font-semibold">
            Trang {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => page < totalPages && loadTransactions(page + 1)}
            disabled={page >= totalPages}
            className="rounded-full"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
