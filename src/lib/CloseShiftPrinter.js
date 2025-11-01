import { buildCloseShiftHTML } from "./CloseShiftTemplate";

export async function printCloseShiftHtml(data) {
  try {
    const html = await buildCloseShiftHTML(data);
    const w = window.open("", "_blank", "width=420,height=700");
    w.document.write(html);
    w.document.close();
  } catch (err) {
    console.error("❌ Lỗi in phiếu chốt ca:", err);
  }
}
