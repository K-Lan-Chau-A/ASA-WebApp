import React from "react";

const Receipt = React.forwardRef(({ order }, ref) => (
  <div ref={ref} className="p-4 text-sm">
    <h2 className="text-center font-bold">CỬA HÀNG ASA POS</h2>
    <p className="text-center mb-2">-------------------------</p>

    <div>
      {order.items.map((item, idx) => (
        <div key={idx} className="flex justify-between">
          <span>{item.name} x{item.qty}</span>
          <span>{(item.price * item.qty).toLocaleString()}đ</span>
        </div>
      ))}
    </div>

    <p className="text-center mt-2 border-t pt-2 font-semibold">
      Tổng cộng: {order.total.toLocaleString()}đ
    </p>

    <p className="text-center mt-2">Cảm ơn quý khách!</p>
  </div>
));

export default Receipt;
