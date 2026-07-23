'use client';

import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  imageUrl?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  note?: string;
}

export default function Home() {
  const [tableNo, setTableNo] = useState<string>('1');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  // State สำหรับหมวดหมู่และการใส่โน้ต
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [noteModalItem, setNoteModalItem] = useState<MenuItem | null>(null);
  const [customNote, setCustomNote] = useState<string>('');

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

  // รายการหมวดหมู่ทั้งหมดที่มีในระบบ
  const categories = ['ทั้งหมด', ...Array.from(new Set(menuItems.map((item) => item.category || 'อื่นๆ')))];

  // กรองเมนูตามหมวดหมู่ที่เลือก
  const filteredMenu = selectedCategory === 'ทั้งหมด' 
    ? menuItems 
    : menuItems.filter((item) => (item.category || 'อื่นๆ') === selectedCategory);

  // เปิด Modal ใส่โน้ตเมื่อกดเลือกเมนู
  const openNoteModal = (item: MenuItem) => {
    setNoteModalItem(item);
    setCustomNote('');
  };

  // ยืนยันเพิ่มสินค้าเข้าตะกร้าพร้อมโน้ต
  const confirmAddToCart = () => {
    if (!noteModalItem) return;

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.id === noteModalItem.id && i.note === customNote.trim()
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }

      return [
        ...prev,
        { ...noteModalItem, quantity: 1, note: customNote.trim() }
      ];
    });

    setNoteModalItem(null);
    setCustomNote('');
  };

  // ลดจำนวนสินค้าในตะกร้า
  const handleRemove = (id: string, note?: string) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id && i.note === note) {
            return { ...i, quantity: i.quantity - 1 };
          }
          return i;
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // ส่งออเดอร์เข้า Firebase
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
    <main className="min-h-screen bg-slate-100 p-4 pb-36 text-slate-800 max-w-md mx-auto">
      {/* Header */}
      <header className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 text-center mb-4">
        <div className="flex justify-center items-center py-1">
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

      {/* แถบเลือกหมวดหมู่ (Categories) */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
              selectedCategory === cat
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* รายการเมนูอาหาร */}
      <div className="space-y-3">
        {filteredMenu.map((item) => {
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

              <button
                type="button"
                onClick={() => openNoteModal(item)}
                className="bg-emerald-600 active:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition cursor-pointer"
              >
                + เพิ่ม
              </button>
            </div>
          );
        })}

        {filteredMenu.length === 0 && (
          <p className="text-center py-10 text-slate-400">ยังไม่มีรายการอาหารในหมวดหมู่นี้</p>
        )}
      </div>

      {/* Pop-up สำหรับระบุรายละเอียด/โน้ตพิเศษ */}
      {noteModalItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-slate-900 border-b pb-2">
              ระบุรายละเอียด: {noteModalItem.name}
            </h3>
            
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">
                โน้ตถึงห้องครัว (เช่น เผ็ดน้อย, ไม่ใส่ปลาร้า)
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="ระบุความต้องการพิเศษ..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setNoteModalItem(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmAddToCart}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-md"
              >
                ยืนยันเพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* แถบสรุปตะกร้าและสั่งอาหารด้านล่าง */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl max-w-md mx-auto z-40">
          {/* สรุปรายการในตะกร้าแบบย่อ */}
          <div className="max-h-28 overflow-y-auto mb-3 space-y-1.5 pr-1">
            {cart.map((c, index) => (
              <div key={index} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg">
                <div className="flex-1 pr-2">
                  <span className="font-bold text-slate-800">{c.name}</span>
                  {c.note && <span className="text-emerald-600 font-medium ml-1.5">({c.note})</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">x{c.quantity}</span>
                  <span className="font-bold text-slate-600">{(c.price * c.quantity)}฿</span>
                  <button 
                    onClick={() => handleRemove(c.id, c.note)}
                    className="text-red-500 font-black px-1.5 py-0.5 bg-red-50 rounded"
                  >
                    -
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center border-t pt-2">
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
            >
              {loading ? 'กำลังส่ง...' : '🚀 สั่งอาหาร'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}