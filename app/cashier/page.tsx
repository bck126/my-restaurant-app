'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { db } from '../firebase'; 
import { collection, onSnapshot, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  itemStatus?: string;
  note?: string;
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

interface ServiceCall {
  id: string;
  table: string;
  status: 'pending' | 'resolved';
  createdAt?: any;
}

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeCalls, setActiveCalls] = useState<ServiceCall[]>([]);
  const [isAudioAllowed, setIsAudioAllowed] = useState(false);
  
  const isFirstLoadCalls = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 🔔 ฟังก์ชันสร้างเสียงกระดิ่ง "กริ๊งงงงงง" แบบลากยาว
  const playSingleChime = (ctx: AudioContext, startTime: number) => {
    const duration = 0.45;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(2000, ctx.currentTime + startTime);
    osc2.frequency.setValueAtTime(2400, ctx.currentTime + startTime);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(30, ctx.currentTime + startTime);
    lfoGain.gain.setValueAtTime(0.5, ctx.currentTime + startTime);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start(ctx.currentTime + startTime);
    lfo.stop(ctx.currentTime + startTime + duration);

    gain.gain.setValueAtTime(1.0, ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime + startTime);
    osc2.start(ctx.currentTime + startTime);
    osc1.stop(ctx.currentTime + startTime + duration);
    osc2.stop(ctx.currentTime + startTime + duration);
  };

  // 🔊 เล่นเสียงเตือน 3 ชุด (ชุดละ 3 ครั้ง)
  const playSuperLoudAlarm = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const pattern = [0.0, 0.5, 1.0, 2.0, 2.5, 3.0, 4.0, 4.5, 5.0];
      pattern.forEach((offset) => {
        playSingleChime(ctx, offset);
      });
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  };

  const handleEnableAudio = () => {
    setIsAudioAllowed(true);
    playSuperLoudAlarm();
  };

  // 1. ดึงรายการออเดอร์
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

  // 2. ดึงรายการ "เรียกพนักงาน" (serviceCalls) ที่ค้างอยู่ (status === 'pending')
  useEffect(() => {
    const qCall = query(
      collection(db, 'serviceCalls'),
      where('status', '==', 'pending')
    );

    const unsubscribeCalls = onSnapshot(qCall, (snapshot) => {
      if (isFirstLoadCalls.current) {
        isFirstLoadCalls.current = false;
      } else {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            console.log('🔔 มีการเรียกพนักงานใหม่!');
            playSuperLoudAlarm();
          }
        });
      }

      const calls = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ServiceCall[];

      setActiveCalls(calls);
    });

    return () => unsubscribeCalls();
  }, []);

  // ฟังก์ชันกดรับทราบการเรียกพนักงาน (ปิดการเรียกของโต๊ะนั้น)
  const handleResolveCall = async (callId: string) => {
    try {
      const callRef = doc(db, 'serviceCalls', callId);
      await updateDoc(callRef, { status: 'resolved' });
    } catch (error) {
      console.error('Error resolving service call:', error);
    }
  };

  // กรองเฉพาะออเดอร์ที่ยังไม่ได้จ่ายเงินและยังไม่ถูกยกเลิก
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
    <main className="p-6 bg-slate-100 min-h-screen relative">
      
      {/* 🚨 POPUP แจ้งเตือนเรียกพนักงาน (เด้งซ้อนบนสุด) */}
      {activeCalls.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-4 border-amber-500 text-center animate-bounce-short">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl animate-pulse">
              🔔
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-1">มีลูกค้าเรียกพนักงาน!</h2>
            <p className="text-sm text-slate-500 mb-6">กรุณาส่งพนักงานไปดูแลตามโต๊ะด้านล่างนี้</p>

            <div className="space-y-3 max-h-60 overflow-y-auto mb-6 pr-1">
              {activeCalls.map((call) => (
                <div
                  key={call.id}
                  className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="text-left">
                    <span className="text-xs text-amber-700 font-bold block">หมายเลขโต๊ะ</span>
                    <span className="text-2xl font-black text-amber-900">โต๊ะ {call.table}</span>
                  </div>
                  <button
                    onClick={() => handleResolveCall(call.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow-md transition"
                  >
                    ✓ รับทราบ / กำลังไป
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400">
              * เมื่อกด "รับทราบ" ป๊อปอัปจะปิดลง และระบบจะหยุดการเตือนสำหรับโต๊ะนั้น
            </p>
          </div>
        </div>
      )}

      {/* Header พร้อมแถบปลดล็อกเสียงเตือน */}
      <header className="max-w-7xl mx-auto space-y-4 mb-6">
        {!isAudioAllowed ? (
          <div className="bg-amber-500 text-white p-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-2 shadow-md animate-bounce">
            <span className="text-xs font-bold text-center sm:text-left">
              ⚠️ กรุณากดปุ่มเปิดระบบเสียงเตือน เพื่อรับเสียงแจ้งเตือนเมื่อมีการเรียกพนักงานหรือออเดอร์ใหม่
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
            <span>✅ เปิดระบบเสียงเตือนความดังสูงเรียบร้อยแล้ว</span>
            <button
              onClick={playSuperLoudAlarm}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded-lg text-[11px]"
            >
              🔊 ทดสอบเสียง
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">💵 จุดรับชำระเงิน (Cashier)</h1>
            <p className="text-sm text-slate-500">รายการสั่งอาหารและรับชำระเงิน</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/menu"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl shadow transition text-sm flex items-center gap-2"
            >
              ➕ เพิ่ม / จัดการเมนู
            </Link>
          </div>
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
                  <div className="p-3 space-y-2">
                    {order.items.map((item: any, idx: number) => {
                      const isCancelled = item.itemStatus === 'cancelled';

                      return (
                        <div
                          key={idx}
                          className={`flex justify-between items-center p-2.5 rounded-xl border text-xs transition ${
                            isCancelled
                              ? 'bg-red-50 border-red-200 text-red-400 opacity-70'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <div>
                            <div className={`font-bold ${isCancelled ? 'line-through' : ''}`}>
                              {item.name} <span className="font-black">x{item.quantity}</span>
                            </div>
                            {item.note && (
                              <div className="text-[10px] text-amber-600">
                                📝 {item.note}
                              </div>
                            )}
                            {isCancelled && (
                              <div className="text-[10px] text-red-500 font-bold mt-0.5">
                                ✕ ครัวยกเลิกรายการนี้แล้ว
                              </div>
                            )}
                          </div>

                          <div className={`font-bold ${isCancelled ? 'line-through text-red-400' : 'text-slate-700'}`}>
                            ฿{item.price * item.quantity}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ยอดรวม */}
                  <div className="flex justify-between items-center mt-3 text-lg font-black text-slate-900">
                    <span>ยอดรวมทั้งหมด:</span>
                    <span className="text-emerald-600">฿{order.totalPrice}</span>
                  </div>
                </div>

                {/* ปุ่มกดเก็บเงิน */}
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