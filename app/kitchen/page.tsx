

'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { db } from '../firebase'; // หรือใช้ '@/app/firebase'
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from 'firebase/firestore';
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
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

function KitchenContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isInitialLoad = useRef<boolean>(true);

 // ฟังก์ชันเล่นเสียงกริ่งไฟฟ้าพลังสูง (กรี้ยงงงงงงง) ดังมากๆ เตือนต่อเนื่อง 5 ครั้ง
  const playAlertSound = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // ฟังก์ชันสร้างเสียงกริ่งสั่นรัวกระแทกความถี่ (Overdrive Bell)
      const ringSuperBell = (startTime: number, duration: number = 0.7) => {
        // สร้าง Oscillator 3 ตัวเพื่อรวมพลังเสียงให้ดังที่สุด
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        
        // ตัวสร้างจังหวะสั่นรัว (LFO)
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        const gain = ctx.createGain();

        // ใช้คลื่น Sawtooth และ Square ผสมกันเพื่อความแหลม บาดหู และทะลุผ่านเสียงรบกวน
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc3.type = 'sawtooth';

        // ตั้งย่านความถี่เสียงแหลมสูงแบบโลหะกระทบกัน
        osc1.frequency.setValueAtTime(1500, ctx.currentTime + startTime);
        osc2.frequency.setValueAtTime(2000, ctx.currentTime + startTime);
        osc3.frequency.setValueAtTime(2800, ctx.currentTime + startTime);

        // ตั้งค่าการสั่นรัวแบบกริ่งไฟฟ้า (45Hz = สั่นรัวสะใจ)
        lfo.frequency.setValueAtTime(45, ctx.currentTime + startTime);
        lfoGain.gain.setValueAtTime(400, ctx.currentTime + startTime);

        lfo.connect(osc1.frequency);
        lfo.connect(osc2.frequency);
        lfo.connect(osc3.frequency);

        // อัด Gain ระดับสูงสุด (Max Gain Threshold)
        gain.gain.setValueAtTime(1.0, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

        // เชื่อมต่อรวมสัญญาณเสียงเข้าลำโพง
        osc1.connect(gain);
        osc2.connect(gain);
        osc3.connect(gain);
        gain.connect(ctx.destination);

        // เริ่มเล่นเสียง
        lfo.start(ctx.currentTime + startTime);
        osc1.start(ctx.currentTime + startTime);
        osc2.start(ctx.currentTime + startTime);
        osc3.start(ctx.currentTime + startTime);

        // หยุดเสียงตามระยะเวลา
        lfo.stop(ctx.currentTime + startTime + duration);
        osc1.stop(ctx.currentTime + startTime + duration);
        osc2.stop(ctx.currentTime + startTime + duration);
        osc3.stop(ctx.currentTime + startTime + duration);
      };

      // 🔔 รัวกริ่ง "กรี้ยงงงงงงง" ยาวๆ ต่อเนื่อง 5 ครั้ง
      ringSuperBell(0, 0.7);      // ครั้งที่ 1
      ringSuperBell(0.8, 0.7);    // ครั้งที่ 2
      ringSuperBell(1.6, 0.7);    // ครั้งที่ 3
      ringSuperBell(2.4, 0.7);    // ครั้งที่ 4
      ringSuperBell(3.2, 1.1);    // ครั้งที่ 5 (ลากยาวปิดท้าย)

    } catch (e) {
      console.error('ไม่สามารถเล่นเสียงได้:', e);
    }
  };
  
  // ฟังก์ชันเปิดใช้งานระบบเสียงจากผู้ใช้
  const enableSound = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    setSoundEnabled(true);
    playAlertSound(); // เล่นเสียงทดสอบ 1 ครั้ง
  };

  // ดึงข้อมูล Realtime จาก Firestore
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Order[];

      // ตรวจสอบว่ามีออเดอร์ใหม่เข้ามาหลังจากโหลดครั้งแรกหรือไม่
      if (!isInitialLoad.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newOrderData = change.doc.data() as Order;
            // แจ้งเตือนเฉพาะออเดอร์ที่ยังมีสถานะ pending
            if (newOrderData.status === 'pending') {
              playAlertSound();
            }
          }
        });
      } else {
        isInitialLoad.current = false;
      }

      setOrders(fetchedOrders);
    });

    return () => unsubscribe();
  }, []);

  // อัปเดตสถานะออเดอร์
  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('ไม่สามารถอัปเดตสถานะออเดอร์ได้');
    }
  };

  // แยกรายการออเดอร์ที่ต้องทำในครัว (Pending & Cooking) และที่เสร็จแล้ว
  const activeOrders = orders.filter((o) => o.status === 'pending' || o.status === 'cooking');
  const finishedOrders = orders.filter((o) => o.status === 'completed' || o.status === 'cancelled').slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-2xl md:text-3xl font-black text-white">👨‍🍳 จอแสดงรายการอาหารห้องครัว</h1>
        </div>

        {/* แถบสถานะระบบเสียงเตือน */}
        <div className="flex items-center gap-3">
          {!soundEnabled ? (
            <button
              onClick={enableSound}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs md:text-sm shadow-lg animate-bounce flex items-center gap-2"
            >
              🔔 คลิกเปิดระบบเสียงแจ้งเตือน
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
              <span className="text-emerald-400 text-xs font-bold">🔊 ระบบเสียงเปิดใช้งานแล้ว</span>
              <button
                onClick={playAlertSound}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold px-2 py-1 rounded-lg"
              >
                ทดสอบเสียง
              </button>
            </div>
          )}
        </div>
      </header>

      {/* สรุปยอดออเดอร์ค้างทำ */}
      <div className="max-w-7xl mx-auto mb-6 flex gap-4">
        <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-xl flex items-center gap-3">
          <span className="text-2xl font-black text-amber-400">
            {orders.filter((o) => o.status === 'pending').length}
          </span>
          <span className="text-xs text-amber-200 font-bold">รอดำเนินการ (Pending)</span>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 px-4 py-2.5 rounded-xl flex items-center gap-3">
          <span className="text-2xl font-black text-blue-400">
            {orders.filter((o) => o.status === 'cooking').length}
          </span>
          <span className="text-xs text-blue-200 font-bold">กำลังปรุง (Cooking)</span>
        </div>
      </div>

      {/* Grid รายการออเดอร์ */}
      <div className="max-w-7xl mx-auto">
        {activeOrders.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/40 rounded-3xl border border-dashed border-slate-800">
            <p className="text-4xl mb-2">✨</p>
            <p className="text-slate-400 font-bold text-lg">ไม่มีรายการออเดอร์ค้างทำในขณะนี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrders.map((order) => {
              const isPending = order.status === 'pending';

              return (
                <div
                  key={order.id}
                  className={`bg-slate-800 rounded-2xl border transition-all shadow-xl overflow-hidden flex flex-col justify-between ${
                    isPending
                      ? 'border-amber-500 ring-2 ring-amber-500/50 animate-pulse'
                      : 'border-blue-500/50'
                  }`}
                >
                  {/* หัวการ์ดออเดอร์ */}
                  <div>
                    <div
                      className={`p-3.5 flex justify-between items-center ${
                        isPending ? 'bg-amber-500 text-slate-950' : 'bg-blue-600 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg">โต๊ะ {order.table}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/20">
                          {order.orderType}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold uppercase tracking-wider">
                        {isPending ? '🚨 ออเดอร์ใหม่!' : '🔥 กำลังทำ'}
                      </span>
                    </div>

                    {/* รายละเอียดลูกค้า (กรณีซื้อกลับบ้าน) */}
                    {order.customerContact && (
                      <div className="bg-slate-900/80 px-3.5 py-1.5 border-b border-slate-700/50 text-xs text-amber-300 font-bold">
                        👤 ลูกค้า: {order.customerContact}
                      </div>
                    )}

                    {/* รายการอาหาร */}
                    <div className="p-4 space-y-3">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-start border-b border-slate-700/40 pb-2.5 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="font-bold text-base text-slate-100">{item.name}</p>
                            {item.note && (
                              <p className="text-amber-400 text-xs font-semibold mt-0.5">
                                📝 {item.note}
                              </p>
                            )}
                          </div>
                          <span className="text-lg font-black text-amber-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                            x{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ปุ่มเปลี่ยนสถานะ */}
                  <div className="p-3.5 bg-slate-900/60 border-t border-slate-700/60 flex gap-2">
                    {isPending ? (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'cooking')}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-xl shadow-lg transition text-sm"
                      >
                        👨‍🍳 เริ่มปรุงอาหาร
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'completed')}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl shadow-lg transition text-sm"
                      >
                        ✅ ทำเสร็จแล้ว (ส่งเสิร์ฟ)
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('คุณต้องการยกเลิกออเดอร์นี้ใช่หรือไม่?')) {
                          handleUpdateStatus(order.id, 'cancelled');
                        }
                      }}
                      className="bg-slate-800 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 border border-rose-800/40 font-bold px-3 py-2.5 rounded-xl text-xs transition"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ประวัติออเดอร์ที่เสร็จแล้ว (แสดง 5 รายการล่าสุด) */}
      {finishedOrders.length > 0 && (
        <section className="max-w-7xl mx-auto mt-12 border-t border-slate-800 pt-6 opacity-60 hover:opacity-100 transition">
          <h2 className="text-sm font-bold text-slate-400 mb-3">🕒 รายการที่ทำเสร็จล่าสุด</h2>
          <div className="flex flex-wrap gap-2">
            {finishedOrders.map((o) => (
              <div
                key={o.id}
                className="bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"
              >
                <span className="font-bold text-slate-300">โต๊ะ {o.table}</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">{o.items.length} รายการ</span>
                <span className="text-emerald-400 font-bold">✓</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default function KitchenPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 bg-slate-900 min-h-screen">กำลังโหลดข้อมูลห้องครัว...</div>}>
      <KitchenContent />
    </Suspense>
  );
}