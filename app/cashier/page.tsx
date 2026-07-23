'use client';

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
}

interface Order {
  id: string;
  orderType?: 'dine-in' | 'takeaway';
  tableNo: string;
  customerName?: string;
  items: OrderItem[];
  totalPrice: number;
  status: 'pending' | 'cooking' | 'served' | 'completed' | 'cancelled';
  createdAt: any;
}

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderList: Order[] = [];
      snapshot.forEach((doc) => {
        orderList.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(orderList);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (orderId: string, status: 'completed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      console.error('Update status error:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (confirm('คุณต้องการลบรายการออเดอร์นี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
      } catch (error) {
        console.error('Delete order error:', error);
      }
    }
  };

  // ออเดอร์ที่ยังไม่ได้ชำระเงิน
  const pendingOrders = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  // ออเดอร์ที่ชำระเงินแล้ว
  const completedOrders = orders.filter((o) => o.status === 'completed');

  return (
    <main className="min-h-screen bg-slate-100 p-4 pb-20 text-slate-800 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">💵 แคชเชียร์ & เช็กบิล</h1>
          <p className="text-xs text-slate-500">จัดการออเดอร์ คิดเงิน ทานที่ร้าน และ ซื้อกลับบ้าน</p>
        </div>
        <a href="/admin/menu" className="text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-600 shadow-sm">
          ⚙️ จัดการเมนู
        </a>
      </div>

      {/* รายการออเดอร์ที่รอเก็บเงิน */}
      <section className="mb-8">
        <h2 className="font-bold text-slate-800 text-base mb-3 flex items-center gap-2">
          ⏳ รายการรอเช็กบิล ({pendingOrders.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingOrders.map((order) => {
            const isTakeaway = order.orderType === 'takeaway';
            return (
              <div key={order.id} className="bg-white p-5 rounded-2xl border-2 border-amber-300 shadow-sm space-y-3">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    {isTakeaway ? (
                      <span className="inline-block bg-purple-100 text-purple-700 text-xs font-black px-2.5 py-1 rounded-lg mb-1">
                        🛍️ ซื้อกลับบ้าน
                      </span>
                    ) : (
                      <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-lg mb-1">
                        🪑 โต๊ะ {order.tableNo}
                      </span>
                    )}
                    <h3 className="font-black text-slate-900 text-lg">
                      {isTakeaway ? `ลูกค้า: ${order.customerName || 'ไม่ระบุชื่อ'}` : `โต๊ะ ${order.tableNo}`}
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'เมื่อสักครู่'}
                  </span>
                </div>

                {/* รายการอาหาร */}
                <div className="space-y-1.5 py-1">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="font-bold text-slate-700">
                        {item.name} <span className="text-emerald-600 font-extrabold">x{item.quantity}</span>
                      </span>
                      <span className="text-slate-500 font-medium">{item.price * item.quantity} ฿</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-3 flex justify-between items-center font-black">
                  <span className="text-sm text-slate-600">ราคารวม</span>
                  <span className="text-lg text-emerald-600">{order.totalPrice} ฿</span>
                </div>

                {/* ปุ่มคิดเงิน / ยกเลิก */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'completed')}
                    className="flex-1 py-2.5 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition"
                  >
                    ✅ ชำระเงินเรียบร้อย
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                    className="py-2.5 px-3 bg-red-50 text-red-600 font-bold rounded-xl text-xs border border-red-200"
                  >
                    ❌ ยกเลิก
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {pendingOrders.length === 0 && (
          <div className="bg-white p-8 rounded-2xl text-center text-slate-400 border border-slate-200 text-sm">
            ไม่มีรายการรอเช็กบิลในขณะนี้ 🎉
          </div>
        )}
      </section>

      {/* ประวัติรายการที่รับเงินแล้ว */}
      <section>
        <h2 className="font-bold text-slate-700 text-base mb-3">
          ✅ ประวัติการรับชำระเงินเรียบร้อย ({completedOrders.length})
        </h2>

        <div className="space-y-2">
          {completedOrders.slice(0, 10).map((order) => (
            <div key={order.id} className="bg-white p-3.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-slate-800">
                  {order.orderType === 'takeaway' ? `🛍️ [กลับบ้าน] ${order.customerName}` : `🪑 โต๊ะ ${order.tableNo}`}
                </span>
                <span className="text-slate-400 ml-2">({order.items?.length || 0} รายการ)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-emerald-600">{order.totalPrice} ฿</span>
                <button onClick={() => handleDeleteOrder(order.id)} className="text-red-400 hover:text-red-600 font-bold">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}