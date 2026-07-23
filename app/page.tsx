'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  note?: string;
}

function MenuContent() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get('table');

  // State สำหรับประเภทการสั่ง (ทานที่ร้าน / ซื้อกลับบ้าน)
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [tableNo, setTableNo] = useState<string>(tableParam || '1');
  const [customerName, setCustomerName] = useState<string>('');

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (tableParam) {
      setTableNo(tableParam);
      setOrderType('dine-in');
    }
  }, [tableParam]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'menu'), (snapshot) => {
      const items: MenuItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as MenuItem);
      });
      setMenuItems(items);
    });
    return () => unsubscribe();
  }, []);

  const categories = ['ทั้งหมด', ...Array.from(new Set(menuItems.map((i) => i.category || 'ทั่วไป')))];

  const filteredItems = selectedCategory === 'ทั้งหมด' 
    ? menuItems 
    : menuItems.filter((item) => (item.category || 'ทั่วไป') === selectedCategory);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSendOrder = async () => {
    if (cart.length === 0) return;

    if (orderType === 'takeaway' && !customerName.trim()) {
      alert('กรุณากรอกชื่อลูกค้าสำหรับออเดอร์ซื้อกลับบ้านครับ');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'orders'), {
        orderType, // 'dine-in' หรือ 'takeaway'
        tableNo: orderType === 'dine-in' ? tableNo : 'กลับบ้าน',
        customerName: orderType === 'takeaway' ? customerName.trim() : `โต๊ะ ${tableNo}`,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          note: item.note || '',
        })),
        totalPrice,
        status: 'pending', // pending, completed, cancelled
        createdAt: serverTimestamp(),
      });

      alert(orderType === 'takeaway' ? `ส่งออเดอร์ซื้อกลับบ้านของคุณ "${customerName}" เรียบร้อยแล้ว!` : `ส่งออเดอร์ โต๊ะ ${tableNo} เรียบร้อยแล้ว!`);
      setCart([]);
      setIsCartOpen(false);
      if (orderType === 'takeaway') setCustomerName('');
    } catch (error) {
      console.error('Order Error:', error);
      alert('เกิดข้อผิดพลาดในการส่งออเดอร์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 pb-28 max-w-md mx-auto relative shadow-2xl">
      {/* Header & การเลือกรูปแบบการสั่ง */}
      <header className="bg-white p-4 sticky top-0 z-10 border-b border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="font-black text-xl text-slate-900">🍽️ เมนูอาหาร</h1>
            <p className="text-xs text-slate-500">เลือกรายการอาหารที่คุณชอบได้เลย</p>
          </div>
        </div>

        {/* ปุ่มสลับ ทานที่ร้าน / ซื้อกลับบ้าน */}
        <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 mb-3">
          <button
            type="button"
            onClick={() => setOrderType('dine-in')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              orderType === 'dine-in' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            🪑 ทานที่ร้าน (โต๊ะ {tableNo})
          </button>
          <button
            type="button"
            onClick={() => setOrderType('takeaway')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              orderType === 'takeaway' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            🛍️ ซื้อกลับบ้าน
          </button>
        </div>

        {/* ช่องใส่ข้อมูลตามประเภทการสั่ง */}
        {orderType === 'dine-in' ? (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-100">
            <span>📍 ตำแหน่ง: โต๊ะที่ {tableNo}</span>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block">ชื่อลูกค้า / เบอร์โทรศัพท์ *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="กรอกชื่อลูกค้า เช่น คุณสมชาย / 081-xxx"
              className="w-full px-3 py-2 bg-slate-50 border border-emerald-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
            />
          </div>
        )}
      </header>

      {/* หมวดหมู่ */}
      <nav className="flex gap-2 overflow-x-auto p-4 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
              selectedCategory === cat ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* รายการอาหาร */}
      <div className="px-4 space-y-3">
        {filteredItems.map((item) => (
          <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex gap-3 items-center">
            <img
              src={item.imageUrl || 'https://placehold.co/150x150/e2e8f0/64748b?text=Food'}
              alt={item.name}
              className="w-20 h-20 rounded-xl object-cover bg-slate-100 border border-slate-100"
            />
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{item.category || 'ทั่วไป'}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="font-black text-emerald-600 text-base">{item.price} ฿</span>
                <button
                  onClick={() => addToCart(item)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-xl text-xs active:scale-95 transition"
                >
                  + เพิ่ม
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs">ไม่มีรายการอาหารในหมวดหมู่นี้</div>
        )}
      </div>

      {/* แถบตะกร้าสินค้าด้านล่าง */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-0 right-0 max-w-md mx-auto px-4 z-20">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-emerald-600 active:bg-emerald-700 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center font-bold text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="bg-emerald-800 px-2.5 py-1 rounded-xl text-xs">{totalItems}</span>
              <span>ดูตะกร้าของคุณ</span>
            </div>
            <span>รวม {totalPrice} ฿</span>
          </button>
        </div>
      )}

      {/* Popup ตะกร้าสินค้า */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-black text-lg text-slate-900">🛒 รายการสั่งซื้อ</h2>
                <p className="text-xs text-emerald-600 font-bold">
                  {orderType === 'dine-in' ? `🪑 ทานที่ร้าน (โต๊ะ ${tableNo})` : `🛍️ ซื้อกลับบ้าน (${customerName || 'ไม่ระบุชื่อ'})`}
                </p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400 font-bold text-sm p-1">✕</button>
            </div>

            {/* รายการในตะกร้า */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                  <div>
                    <div className="font-bold text-sm text-slate-800">{item.name}</div>
                    <div className="text-xs text-emerald-600 font-bold">{item.price * item.quantity} ฿</div>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 font-bold text-slate-500">-</button>
                    <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 font-bold text-emerald-600">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div className="flex justify-between items-center font-black text-base">
                <span>ราคารวมทั้งหมด</span>
                <span className="text-emerald-600 text-xl">{totalPrice} ฿</span>
              </div>

              <button
                onClick={handleSendOrder}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-emerald-600 active:bg-emerald-700 text-white font-black rounded-2xl shadow-lg transition disabled:opacity-50"
              >
                {isSubmitting ? 'กำลังส่งออเดอร์...' : '🚀 ยืนยันสั่งอาหาร'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-xs text-slate-400">กำลังโหลด...</div>}>
      <MenuContent />
    </Suspense>
  );
}