'use client';

import { useState, useEffect } from 'react';
import { db } from '../firebase';
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
  
  const [reportTab, setReportTab] = useState<'summary' | 'daily' | 'monthly'>('summary');

  // 🎯 State สำหรับเก็บค่าวันที่เริ่มต้นและสิ้นสุดในการกรองสินค้าขายดี (รูปแบบ YYYY-MM-DD)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 1. ดึงข้อมูล orders แบบ Real-time
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

  // กรองเฉพาะออเดอร์ที่ชำระเงินแล้ว
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

  // ================= 📅 2. จัดกลุ่มยอดขายรายวัน =================
  const dailySalesMap: Record<string, { dateStr: string; total: number; count: number; rawDate: Date }> = {};
  paidOrders.forEach((order) => {
    if (order.createdAt?.toDate) {
      const dateObj = order.createdAt.toDate();
      const dateKey = dateObj.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      if (!dailySalesMap[dateKey]) {
        dailySalesMap[dateKey] = { dateStr: dateKey, total: 0, count: 0, rawDate: dateObj };
      }
      dailySalesMap[dateKey].total += order.totalPrice;
      dailySalesMap[dateKey].count += 1;
    }
  });
  const dailySalesList = Object.values(dailySalesMap).sort(
    (a, b) => b.rawDate.getTime() - a.rawDate.getTime()
  );

  // ================= 🗓️ 3. จัดกลุ่มยอดขายรายเดือน =================
  const monthlySalesMap: Record<string, { monthStr: string; total: number; count: number }> = {};
  paidOrders.forEach((order) => {
    if (order.createdAt?.toDate) {
      const dateObj = order.createdAt.toDate();
      const monthKey = dateObj.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
      });
      if (!monthlySalesMap[monthKey]) {
        monthlySalesMap[monthKey] = { monthStr: monthKey, total: 0, count: 0 };
      }
      monthlySalesMap[monthKey].total += order.totalPrice;
      monthlySalesMap[monthKey].count += 1;
    }
  });
  const monthlySalesList = Object.values(monthlySalesMap);

  // ================= 🏆 4. คำนวณสินค้าที่ขายดีที่สุด (ตามช่วงวันที่เลือก) =================
  const filteredOrdersForProducts = paidOrders.filter((order) => {
    if (!order.createdAt?.toDate) return false;
    const orderDate = order.createdAt.toDate();

    // เคลียร์ชั่วโมงให้เป็น 00:00:00 เพื่อเทียบวันที่ได้แม่นยำ
    orderDate.setHours(0, 0, 0, 0);

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (orderDate < start) return false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (orderDate > end) return false;
    }

    return true;
  });

  const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

  filteredOrdersForProducts.forEach((order) => {
    order.items.forEach((item) => {
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

  const topProducts = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity);

  const handleResetDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-black text-slate-800">📊 Dashboard ยอดขายและสินค้าขายดี</h1>

      {/* 🎯 แถบบาร์สลับมุมมองรายงาน */}
      <div className="bg-white p-1.5 rounded-2xl shadow-xs border border-slate-200 flex gap-2 max-w-md">
        <button
          onClick={() => setReportTab('summary')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            reportTab === 'summary'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📈 สรุปภาพรวม
        </button>
        <button
          onClick={() => setReportTab('daily')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            reportTab === 'daily'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📅 รายวันตามวันที่
        </button>
        <button
          onClick={() => setReportTab('monthly')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            reportTab === 'monthly'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          🗓️ รายเดือนแยกเป็นเดือน
        </button>
      </div>

      {/* ================= TAB 1: สรุปภาพรวม ================= */}
      {reportTab === 'summary' && (
        <div className="space-y-6 animate-fade-in">
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

          {/* ตารางสินค้าขายดี พร้อมตัวกรองวันที่ */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                🔥 10 อันดับ สินค้าขายดี
              </h2>

              {/* 🎯 ส่วนเลือกช่วงวันที่ */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-600">📅 ตั้งแต่วันที่:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="font-bold text-slate-600">ถึง:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={handleResetDateFilter}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition"
                  >
                    ล้างค่า
                  </button>
                )}
              </div>
            </div>

            {topProducts.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center">ไม่พบข้อมูลการขายในช่วงวันที่เลือก</p>
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
      )}

      {/* ================= TAB 2: รายวันตามวันที่ ================= */}
      {reportTab === 'daily' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 animate-fade-in">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            📅 ยอดขายรายวัน (แยกตามวันที่)
          </h2>

          {dailySalesList.length === 0 ? (
            <p className="text-slate-400 text-xs py-8 text-center">ยังไม่มีข้อมูลยอดขายรายวัน</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                  <tr>
                    <th className="p-3 rounded-l-xl">วันที่</th>
                    <th className="p-3 text-center">จำนวนบิลที่ชำระแล้ว</th>
                    <th className="p-3 text-right rounded-r-xl">ยอดขายรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailySalesList.map((item) => (
                    <tr key={item.dateStr} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-bold text-slate-800">{item.dateStr}</td>
                      <td className="p-3 text-center font-semibold text-slate-600">{item.count} บิล</td>
                      <td className="p-3 text-right font-black text-amber-600">฿{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: รายเดือนแยกเป็นเดือน ================= */}
      {reportTab === 'monthly' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 animate-fade-in">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            🗓️ ยอดขายรายเดือน (แยกเป็นเดือน)
          </h2>

          {monthlySalesList.length === 0 ? (
            <p className="text-slate-400 text-xs py-8 text-center">ยังไม่มีข้อมูลยอดขายรายเดือน</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                  <tr>
                    <th className="p-3 rounded-l-xl">เดือน</th>
                    <th className="p-3 text-center">จำนวนบิลที่ชำระแล้ว</th>
                    <th className="p-3 text-right rounded-r-xl">ยอดขายรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlySalesList.map((item) => (
                    <tr key={item.monthStr} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-bold text-slate-800">{item.monthStr}</td>
                      <td className="p-3 text-center font-semibold text-slate-600">{item.count} บิล</td>
                      <td className="p-3 text-right font-black text-emerald-600">฿{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}