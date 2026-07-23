'use client';

import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

export default function Home() {
  const [tableNo, setTableNo] = useState<string>('1');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. ดึงเลขโต๊ะจาก URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const table = params.get('table');
      if (table) setTableNo(table);
    }
  }, []);

  // 2. ดึงรายการเมนูจาก Firebase
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

  // เพิ่มสินค้าเข้าตะกร้า
  const handleAdd = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  // ลดสินค้า
  const handleRemove = (id: string) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // ส่งออเดอร์
  const handleSubmit = async () => {
    if (cart.length === 0) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        orderType: 'DINE_IN',
        tableNo,
        items: cart,
        totalPrice,
        status: 'PENDING',
        createdAt: serverTimestamp(),
      });

      alert(`สั่งอาหารโต๊ะ ${tableNo} เรียบร้อยแล้วครับ!`);
      setCart([]);
    } catch (error) {
      console.error('Order Error:', error);
      alert('เกิดข้อผิดพลาดในการส่งออเดอร์');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 pb-32 text-slate-800 max-w-md mx-auto">
      {/* Header */}
      <header className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 text-center mb-5">
        <div className="flex justify-center items-center py-2">
          <img 
            src="/logo.png" 
            alt="ส้มตำริมเขื่อน" 
            className="h-24 w-auto object-contain" 
          />
        </div>
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-200 mt-2">
          <span>🍽️ ทานที่ร้าน</span>
          <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-md text-xs font-black">
            โต๊ะ {tableNo}
          </span>
        </div>
      </header>

      {/* เมนูอาหาร */}
      <h2 className="font-bold text-slate-700 mb-3 px-1 text-lg">รายการเมนู</h2>
      <div className="space-y-3">
        {menuItems.map((item) => {
          const cartItem = cart.find((c) => c.id === item.id);
          const qty = cartItem ? cartItem.quantity : 0;

          return (
            <div
              key={item.id}
              className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <img
                  src={item.imageUrl || 'https://placehold.co/150x150/e2e8f0/64748b?text=Food'}
                  alt={item.name}
                  className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-100"
                />
                <div>
                  <div className="font-bold text-slate-900 text-base">{item.name}</div>
                  <div className="text-emerald-600 font-bold text-sm mt-0.5">{item.price} บาท</div>
                </div>
              </div>

              {/* ปุ่มบวกลบ */}
              {qty > 0 ? (
                <div className="flex items-center gap-2.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="w-9 h-9 bg-white text-slate-800 font-black text-lg rounded-lg shadow-sm active:bg-slate-300 flex items-center justify-center cursor-pointer"
                    style={{ touchAction: 'manipulation' }}
                  >
                    -
                  </button>
                  <span className="font-black text-base w-4 text-center text-slate-900">{qty}</span>
                  <button
                    type="button"
                    onClick={() => handleAdd(item)}
                    className="w-9 h-9 bg-emerald-600 text-white font-black text-lg rounded-lg shadow-sm active:bg-emerald-700 flex items-center justify-center cursor-pointer"
                    style={{ touchAction: 'manipulation' }}
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAdd(item)}
                  className="bg-emerald-600 active:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition cursor-pointer"
                  style={{ touchAction: 'manipulation' }}
                >
                  + เพิ่ม
                </button>
              )}
            </div>
          );
        })}

        {menuItems.length === 0 && (
          <p className="text-center py-10 text-slate-400">ยังไม่มีเมนูอาหารในขณะนี้</p>
        )}
      </div>

      {/* แถบสรุปสั่งอาหารด้านล่าง */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl max-w-md mx-auto z-50">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                รวม {cart.reduce((a, b) => a + b.quantity, 0)} รายการ
              </div>
              <div className="text-2xl font-black text-emerald-600">{totalPrice} บาท</div>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-emerald-600 active:bg-emerald-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg transition disabled:opacity-50 text-base cursor-pointer"
              style={{ touchAction: 'manipulation' }}
            >
              {loading ? 'กำลังส่ง...' : '🚀 สั่งอาหาร'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}