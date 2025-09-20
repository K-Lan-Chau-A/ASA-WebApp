"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AtSign, Lock, Eye, EyeOff } from "lucide-react";
import loginArt from "../assets/img/logindraft.jpg";
import API_URL from "@/config/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Chuẩn hoá dữ liệu từ nhiều kiểu response khác nhau
  const normalizeLoginData = (raw) => {
    // Có thể là { success, message, data: {...} } hoặc {...}
    const root = raw?.data && typeof raw.data === "object" ? raw.data : raw;

    // Trích token theo vài key phổ biến
    const token =
      root?.accessToken ??
      raw?.accessToken ??
      raw?.token ??
      raw?.data?.accessToken ??
      null;

    // Trích các trường còn lại theo mẫu BE của bạn
    const profile = {
      userId: root?.userId ?? root?.id ?? null,
      username: root?.username ?? null,
      status: root?.status ?? null,
      shopId: root?.shopId ?? null,
      role: root?.role ?? null,
      avatar: root?.avatar ?? null,
      requestLimit: root?.requestLimit ?? null,
      accountLimit: root?.accountLimit ?? null,
      createdAt: root?.createdAt ?? null,
    };

    return { token, profile };
  };

  // Lưu vào localStorage 1 lần, có namespace rõ ràng
  const persistAuth = ({ token, profile }) => {
    if (token) localStorage.setItem("accessToken", token);
    if (profile) localStorage.setItem("userProfile", JSON.stringify(profile));
    // Gói chung để tiện debug/đồng bộ (tuỳ ý)
    localStorage.setItem(
      "auth",
      JSON.stringify({
        token: token ?? null,
        profile: profile ?? null,
        savedAt: new Date().toISOString(),
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = `${API_URL}/api/authentication/login`;

    // 3 biến thể payload hay gặp
    const payloads = [
      { username, password },
      { userName: username, password },
      { email: username, password },
    ];

    // helper parse body dù server trả json hay text
    const safeParse = async (res) => {
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

    try {
      let lastError;
      for (let i = 0; i < payloads.length; i++) {
        const body = JSON.stringify(payloads[i]);
        console.debug("[login] try payload", payloads[i]);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
          mode: "cors",
          body,
        });

        const data = await safeParse(res);
        console.debug("[login] status:", res.status, "data:", data);

        if (res.ok) {
          // Chuẩn hoá & lưu trữ toàn bộ thông tin cần thiết
          const { token, profile } = normalizeLoginData(data);
          persistAuth({ token, profile });

          // Điều hướng
          navigate("/orders");
          return;
        } else {
          const msg =
            data?.message || data?.error || data?.raw || `HTTP ${res.status}`;
          lastError = { code: res.status, msg };
          // Nếu 4xx => khả năng sai tài khoản/mật khẩu, dừng thử payload khác
          if (res.status >= 400 && res.status < 500) break;
        }
      }

      // nếu tới đây là fail cả 3 payload
      const code = lastError?.code || 500;
      const msg = lastError?.msg || "Đăng nhập thất bại!";
      setError(`Đăng nhập lỗi (HTTP ${code}): ${msg}`);
    } catch (err) {
      setError(err.message || "Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#012E40] border-[4px] border-[#012E40] p-3">
      <div className="flex bg-[#012E40] h-full">
        {/* LEFT: Illustration */}
        <div className="hidden md:flex items-center justify-center w-1/2 bg-white overflow-hidden">
          <img src={loginArt} alt="login" className="w-full h-auto object-contain" />
        </div>

        {/* RIGHT: Login form */}
        <div className="flex items-center justify-center w-full md:w-1/2 bg-white">
          <div className="w-full max-w-md px-8 py-10">
            <h1 className="text-3xl font-bold text-gray-900 text-center">Đăng nhập</h1>
            <p className="mt-2 text-center text-[#00A8B0]">Nhập ID của bạn để đăng nhập</p>

            {error && (
              <div className="mt-4 text-sm text-red-600 text-center">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* Username */}
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#00A8B0]" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tên đăng nhập"
                  className="h-12 pl-10 pr-4 rounded-lg border-gray-300 focus-visible:ring-2 focus-visible:ring-[#00A8B0]"
                  autoComplete="username"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#00A8B0]" />
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  className="h-12 pl-10 pr-12 rounded-lg border-gray-300 focus-visible:ring-2 focus-visible:ring-[#00A8B0]"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="h-12 w-full rounded-lg bg-[#00A8B0] text-white hover:opacity-90 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </Button>
            </form>

            <div className="mt-16 text-center text-[13px] text-orange-500">Kỳ Lân Châu Á</div>
          </div>
        </div>
      </div>
    </div>
  );
}
