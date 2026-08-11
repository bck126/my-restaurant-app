'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '../firebase'; 
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from 'firebase/firestore';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  table: string;
  orderType: string;
  items: OrderItem[];
  totalPrice: number;
  status: 'pending' | 'cooking' | 'completed' | 'cancelled';
  paymentStatus?: string;
  isPaid?: boolean;
}

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];
      setOrders(fetchedOrders);
    });

    return () => unsubscribe();
  }, []);

  // 🎯 กรองเฉพาะออเดอร์ที่ "ยังไม่ได้จ่ายเงิน" และ "ยังไม่ถูกยกเลิก"
  const unpaidOrders = orders.filter((o) => {
    const isPaid = o.paymentStatus === 'paid' || o.isPaid === true;
    const isCancelled = o.status === 'cancelled';
    return !isPaid && !isCancelled;
  });

  // ฟังก์ชันให้แคชเชียร์กดเก็บเงิน
  const handleConfirmPayment = async (orderId: string) => {
    if (!confirm('ยืนยันรับชำระเงินสำหรับออเดอร์นี้?')) return;

    try {
      const orderRef = doc(db, 'orders', orderId);
      // 👈 อัปเดตทั้ง paymentStatus, isPaid และ status ให้ตรงกันทุกจุด
      await updateDoc(orderRef, { 
        paymentStatus: 'paid',
        isPaid: true,
        status: 'completed'
      });
    } catch (error) {
      console.error('Payment Error:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกการชำระเงิน');
    }
  };

  return (
    <main className="p-6 bg-slate-100 min-h-screen">
      {/* Header พร้อมปุ่มลิงก์ไปหน้าจัดการเมนู */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">💵 จุดรับชำระเงิน (Cashier)</h1>
          <p className="text-sm text-slate-500">รายการสั่งอาหารและรับชำระเงิน</p>
        </div>

        <div className="flex items-center gap-3">
          {/* ➕ ปุ่มกดเข้าไปเพิ่ม/จัดการเมนู */}
          <Link
            href="/admin/menu"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl shadow transition text-sm flex items-center gap-2"
          >
            ➕ เพิ่ม / จัดการเมนู
          </Link>
        </div>
      </header>

      {/* รายการออเดอร์ค้างชำระเงิน */}
      <div className="max-w-7xl mx-auto">
        {unpaidOrders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-slate-500 font-bold text-lg">ไม่มีรายการค้างชำระเงินในขณะนี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unpaidOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl p-5 shadow-md border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-black text-slate-800">โต๊ะ {order.table}</span>
                    {/* แสดงสถานะทำอาหารให้แคชเชียร์เห็น */}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      order.status === 'completed' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : order.status === 'cooking' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {order.status === 'completed' ? '✓ ทำเสร็จแล้ว' : order.status === 'cooking' ? '🔥 กำลังทำ' : '⏳ รอทำ'}
                    </span>
                  </div>

                  {/* รายการอาหาร */}
                  <div className="space-y-2 border-t border-b border-slate-100 py-3 my-2">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm text-slate-600">
                        <span>{item.name} x{item.quantity}</span>
                        <span>฿{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* ยอดรวม */}
                  <div className="flex justify-between items-center mt-3 text-lg font-black text-slate-900">
                    <span>ยอดรวมทั้งหมด:</span>
                    <span className="text-emerald-600">฿{order.totalPrice}</span>
                  </div>
                </div>

                {/* ปุ่มกดเก็บเงินเฉพาะแคชเชียร์ */}
                <button
                  onClick={() => handleConfirmPayment(order.id)}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg text-sm"
                >
                  💵 ชำระเงินเรียบร้อย
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}