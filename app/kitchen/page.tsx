'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

interface Order {
  id: string;
  tableNo: string;
  items: OrderItem[];
  totalPrice: number;
  status: 'PENDING' | 'COOKING' | 'SERVED';
  createdAt: any;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [audioAllowed, setAudioAllowed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFirstLoad = useRef(true);

  // 1. โหลดระบบเสียง
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
    // หรือถ้ามีไฟล์ในเครื่องใช้: new Audio('/notification.mp3');
  }, []);

  // 2. ฟังก์ชันเล่นเสียงเตือน
  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // เล่นใหม่ตั้งแต่ต้น
      audioRef.current.play().catch((err) => {
        console.log('Autoplay blocked by browser:', err);
      });
    }
  };

  // 3. ดักจับออเดอร์ใหม่จาก Firebase แบบ Realtime
  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['PENDING', 'COOKING'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newOrders: Order[] = [];
      let hasNewOrderAdded = false;

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          hasNewOrderAdded = true;
        }
      });

      snapshot.forEach((doc) => {
        newOrders.push({ id: doc.id, ...doc.data() } as Order);
      });

      // สั่งเล่นเสียงเฉพาะเมื่อมีออเดอร์เพิ่มขึ้นมาใหม่ (ไม่ใช่การโหลดครั้งแรก)
      if (hasNewOrderAdded && !isFirstLoad.current) {
        playSound();
      }

      setOrders(newOrders);
      isFirstLoad.current = false;
    });

    return () => unsubscribe();
  }, []);

  // 4. อัปเดตสถานะออเดอร์ (เช่น ทำเสร็จแล้ว)
  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: nextStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // 5. ปุ่มเปิดใช้งานเสียง (เปิดหน้าเว็บครั้งแรก)
  const enableAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        setAudioAllowed(true);
      }).catch(console.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-black">👨‍🍳 หน้าจอห้องครัว (Kitchen Display)</h1>
          <p className="text-slate-400 text-sm mt-1">รายการออเดอร์จะอัปเดตและส่งเสียงเตือนอัตโนมัติ</p>
        </div>

        {/* ปุ่มกดยืนยันการเปิดเสียง (เบราว์เซอร์บังคับให้ User กดก่อนถึงจะเล่นเสียงได้) */}
        {!audioAllowed ? (
          <button
            onClick={enableAudio}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2.5 rounded-xl text-sm shadow-lg animate-pulse"
          >
            🔔 กดที่นี่เพื่อเปิดเสียงเตือน
          </button>
        ) : (
          <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            เปิดระบบเสียงเตือนแล้ว
          </div>
        )}
      </div>

      {/* รายการออเดอร์ที่เข้ามา */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-500 font-bold text-lg">
            ยังไม่มีออเดอร์เข้ามาในขณะนี้...
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className={`p-5 rounded-2xl border ${
                order.status === 'PENDING'
                  ? 'bg-slate-800 border-amber-500/50 shadow-amber-500/10 shadow-lg'
                  : 'bg-slate-800/60 border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-700">
                <span className="bg-emerald-600 text-white font-black px-3 py-1 rounded-lg text-lg">
                  โต๊ะ {order.tableNo}
                </span>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {order.status === 'PENDING' ? '⏳ รอทำ' : '🍳 กำลังทำ'}
                </span>
              </div>

              {/* เมนูที่สั่ง */}
              <ul className="space-y-2 mb-5">
                {order.items?.map((item, idx) => (
                  <li key={idx} className="flex justify-between items-center text-lg font-bold">
                    <span>{item.name}</span>
                    <span className="bg-slate-700 px-3 py-0.5 rounded-md text-amber-400">
                      x{item.quantity}
                    </span>
                  </li>
                ))}
              </ul>

              {/* ปุ่มเปลี่ยนสถานะ */}
              <div className="flex gap-2">
                {order.status === 'PENDING' && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'COOKING')}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl transition"
                  >
                    เริ่มทำอาหาร
                  </button>
                )}
                {order.status === 'COOKING' && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'SERVED')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition"
                  >
                    เสิร์ฟแล้ว / เสร็จสิ้น
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}