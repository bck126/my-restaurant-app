'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; // ✅ ถอย 1 ระดับจะเจอ app/firebase.ts
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
  itemStatus?: 'pending' | 'done' | 'cancelled';
}

interface Order {
  id: string;
  table: string;
  orderType: string;
  customerContact?: string;
  items: OrderItem[];
  totalPrice: number;
  status: 'pending' | 'cooking' | 'completed' | 'cancelled';
  createdAt?: any;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAudioAllowed, setIsAudioAllowed] = useState(false);
  const isFirstLoad = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 🔊 ระบบสร้างเสียงเตือนแบบก้องดังชัดเจน (Web Audio API)
  const playLoudSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // เล่นเสียงกระดิ่งเตือน 3 ครั้งรัวๆ
      const times = [0, 0.2, 0.4];
      times.forEach((startTime) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        // สลับความถี่เสียงสูง-ต่ำ ให้สะดุดหู
        osc.frequency.setValueAtTime(880, ctx.currentTime + startTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + startTime + 0.15); // A6

        gain.gain.setValueAtTime(1.0, ctx.currentTime + startTime); // เร่งความดังสูงสุด
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + 0.2);
      });
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  };

  // ปุ่มปลดล็อกเสียงสำหรับเบราว์เซอร์
  const handleEnableAudio = () => {
    setIsAudioAllowed(true);
    playLoudSound(); // ทดสอบเสียง 1 ครั้งเมื่อกด
  };

  // ดึงรายการออเดอร์ทั้งหมดแบบ Realtime + ตรวจจับออเดอร์ใหม่เพื่อเล่นเสียง
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(q, (snapshot) => {
      // ตรวจจับเอกสารใหม่ที่มีการเพิ่มเข้ามา (Added)
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
      } else {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            console.log('🔔 มีออเดอร์ใหม่เข้าครัว!');
            playLoudSound();
          }
        });
      }

      const fetchedOrders: Order[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          table: data.table,
          orderType: data.orderType || 'ทานที่ร้าน',
          customerContact: data.customerContact || '',
          items: data.items || [],
          totalPrice: data.totalPrice || 0,
          status: data.status || 'pending',
          createdAt: data.createdAt,
        };
      });

      // กรองเอาเฉพาะออเดอร์ที่ยังทำไม่เสร็จ และยังไม่ถูกยกเลิกทั้งบิล
      const activeKitchenOrders = fetchedOrders.filter(
        (o) => o.status !== 'completed' && o.status !== 'cancelled'
      );

      setOrders(activeKitchenOrders);
    });

    return () => unsub();
  }, []);

  // 1. กดเปลี่ยนสถานะ "ทำเสร็จ" ของรายการอาหารแต่ละรายการ
  const handleItemStatusChange = async (orderId: string, itemIndex: number, newStatus: 'done' | 'pending') => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const updatedItems = [...targetOrder.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      itemStatus: newStatus,
    };

    // เช็กว่าทำเสร็จครบทุกรายการที่ไม่ได้ถูกยกเลิกหรือยัง
    const activeItems = updatedItems.filter((i) => i.itemStatus !== 'cancelled');
    const allDone = activeItems.length > 0 && activeItems.every((i) => i.itemStatus === 'done');

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        items: updatedItems,
        status: allDone ? 'completed' : 'cooking',
      });
    } catch (error) {
      console.error('Error updating item status:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
  };

  // 2. กดยกเลิกรายการอาหาร (คำนวณราคารวมใหม่ และปรับสถานะ)
  const handleCancelItem = async (orderId: string, itemIndex: number) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const itemToCancel = targetOrder.items[itemIndex];

    if (!confirm(`ยืนยันการยกเลิกเมนู "${itemToCancel.name}" หรือไม่?\nราคารวมของบิลจะถูกหักออก ฿${itemToCancel.price * itemToCancel.quantity}`)) {
      return;
    }

    const updatedItems = [...targetOrder.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      itemStatus: 'cancelled',
    };

    // คำนวณราคารวมใหม่เฉพาะรายการที่ไม่ถูกยกเลิก
    const newTotalPrice = updatedItems.reduce((sum, item) => {
      return item.itemStatus === 'cancelled' ? sum : sum + item.price * item.quantity;
    }, 0);

    // เช็กว่ารายการที่เหลือโดนยกเลิกหมดทั้งบิลแล้วหรือไม่
    const activeItems = updatedItems.filter((i) => i.itemStatus !== 'cancelled');
    const isAllCancelled = activeItems.length === 0;

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        items: updatedItems,
        totalPrice: newTotalPrice,
        status: isAllCancelled ? 'cancelled' : targetOrder.status,
      });
    } catch (error) {
      console.error('Error cancelling item:', error);
      alert('เกิดข้อผิดพลาดในการยกเลิกรายการ');
    }
  };

  // 3. กดเสิร์ฟ/เคลียร์ออเดอร์ทั้งบิล
  const handleCompleteOrder = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: 'completed' });
    } catch (error) {
      console.error('Error completing order:', error);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* แถบแจ้งเตือนสิทธิ์การใช้งานเสียงเตือน */}
        {!isAudioAllowed ? (
          <div className="bg-amber-500 text-white p-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-2 shadow-md animate-bounce">
            <span className="text-xs font-bold text-center sm:text-left">
              ⚠️ เบราว์เซอร์ต้องการการยินยอม: กรุณากดปุ่มเปิดเสียงเพื่อให้ระบบส่งเสียงเตือนเมื่อมีออเดอร์ใหม่เข้า
            </span>
            <button
              onClick={handleEnableAudio}
              className="bg-white text-amber-700 px-4 py-2 rounded-xl font-black text-xs shadow-sm hover:bg-amber-50 active:scale-95 transition whitespace-nowrap"
            >
              🔔 กดตรงนี้เพื่อเปิดเสียงเตือน
            </button>
          </div>
        ) : (
          <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex justify-between items-center shadow-xs">
            <span>✅ เปิดระบบเสียงเตือนออเดอร์ใหม่แล้ว</span>
            <button
              onClick={playLoudSound}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded-lg text-[11px]"
            >
              🔊 ทดสอบเสียง
            </button>
          </div>
        )}

        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-xl font-black text-slate-800">🍳 หน้าจอห้องครัว (Kitchen Display)</h1>
            <p className="text-xs text-slate-500 mt-0.5">จัดการรายการอาหารและอัปเดตสถานะ Realtime</p>
          </div>
          <span className="bg-amber-500 text-white font-black text-sm px-3 py-1 rounded-xl shadow-xs">
            รอทำ {orders.length} ออเดอร์
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <p className="text-5xl mb-3">👨‍🍳</p>
            <p className="text-slate-500 font-bold">ยังไม่มีออเดอร์เข้ามาในขณะนี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                    <div>
                      <span className="font-black text-lg">โต๊ะ {order.table}</span>
                      <span className="ml-2 text-xs bg-amber-500 px-2 py-0.5 rounded-md font-bold">
                        {order.orderType}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-300">
                      ราคารวม: ฿{order.totalPrice}
                    </span>
                  </div>

                  {order.customerContact && (
                    <div className="bg-amber-50 px-3 py-1.5 border-b border-amber-100 text-xs font-bold text-amber-900">
                      👤 ลูกค้า: {order.customerContact}
                    </div>
                  )}

                  <div className="p-3 space-y-2">
                    {order.items.map((item, idx) => {
                      const isDone = item.itemStatus === 'done';
                      const isCancelled = item.itemStatus === 'cancelled';

                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                            isCancelled
                              ? 'bg-red-50 border-red-200 opacity-60 line-through'
                              : isDone
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="font-bold text-slate-800 text-sm">
                              {item.name} <span className="text-amber-600 font-black">x{item.quantity}</span>
                            </div>
                            {item.note && (
                              <div className="text-amber-700 text-[11px] font-medium mt-0.5">
                                📝 {item.note}
                              </div>
                            )}
                            <div className="text-slate-400 text-[10px]">฿{item.price * item.quantity}</div>
                          </div>

                          {!isCancelled ? (
                            <div className="flex items-center gap-1.5">
                              {isDone ? (
                                <button
                                  onClick={() => handleItemStatusChange(order.id, idx, 'pending')}
                                  className="bg-emerald-600 text-white font-bold px-2 py-1 rounded-lg text-[11px] shadow-xs hover:bg-emerald-700"
                                >
                                  ✅ ทำเสร็จแล้ว
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleItemStatusChange(order.id, idx, 'done')}
                                  className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold px-2 py-1 rounded-lg text-[11px]"
                                >
                                  ⬜ รอทำ
                                </button>
                              )}

                              <button
                                onClick={() => handleCancelItem(order.id, idx)}
                                className="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-2 py-1 rounded-lg text-[11px]"
                                title="ยกเลิกรายการนี้"
                              >
                                ✕ ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <span className="text-red-600 font-bold text-[11px] italic">ยกเลิกแล้ว</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100">
                  <button
                    onClick={() => handleCompleteOrder(order.id)}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs shadow-xs transition"
                  >
                    🚀 เสิร์ฟครบทั้งหมด / ปิดบิลนี้
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}