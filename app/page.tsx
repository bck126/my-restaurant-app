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
  cartItemId: string; // ID สำหรับแยกรายการกรณีสั่งเมนูเดียวกันแต่คนละเงื่อนไข
  quantity: number;
  orderType: 'ทานที่ร้าน' | 'กลับบ้าน';
  note: string;
}

function MenuContent() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get('table') || '1';

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // State สำหรับ Modal ป๊อปอัปเลือกเมนู
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalOrderType, setModalOrderType] = useState<'ทานที่ร้าน' | 'กลับบ้าน'>('ทานที่ร้าน');
  const [modalNote, setModalNote] = useState<string>('');

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

  // เปิด Modal เมื่อแตะเลือกเมนู
  const handleOpenModal = (item: MenuItem) => {
    setSelectedItem(item);
    setModalQuantity(1);
    setModalOrderType('ทานที่ร้าน');
    setModalNote('');
  };

  // ปิด Modal
  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  // ยืนยันเพิ่มลงตะกร้าจาก Modal
  const handleAddToCartFromModal = () => {
    if (!selectedItem) return;

    const cartItemId = `${selectedItem.id}-${modalOrderType}-${modalNote.trim()}`;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.cartItemId === cartItemId);

      if (existingIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingIndex].quantity += modalQuantity;
        return newCart;
      } else {
        return [
          ...prevCart,
          {
            ...selectedItem,
            cartItemId,
            quantity: modalQuantity,
            orderType: modalOrderType,
            note: modalNote.trim(),
          },
        ];
      }
    });

    handleCloseModal();
  };

  // ปรับจำนวนรายการในตะกร้า
  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // รวมราคาทั้งหมด
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // ส่งออเดอร์เข้า Firestore
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
          orderType: item.orderType,
          note: item.note,
        })),
        totalPrice,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setCart([]);
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
  const filteredItems =
    selectedCategory === 'ทั้งหมด'
      ? menuItems
      : menuItems.filter((i) => (i.category || 'ทั่วไป') === selectedCategory);

  return (
    <main className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200 p-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo"
              className="h-10 object-contain"
              onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
            />
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
          <div
            key={item.id}
            onClick={() => handleOpenModal(item)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex gap-4 cursor-pointer hover:border-blue-400 active:scale-[0.99] transition"
          >
            {item.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-24 h-24 object-cover rounded-xl flex-shrink-0"
              />
            )}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">{item.name}</h3>
                <p className="text-xs text-slate-400 mt-1">แตะเพื่อเลือกรายละเอียด/สั่งซื้อ</p>
              </div>
              <div className="flex justify-between items-end mt-2">
                <span className="text-blue-600 font-black text-lg">฿{item.price}</span>
                <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                  + สั่งซื้อ
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= Pop-up / Modal เลือกรายละเอียดอาหาร ================= */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* หัวข้อ Modal */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedItem.name}</h3>
                <p className="text-blue-600 font-black text-lg">฿{selectedItem.price}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full font-bold flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* ตัวเลือก: ทานที่ร้าน / กลับบ้าน */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">รูปแบบการทาน *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setModalOrderType('ทานที่ร้าน')}
                  className={`py-3 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition ${
                    modalOrderType === 'ทานที่ร้าน'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  🍽️ ทานที่ร้าน
                </button>
                <button
                  type="button"
                  onClick={() => setModalOrderType('กลับบ้าน')}
                  className={`py-3 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition ${
                    modalOrderType === 'กลับบ้าน'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  🛍️ สั่งกลับบ้าน
                </button>
              </div>
            </div>

            {/* ช่องกรอกโน้ต */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                รายละเอียดเพิ่มเติม / โน้ตกำกับ
              </label>
              <input
                type="text"
                placeholder="เช่น ไม่เผ็ด, ไม่ใส่ผัก, ขอรสหวาน, เผ็ดน้อย"
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* ปรับจำนวน */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-bold text-slate-700">จำนวน</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-slate-700 text-lg"
                >
                  -
                </button>
                <span className="font-black text-lg text-slate-900 w-6 text-center">
                  {modalQuantity}
                </span>
                <button
                  onClick={() => setModalQuantity((q) => q + 1)}
                  className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-slate-700 text-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* ปุ่มยืนยันใส่ตะกร้า */}
            <button
              onClick={handleAddToCartFromModal}
              className="w-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold py-3.5 rounded-2xl shadow-lg transition text-sm flex justify-between px-6"
            >
              <span>ใส่ตะกร้า</span>
              <span>฿{selectedItem.price * modalQuantity}</span>
            </button>
          </div>
        </div>
      )}

      {/* ตะกร้าสินค้า Floating ด้านล่าง */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-2xl z-20">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {cart.map((item) => (
                <div
                  key={item.cartItemId}
                  className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{item.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          item.orderType === 'กลับบ้าน'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {item.orderType}
                      </span>
                    </div>
                    {item.note && (
                      <span className="text-amber-600 font-medium block text-[11px] mt-0.5">
                        📝 {item.note}
                      </span>
                    )}
                    <span className="text-slate-500 mt-0.5 block">
                      ฿{item.price} x {item.quantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartQuantity(item.cartItemId, -1)}
                      className="w-6 h-6 bg-slate-200 rounded-lg font-bold text-slate-700"
                    >
                      -
                    </button>
                    <span className="font-bold text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.cartItemId, 1)}
                      className="w-6 h-6 bg-slate-200 rounded-lg font-bold text-slate-700"
                    >
                      +
                    </button>
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