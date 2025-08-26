import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search, Star, Heart, Plus, DollarSign,
  ChevronLeft, ChevronRight
} from "lucide-react"

const sampleProducts = [
  { id: 1, name: "Cà phê sữa", price: 30000, img: "https://via.placeholder.com/150" },
  { id: 2, name: "Cà phê đen", price: 25000, img: "https://via.placeholder.com/150" },
  { id: 3, name: "Bạc sỉu", price: 35000, img: "https://via.placeholder.com/150" },
  { id: 4, name: "Latte", price: 50000, img: "https://via.placeholder.com/150" },
]

const fmt = new Intl.NumberFormat("vi-VN")
 
export default function Menu() {
  const [orders, setOrders] = useState([])
  const [invoiceNo, setInvoiceNo] = useState(1)

  const addToOrder = (p) => {
    setOrders(prev => {
      const i = prev.findIndex(x => x.id === p.id)
      if (i >= 0) {
        const copy = [...prev]; copy[i] = { ...copy[i], qty: copy[i].qty + 1 }; return copy
      }
      return [...prev, { ...p, qty: 1, note: "" }]
    })
  }
  const updateNote = (i, v) => {
    const next = [...orders]; next[i].note = v; setOrders(next)
  }
  const total = orders.reduce((s, it) => s + it.price * it.qty, 0)

  const prevInvoice = () => setInvoiceNo(n => Math.max(1, n - 1))
  const nextInvoice = () => setInvoiceNo(n => n + 1)
  const newInvoice  = () => { setInvoiceNo(n => n + 1); setOrders([]) }

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
              <Input
                placeholder="Tìm món"
                className="pl-10 rounded-[15px] bg-[#00A8B0]/75 text-[#DCDCDC] placeholder-[#DCDCDC] border-0 focus:ring-0"
              />
            </div>
          </div>

          <div className="flex-1 bg-white rounded-xl overflow-hidden">
            <Tabs defaultValue="coffee" className="flex flex-col h-full">
              <TabsList className="flex gap-2 px-4 border-b sticky top-0 bg-white z-10">
                <TabsTrigger value="coffee">Cà phê</TabsTrigger>
                <TabsTrigger value="milk-tea">Trà sữa</TabsTrigger>
                <TabsTrigger value="tea">Trà</TabsTrigger>
                <TabsTrigger value="juice">Nước ép</TabsTrigger>
                <TabsTrigger value="matcha">Matcha</TabsTrigger>
                <TabsTrigger value="dessert">Tráng miệng</TabsTrigger>
              </TabsList>

              <TabsContent value="coffee" className="p-4 grid grid-cols-2 gap-4">
                {sampleProducts.map((p) => (
                  <Card key={p.id} className="relative overflow-hidden">
                    <CardContent className="p-2 flex flex-col items-center">
                      <button className="absolute top-2 right-2 text-gray-500 hover:text-red-500">
                        <Heart size={18} />
                      </button>
                      <img src={p.img} alt={p.name} className="w-full h-32 object-cover rounded-lg" />
                      <h3 className="mt-2 text-sm font-semibold">{p.name}</h3>
                      <p className="text-orange-500 font-bold">{fmt.format(p.price)}đ</p>
                      <div className="flex items-center justify-between w-full mt-2">
                        <div className="flex items-center text-yellow-500 text-xs">
                          <Star size={14} fill="currentColor" /> 4.5
                        </div>
                        <Button size="sm" onClick={() => addToOrder(p)}>Add</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              <TabsContent value="milk-tea" className="p-4">Danh sách Trà sữa...</TabsContent>
              <TabsContent value="tea" className="p-4">Danh sách Trà...</TabsContent>
              <TabsContent value="juice" className="p-4">Danh sách Nước ép...</TabsContent>
              <TabsContent value="matcha" className="p-4">Danh sách Matcha...</TabsContent>
              <TabsContent value="dessert" className="p-4">Danh sách Tráng miệng...</TabsContent>
            </Tabs>
          </div>
        </div>

        {/* RIGHT - ORDER */}
{/* RIGHT - ORDER */}
<div className="w-1/2 flex flex-col">
  <div className="flex items-center justify-between px-4 py-3 mb-2">
    <div className="flex items-center gap-3">
      <div className="px-5 py-2 bg-white rounded-[15px] font-semibold -ml-4 shadow-sm">
        Hóa đơn #0001
      </div>
      <button className="w-9 h-9 rounded-full bg-[#00A8B0] text-white grid place-items-center hover:opacity-90">
        <Plus className="w-5 h-5" />
      </button>
    </div>
    <div className="flex items-center gap-2">
      <button className="w-9 h-9 grid place-items-center rounded-full bg-white/20 text-white hover:bg-white/30">‹</button>
      <button className="w-9 h-9 grid place-items-center rounded-full bg-white/20 text-white hover:bg-white/30">›</button>
    </div>
  </div>
  <div className="flex-1 flex flex-col bg-white rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-[6px] bg-[#EAF7F8] grid place-items-center text-[#0c5e64] text-[10px]">■</div>
        <span className="text-[#0c5e64] font-semibold">Khách lẻ</span>
      </div>
      <div className="flex items-center gap-3 w-[60%]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Tìm khách hàng"
            className="h-9 rounded-full pl-9 pr-10 border-2 border-[#00A8B0] focus-visible:ring-0"
          />
        </div>
        <button className="w-9 h-9 rounded-full bg-[#00A8B0] text-white grid place-items-center hover:opacity-90">
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
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
          const line = o.price * o.qty
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
                onChange={(e) => updateNote(i, e.target.value)}
                className="mt-2 h-8 text-sm rounded-full bg-[#F3F4F6] border"
              />
            </div>
          )
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
        <Button className="rounded-xl bg-[#00A8B0] flex-1">Thanh toán</Button>
      </div>
    </div>
  </div>
</div>
      </div>
    </div>
  )
}
