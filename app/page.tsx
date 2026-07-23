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
  const tableParam = searchParams.get('table') || '1';

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // ดึงข้อมูลเมนูอาหารจาก Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'menu'), (snapshot) => {
      const items: MenuItem[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MenuItem[];
      setMenuItems(items);
    });
    return () => unsub();
  }, []);

  // จัดการโน้ตความต้องการพิเศษ
  const handleNoteChange = (id: string, noteText: string) => {
    setNotes((prev) => ({ ...prev, [id]: noteText }));
  };

  // เพิ่มลงตะกร้า
  const addToCart = (item: MenuItem) => {
    const itemNote = notes[item.id] || '';
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (c) => c.id === item.id && (c.note || '') === itemNote
      );
      if (existingIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingIndex].quantity += 1;
        return newCart;
      } else {
        return [...prevCart, { ...item, quantity: 1, note: itemNote }];
      }
    });
  };

  // ปรับจำนวนในตะกร้า
  const updateQuantity = (id: string, note: string | undefined, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === id && item.note === note) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // รวมราคาทั้งหมด
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // ส่งออเดอร์
  const handleSendOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'orders'), {
        table: tableParam,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          note: item.note || '',
        })),
        totalPrice,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setCart([]);
      setNotes({});
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 4000);
    } catch (error) {
      console.error('Error sending order:', error);
      alert('เกิดข้อผิดพลาดในการส่งออเดอร์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ['ทั้งหมด', ...Array.from(new Set(menuItems.map((i) => i.category || 'ทั่วไป')))];
  const filteredItems = selectedCategory === 'ทั้งหมด' 
    ? menuItems 
    : menuItems.filter((i) => (i.category || 'ทั่วไป') === selectedCategory);

  return (
    <main className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200 p-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className="h-10 object-contain" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
            <div>
              <h1 className="font-black text-slate-900 text-lg">ส้มตำ ริมเขื่อน</h1>
              <p className="text-xs text-slate-500">สั่งอาหารออนไลน์</p>
            </div>
          </div>
          <div className="bg-slate-900 text-white font-black px-4 py-1.5 rounded-full text-sm shadow-sm">
            โต๊ะ {tableParam}
          </div>
        </div>
      </header>

      {/* แจ้งเตือนสั่งสำเร็จ */}
      {orderSuccess && (
        <div className="max-w-3xl mx-auto p-4 m-4 bg-emerald-500 text-white text-center font-bold rounded-2xl shadow-lg animate-bounce">
          🎉 สั่งอาหารเรียบร้อยแล้ว! ห้องครัวกำลังจัดเตรียมอาหารให้ครับ
        </div>
      )}

      {/* หมวดหมู่ */}
      <div className="max-w-3xl mx-auto p-4 overflow-x-auto flex gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* รายการอาหาร */}
      <div className="max-w-3xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex gap-3">
              {item.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-xl flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className="font-bold text-slate-800">{item.name}</h3>
                <p className="text-blue-600 font-black mt-1">฿{item.price}</p>
              </div>
            </div>

            {/* ช่องพิมพ์ข้อความโน้ต (ไม่เผ็ด / ไม่ใส่ผัก ฯลฯ) */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <input
                type="text"
                placeholder="✍️ โน้ตเพิ่มเติม (เช่น ไม่เผ็ด, ไม่ใส่ผัก, รสหวาน)"
                value={notes[item.id] || ''}
                onChange={(e) => handleNoteChange(item.id, e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => addToCart(item)}
                className="w-full mt-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold py-2 rounded-xl text-xs transition shadow-sm"
              >
                + เพิ่มลงตะกร้า {notes[item.id] ? `(${notes[item.id]})` : ''}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ตะกร้าสินค้า Floating ด้านล่าง */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-2xl z-20">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {cart.map((c, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{c.name}</span>
                    {c.note && <span className="text-amber-600 font-medium block text-[11px]">📝 {c.note}</span>}
                    <span className="text-slate-500">฿{c.price} x {c.quantity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(c.id, c.note, -1)} className="w-6 h-6 bg-slate-200 rounded-lg font-bold text-slate-700">-</button>
                    <span className="font-bold text-slate-800">{c.quantity}</span>
                    <button onClick={() => updateQuantity(c.id, c.note, 1)} className="w-6 h-6 bg-slate-200 rounded-lg font-bold text-slate-700">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">ราคารวมทั้งหมด</p>
                <p className="text-xl font-black text-blue-600">฿{totalPrice}</p>
              </div>
              <button
                onClick={handleSendOrder}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black px-6 py-3 rounded-xl shadow-md transition text-sm disabled:opacity-50"
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

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">กำลังโหลดรายการอาหาร...</div>}>
      <MenuContent />
    </Suspense>
  );
}