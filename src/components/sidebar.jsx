import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  BarChart2,
  Folder,
  ShoppingBag,
  Users,
  Gift,
  Medal,
  Tag,
  UserCog,
  FileText,
  Package,
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: Home, label: "Trang chủ", path: "/orders" },
    { icon: BarChart2, label: "Dashboard", path: "/dashboard" },
    { icon: Folder, label: "Danh mục", path: "/categories" },
    { icon: ShoppingBag, label: "Đơn hàng", path: "/products" },
    { icon: FileText, label: "Hóa đơn", path: "/invoices" },
    { icon: Package, label: "Lịch sử kho", path: "/inventory-transactions" },
    { icon: Users, label: "Khách hàng", path: "/customers" },
    { icon: Gift, label: "Voucher", path: "/vouchers" },
    { icon: Medal, label: "Rank", path: "/ranks" },
    { icon: Tag, label: "Promotion", path: "/promotions" },
    { icon: UserCog, label: "User Features", path: "/user-features" },
  ];

  return (
    <div className="h-screen w-[90px] bg-[#161B22] flex flex-col items-center py-8 space-y-6 rounded-r-3xl relative overflow-visible">
      {navItems.map((item, idx) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;

        return (
          <div
            key={idx}
            className="relative w-full flex justify-center items-center"
          >
            {/* Lớp bọc ngoài cho tab được chọn */}
            {isActive && (
              <div
                className="
                  absolute w-[110px] h-[80px]
                  bg-[#E1FBFF]
                  rounded-2xl
                  -z-0
                  -right-[20px]
                  border border-[#E1FBFF]
                "
              />
            )}

            {/* Tab */}
            <button
              onClick={() => navigate(item.path)}
              title={item.label}
              className={`
                relative flex items-center justify-center
                w-14 h-14 rounded-2xl transition-all duration-300 z-10
                ${
                  isActive
                    ? `
                      bg-[#E1FBFF]
                      text-[#00A8B0]
                      shadow-[6px_6px_15px_rgba(246,127,32,0.5)]
                      border border-[#E1FBFF]
                    `
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }
              `}
            >
              <Icon className="w-6 h-6" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
