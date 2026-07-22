'use client';

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  orderType: 'DINE_IN' | 'TAKEAWAY';
  tableNo: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: 'PENDING' | 'COMPLETED' | 'PAID';
  createdAt: any;
}

interface TopMenu {
  name: string;
  totalQty: number;
  totalSales: number;
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    // ดึงข้อมูลออเดอร์ทั้งหมด Realtime
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderList: Order[] = [];
      snapshot.forEach((doc) => {
        orderList.push({ id: doc.id, ...doc.data() } as Order);
      });
      // เรียงจากล่าสุดไปเก่าสุด
      setOrders(orderList.reverse());
    });

    return () => unsubscribe();
  }, []);

  // 1. กรองเฉพาะออเดอร์ที่ชำระเงินแล้ว (PAID)
  const paidOrders = orders.filter((o) => o.status === 'PAID');

  // 2. คำนวณยอดขายรวมทั้งหมด
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalPrice, 0);

  // 3. สรุปอันดับเมนูขายดี
  const topMenusMap: { [key: string]: TopMenu } = {};
  paidOrders.forEach((order) => {
    order.items?.forEach((item) => {
      if (!topMenusMap[item.name]) {
        topMenusMap[item.name] = { name: item.name, totalQty: 0, totalSales: 0 };
      }
      topMenusMap[item.name].totalQty += item.quantity;
      topMenusMap[item.name].totalSales += item.price * item.quantity;
    });
  });

  const topMenus = Object.values(topMenusMap).sort((a, b) => b.totalQty - a.totalQty);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="bg-white p-6 rounded-2xl shadow-sm mb-6 border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📊 รายงานยอดขาย & แดชบอร์ด</h1>
          <p className="text-slate-500 text-sm">สรุปรายได้และวิเคราะห์เมนูขายดี Real-time</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold border border-blue-200">
          อัปเดตข้อมูลอัตโนมัติ 🟢
        </div>
      </header>

      {/* การ์ดสรุปตัวเลขสำคัญ (Stat Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm font-semibold mb-1">💰 ยอดขายรับเงินแล้วรวม</div>
          <div className="text-3xl font-black text-emerald-600">{totalRevenue.toLocaleString()} บาท</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm font-semibold mb-1">🧾 ชำระเงินสำเร็จแล้ว</div>
          <div className="text-3xl font-black text-blue-600">{paidOrders.length} ออเดอร์</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm font-semibold mb-1">⏳ รอชำระเงิน/กำลังทำ</div>
          <div className="text-3xl font-black text-amber-600">
            {orders.filter((o) => o.status !== 'PAID').length} ออเดอร์
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* อันดับเมนูขายดี */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-1">
          <h2 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
            🏆 อันดับเมนูขายดี
          </h2>
          <div className="space-y-3">
            {topMenus.map((menu, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${
                      idx === 0
                        ? 'bg-amber-400 text-white'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-700'
                        : idx === 2
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-sm text-slate-800">{menu.name}</div>
                    <div className="text-xs text-slate-500">{menu.totalSales} บาท</div>
                  </div>
                </div>
                <div className="font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border text-sm">
                  {menu.totalQty} จาน
                </div>
              </div>
            ))}

            {topMenus.length === 0 && (
              <p className="text-center text-slate-400 py-8 text-sm">ยังไม่มีข้อมูลการขาย</p>
            )}
          </div>
        </div>

        {/* ประวัติรายการสั่งย้อนหลัง */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
          <h2 className="font-bold text-lg mb-4 text-slate-800">📜 ประวัติออเดอร์ล่าสุด</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b">
                <tr>
                  <th className="p-3">รหัสออเดอร์</th>
                  <th className="p-3">โต๊ะ/ประเภท</th>
                  <th className="p-3">ยอดรวม</th>
                  <th className="p-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 10).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-medium text-slate-500">#{order.id.slice(0, 6)}</td>
                    <td className="p-3 font-semibold">
                      {order.orderType === 'DINE_IN' ? `🍽️ โต๊ะ ${order.tableNo}` : '🛍️ ซื้อกลับบ้าน'}
                    </td>
                    <td className="p-3 font-bold text-slate-800">{order.totalPrice} บาท</td>
                    <td className="p-3">
                      {order.status === 'PAID' && (
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-bold">
                          🟢 ชำระแล้ว
                        </span>
                      )}
                      {order.status === 'COMPLETED' && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-bold">
                          🔵 ครัวทำเสร็จ
                        </span>
                      )}
                      {order.status === 'PENDING' && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-bold">
                          🟡 รอทำอาหาร
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {orders.length === 0 && (
              <p className="text-center text-slate-400 py-8 text-sm">ยังไม่มีรายการออเดอร์ในระบบ</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}