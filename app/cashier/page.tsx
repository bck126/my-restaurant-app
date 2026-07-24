'use client';

import { useState, useEffect } from 'react';
import { db } from '../firebase'; // หรือ '@/app/firebase'
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

  // 🎯 แสดงเฉพาะรายการที่ "ยังไม่ได้จ่ายเงิน" และ "ยังไม่ถูกยกเลิก"
  const unpaidOrders = orders.filter((o) => !o.isPaid && o.status !== 'cancelled');

  // ฟังก์ชันให้แคชเชียร์กดเก็บเงิน
  const handleConfirmPayment = async (orderId: string) => {
    if (!confirm('ยืนยันรับชำระเงินสำหรับออเดอร์นี้?')) return;

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { isPaid: true });
    } catch (error) {
      console.error('Payment Error:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกการชำระเงิน');
    }
  };

  return (
    <main className="p-6 bg-slate-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">💵 จุดรับชำระเงิน (Cashier)</h1>

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
    </main>
  );
}