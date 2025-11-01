import PrintTemplate from "./PrintTemplate";

export async function buildCloseShiftHTML(data = {}) {
  const {
    shiftId = "---",
    startDate,
    closedDate,
    userName = "Nhân viên",
    openingCash = 0,
    grossRevenueTotal = 0,
    programDiscountsTotal = 0,
    manualDiscountAmount = 0,
    netRevenue = 0,
    orderCount = 0,
    guestCount = 0,
    theoreticalCashInDrawer = 0,
    paymentMethods = [],
    productGroups = [],
  } = data;

  const fmt = new Intl.NumberFormat("vi-VN");

  const paymentHtml = paymentMethods.length
    ? paymentMethods
        .map(
          (pm) => `
            <div class="flex justify-between">
              <span>${pm.method}</span>
              <span>${fmt.format(pm.amount)}đ</span>
            </div>
          `
        )
        .join("")
    : "<div>Không có phương thức thanh toán</div>";

  const productsHtml = productGroups.length
    ? productGroups
        .map(
          (p) => `
            <div class="flex justify-between">
              <span>${p.productName} (x${p.quantity})</span>
              <span>${fmt.format(p.revenue)}đ</span>
            </div>
          `
        )
        .join("")
    : "<div>Không có sản phẩm</div>";

  return `
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Báo cáo chốt ca</title>
      <style>
        body { font-family: "Arial", sans-serif; font-size: 14px; }
        .center { text-align: center; }
        .flex { display: flex; justify-content: space-between; }
        hr { border: none; border-top: 1px dashed #999; margin: 6px 0; }
      </style>
    </head>
    <body>
      <div class="center">
        <h3>TẠP HÓA MINH HẠNH</h3>
        <div>123 Đường Nguyễn Văn Cừ, Quận 5, TP.HCM</div>
        <b>BÁO CÁO CHỐT CA</b>
      </div>
      <hr/>
      <div>Mã ca: ${shiftId}</div>
      <div>Thời gian mở: ${startDate ? new Date(startDate).toLocaleString("vi-VN") : "-"}</div>
      <div>Thời gian đóng: ${closedDate ? new Date(closedDate).toLocaleString("vi-VN") : "-"}</div>
      <div>Thu ngân: ${userName}</div>
      <hr/>
      <div class="flex"><span>Số dư đầu ca:</span><span>${fmt.format(openingCash)}đ</span></div>
      <div class="flex"><span>Doanh thu (Gross):</span><span>${fmt.format(grossRevenueTotal)}đ</span></div>
      <div class="flex"><span>Giảm giá:</span><span>-${fmt.format(programDiscountsTotal + manualDiscountAmount)}đ</span></div>
      <div class="flex"><span>Doanh thu (Net):</span><span>${fmt.format(netRevenue)}đ</span></div>
      <div class="flex"><span>Tổng đơn hàng:</span><span>${orderCount}</span></div>
      <div class="flex"><span>Tổng khách:</span><span>${guestCount}</span></div>
      <div class="flex"><span>Tiền trong két:</span><span>${fmt.format(theoreticalCashInDrawer)}đ</span></div>
      <hr/>
      <div><b>Phương thức thanh toán:</b></div>
      ${paymentHtml}
      <hr/>
      <div><b>Sản phẩm bán chạy:</b></div>
      ${productsHtml}
      <hr/>
      <div class="center">
        <small>In lúc: ${new Date().toLocaleString("vi-VN")}</small><br/>
        <b>CẢM ƠN BẠN ĐÃ SỬ DỤNG ASA POS!</b><br/>
        <small>Powered by ASA POS</small>
      </div>
    </body>
    </html>
  `;
}
