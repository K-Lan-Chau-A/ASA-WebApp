import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import API_URL from "@/config/api";
import loginArt from "../assets/img/logindraft.jpg";
import { ArrowLeft, Delete } from "lucide-react";

const fmt = new Intl.NumberFormat("vi-VN");

export default function OpenShiftPage() {
  const navigate = useNavigate();

  const [digits, setDigits] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("accessToken") || "";
  const profile =
    JSON.parse(localStorage.getItem("userProfile") || "null") ||
    JSON.parse(localStorage.getItem("auth") || "null")?.profile ||
    null;

  const userId = Number(profile?.userId || profile?.id || 0) || 0;
  const shopId = Number(profile?.shopId || 0) || 0;

  const openingCash = useMemo(() => {
    if (!digits) return 0;
    const normalized = digits.replace(/^0+/, "");
    return normalized ? Number(normalized) : 0;
  }, [digits]);

  const display = fmt.format(openingCash) + " VND";

  const pressDigit = (d) => {
    setErr("");
    setDigits((prev) => {
      const next = (prev + d).replace(/^0+(?=\d)/, "");
      return next.length > 15 ? prev : next;
    });
  };

  const pressTripleZero = () => {
    setErr("");
    setDigits((prev) => {
      const next = (prev || "0") + "000";
      const trimmed = next.replace(/^0+(?=\d)/, "");
      return trimmed.length > 15 ? prev : trimmed;
    });
  };

  const backspace = () => {
    setErr("");
    setDigits((prev) => prev.slice(0, -1));
  };

  const safeParse = async (res) => {
    try {
      return await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      try { return JSON.parse(text); } catch { return { raw: text }; }
    }
  };

  const persistShiftId = (shiftId) => {
    if (!shiftId) return;

    // cập nhật auth
    const authRaw = JSON.parse(localStorage.getItem("auth") || "{}");
    const newAuth = {
      ...authRaw,
      shiftId,
      profile: { ...(authRaw.profile || {}), shiftId },
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("auth", JSON.stringify(newAuth));

    const upRaw = JSON.parse(localStorage.getItem("userProfile") || "null") || {};
    localStorage.setItem(
      "userProfile",
      JSON.stringify({ ...upRaw, shiftId })
    );

    console.log("[OpenShift] shiftId saved to localStorage:", shiftId);
  };

  const openShift = async () => {
    setErr("");

    if (!token) {
      setErr("Bạn chưa đăng nhập hoặc thiếu token.");
      return;
    }
    if (!userId || !shopId) {
      setErr("Thiếu thông tin người dùng hoặc cửa hàng (userId/shopId).");
      return;
    }

    setLoading(true);
    try {
      const url = `${API_URL}/api/shifts/open-shift`;
      const body = JSON.stringify({ userId, openingCash, shopId });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        mode: "cors",
        body,
      });

      const data = await safeParse(res);
      console.log("[OpenShift] Response:", res.status, data);

      if (!res.ok) {
        const msg = data?.message || data?.error || data?.raw || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const shiftId =
        data?.shiftId ??
        data?.data?.shiftId ??
        data?.id ??
        data?.shift?.id ??
        null;

      persistShiftId(shiftId);

      navigate("/orders");
    } catch (e) {
      console.error("[OpenShift] Lỗi mở ca:", e);
      setErr(e.message || "Không thể mở ca. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#012E40] border-[4px] border-[#012E40] p-3">
      <div className="flex h-full bg-[#012E40]">
        {/* LEFT*/}
        <div className="hidden md:flex items-center justify-center w-1/2 bg-white overflow-hidden rounded-l-xl">
          <img src={loginArt} alt="art" className="w-full h-auto object-contain" />
        </div>

        {/* RIGHT */}
        <div className="w-full md:w-1/2 bg-white rounded-r-xl flex items-center justify-center">
          <div className="w-full max-w-lg px-6 sm:px-10 py-10">
            <h1 className="text-3xl font-bold text-[#00A8B0] text-center">Số dư đầu</h1>
            <p className="text-center text-gray-500 mt-1">Nhập số tiền trong két</p>

            <div className="mt-6 text-center text-3xl sm:text-4xl font-semibold text-[#0c5e64]">
              {display}
            </div>

            {err ? <div className="mt-3 text-center text-sm text-red-600">{err}</div> : null}

            {/* Keypad */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {["1","2","3","4","5","6","7","8","9"].map((d) => (
                <button
                  key={d}
                  onClick={() => pressDigit(d)}
                  className="h-14 rounded-lg border text-lg font-semibold hover:bg-gray-50 active:scale-[0.99]"
                  disabled={loading}
                >{d}</button>
              ))}
              <button onClick={pressTripleZero} className="h-14 rounded-lg border text-lg font-semibold hover:bg-gray-50 active:scale-[0.99]" disabled={loading}>000</button>
              <button onClick={() => pressDigit("0")} className="h-14 rounded-lg border text-lg font-semibold hover:bg-gray-50 active:scale-[0.99]" disabled={loading}>0</button>
              <button onClick={backspace} className="h-14 rounded-lg border text-lg font-semibold hover:bg-gray-50 active:scale-[0.99] flex items-center justify-center" disabled={loading} title="Xoá">
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-lg flex items-center justify-center gap-2" onClick={() => navigate(-1)} disabled={loading}>
                <ArrowLeft className="w-4 h-4" />
                Quay về
              </Button>

              <Button className="h-11 rounded-lg bg-[#00A8B0] hover:opacity-90" onClick={openShift} disabled={loading}>
                {loading ? "Đang mở ca..." : "Mở ca"}
              </Button>
            </div>

            <div className="mt-10 text-center text-xs text-orange-500">Kỳ Lân Châu Á</div>
          </div>
        </div>
      </div>
    </div>
  );
}
