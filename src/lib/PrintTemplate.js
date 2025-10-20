export default class PrintTemplate {
  static buildReceipt(order, shop) {
    const lines = [];
    lines.push("   *** " + shop.name.toUpperCase() + " ***");
    lines.push(shop.address);
    lines.push("-----------------------------");
    lines.push(`Mã đơn: #${order.id}`);
    lines.push(`Ngày: ${new Date().toLocaleString("vi-VN")}`);
    lines.push("-----------------------------");

    order.items.forEach((item, i) => {
      const name = item.name.padEnd(20, " ");
      const price = (item.price * item.qty).toLocaleString("vi-VN");
      lines.push(`${i + 1}. ${name} ${price}`);
    });

    lines.push("-----------------------------");
    lines.push("TỔNG: " + order.total.toLocaleString("vi-VN") + " VND");
    lines.push("-----------------------------");
    lines.push("  CẢM ƠN QUÝ KHÁCH!");
    lines.push("\n\n\n");
    return lines.join("\n");
  }
}
