'use client';

import { useState, useEffect } from 'react';
import { db } from '../firebase'; // ✅ ถูกต้อง (ถอยออกจาก dashboard ไปที่โฟลเดอร์ app)
import { collection, onSnapshot } from 'firebase/firestore';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  itemStatus?: string;
  status?: string;
  isCancelled?: boolean;
}

interface Order {
  id: string;
  totalPrice: number;
  createdAt?: any;
  paymentStatus?: string;
  isPaid?: boolean;
  status?: string;
  items: OrderItem[];
}

export default function DashboardSales() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. ดึงข้อมูล orders แบบ Real-time ให้ตรงกับฝั่งแคชเชียร์และลูกค้า
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const fetchedOrders: Order[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          totalPrice: Number(data.totalPrice) || 0,
          createdAt: data.createdAt,
          paymentStatus: data.paymentStatus || 'unpaid',
          isPaid: data.paymentStatus === 'paid' || data.isPaid === true,
          status: data.status || 'pending',
          items: Array.isArray(data.items) ? data.items : [],
        };
      });
      setOrders(fetchedOrders);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-slate-500">กำลังโหลดข้อมูล Dashboard...</div>;
  }

  // ================= 📊 2. คำนวณยอดขาย (กรองเฉพาะออเดอร์ที่จ่ายเงินแล้ว หรือสำเร็จแล้ว) =================
  // สามารถปรับเงื่อนไขตรงนี้ได้ตามระบบการชำระเงินจริงของคุณ
  const paidOrders = orders.filter(
    (order) => order.isPaid || order.paymentStatus === 'paid'
  );

  // ยอดขายรวมทั้งหมด
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.totalPrice, 0);

  // ยอดขายเฉพาะ "วันนี้"
  const todayStr = new Date().toDateString();
  const todayRevenue = paidOrders
    .filter((order) => {
      if (!order.createdAt?.toDate) return false;
      return order.createdAt.toDate().toDateString() === todayStr;
    })
    .reduce((sum, order) => sum + order.totalPrice, 0);

  // ================= 🏆 3. คำนวณสินค้าที่ขายดีที่สุด =================
  const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

  paidOrders.forEach((order) => {
    order.items.forEach((item) => {
      // ตรวจสอบว่าสินค้าไม่ถูกยกเลิก
      const isCancelled =
        item.itemStatus === 'cancelled' ||
        item.status === 'cancelled' ||
        item.isCancelled === true;

      if (!isCancelled) {
        const itemName = item.name || 'ไม่ระบุชื่อสินค้า';
        if (!productSalesMap[itemName]) {
          productSalesMap[itemName] = { name: itemName, quantity: 0, revenue: 0 };
        }
        productSalesMap[itemName].quantity += Number(item.quantity) || 0;
        productSalesMap[itemName].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 0);
      }
    });
  });

  // แปลงเป็น Array และเรียงลำดับจากสินค้าที่ขายดีที่สุด (จำนวนมากที่สุด)
  const topProducts = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-black text-slate-800">📊 Dashboard ยอดขายและสินค้าขายดี</h1>

      {/* การ์ดแสดงผลรวม */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400">ยอดขายวันนี้</p>
          <p className="text-3xl font-black text-amber-600 mt-1">฿{todayRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400">ยอดขายรวมทั้งหมด</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">฿{totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400">จำนวนบิลที่ชำระเงินแล้ว</p>
          <p className="text-3xl font-black text-slate-700 mt-1">{paidOrders.length} บิล</p>
        </div>
      </div>

      {/* ตารางสินค้าขายดี */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
          🔥 10 อันดับ สินค้าขายดี
        </h2>

        {topProducts.length === 0 ? (
          <p className="text-slate-400 text-xs py-8 text-center">ยังไม่มีข้อมูลการขาย</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="p-3 rounded-l-xl">อันดับ</th>
                  <th className="p-3">ชื่อสินค้า</th>
                  <th className="p-3 text-center">จำนวนที่ขายได้</th>
                  <th className="p-3 text-right rounded-r-xl">รายได้รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.slice(0, 10).map((prod, index) => (
                  <tr key={prod.name} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-bold text-slate-500">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </td>
                    <td className="p-3 font-bold text-slate-800">{prod.name}</td>
                    <td className="p-3 text-center font-black text-amber-600">{prod.quantity} หน่วย</td>
                    <td className="p-3 text-right font-black text-slate-700">฿{prod.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}