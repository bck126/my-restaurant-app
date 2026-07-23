'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';

interface OrderItem {
  id: string;
  name: string;
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

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderList: Order[] = [];
      snapshot.forEach((doc) => {
        orderList.push({ id: doc.id, ...doc.data() } as Order);
      });
      // กรองเฉพาะออเดอร์ที่ยังทำไม่เสร็จ
      setOrders(orderList.filter(o => o.status === 'pending' || o.status === 'cooking'));
    });

    return () => unsubscribe();
  }, []);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch (error) {
      console.error('Update status error:', error);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-amber-400">👨‍🍳 จอแสดงรายการอาหาร (ห้องครัว)</h1>
          <p className="text-xs text-slate-400">รายการอาหารที่ต้องทำเสิร์ฟ</p>
        </div>
        <div className="bg-slate-800 px-4 py-2 rounded-xl text-sm font-bold text-slate-300">
          คิวทั้งหมด: {orders.length} ออเดอร์
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((order) => {
          const isTakeaway = order.orderType === 'takeaway';
          return (
            <div 
              key={order.id} 
              className={`p-5 rounded-2xl border-2 bg-slate-800 shadow-lg flex flex-col justify-between ${
                isTakeaway ? 'border-purple-500' : 'border-amber-500'
              }`}
            >
              <div>
                {/* Header บอกประเภทออเดอร์ */}
                <div className="flex justify-between items-start border-b border-slate-700 pb-3 mb-3">
                  <div>
                    <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-lg mb-1 ${
                      isTakeaway ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {isTakeaway ? '🛍️ ใส่ถุง (กลับบ้าน)' : '🪑 ใส่จาน (ทานที่ร้าน)'}
                    </span>
                    <h2 className="text-xl font-black text-white">
                      {isTakeaway ? `ลูกค้า: ${order.customerName || 'ไม่ระบุชื่อ'}` : `โต๊ะ ${order.tableNo}`}
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'เมื่อสักครู่'}
                  </span>
                </div>

                {/* รายการเมนูที่ต้องทำ */}
                <div className="space-y-2 mb-4">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="bg-slate-900/60 p-2.5 rounded-xl flex justify-between items-center border border-slate-700/50">
                      <div>
                        <span className="font-bold text-base text-slate-100">{item.name}</span>
                        {item.note && <p className="text-xs text-amber-400">*( {item.note} )</p>}
                      </div>
                      <span className="text-xl font-black text-amber-400 bg-amber-400/10 px-3 py-1 rounded-lg">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ปุ่มเปลี่ยนสถานะ */}
              <div className="pt-2 border-t border-slate-700/50 flex gap-2">
                <button
                  onClick={() => updateStatus(order.id, 'served')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-md"
                >
                  ✅ ทำเสร็จแล้ว / พร้อมเสิร์ฟ
                </button>
              </div>
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-500 font-bold">
            ยังไม่มีรายการอาหารที่ต้องทำในขณะนี้ ☕
          </div>
        )}
      </div>
    </main>
  );
}