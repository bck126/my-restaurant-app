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
  cartItemId: string;
  quantity: number;
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

  // สถานะการสั่งทานที่ร้าน / ซื้อกลับบ้าน
  const [orderType, setOrderType] = useState<'ทานที่ร้าน' | 'ซื้อกลับบ้าน'>('ทานที่ร้าน');
  const [customerContact, setCustomerContact] = useState<string>('');

  // State สำหรับ Modal ป๊อปอัปเลือกเมนู
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number>(1);
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
    setModalNote('');
  };

  // ปิด Modal
  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  // ยืนยันเพิ่มลงตะกร้าจาก Modal
  const handleAddToCartFromModal = () => {
    if (!selectedItem) return;

    const cartItemId = `${selectedItem.id}-${modalNote.trim()}`;

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

    if (orderType === 'ซื้อกลับบ้าน' && !customerContact.trim()) {
      alert('⚠️ กรุณาระบุชื่อลูกค้า หรือ เบอร์โทรศัพท์ สำหรับการสั่งซื้อกลับบ้านครับ');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'orders'), {
        table: tableParam,
        orderType: orderType,
        customerContact: orderType === 'ซื้อกลับบ้าน' ? customerContact.trim() : '',
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          note: item.note,
        })),
        totalPrice,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setCart([]);
      setCustomerContact('');
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
      {/* Header + แถบหมวดหมู่ แบบ Sticky ตรึงอยู่ด้านบนสุดตลอดการ Scroll */}
      <header className="bg-white sticky top-0 z-30 shadow-md border-b border-slate-200">
        <div className="max-w-xl mx-auto p-4 flex flex-col items-center gap-3">
          {/* แถวที่ 1: โลโก้ร้าน (ปรับขยายขนาดใหญ่เด่นชัด) */}
          <div className="h-20 flex items-center justify-center pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="โลโก้ ส้มตำ ริมเขื่อน"
              className="max-h-20 w-auto object-contain drop-shadow-md"
              onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
            />
          </div>

          {/* แถวที่ 2: ชื่อโต๊ะ */}
          <div className="bg-slate-900 text-white font-black px-6 py-1.5 rounded-full text-sm shadow-sm tracking-wide">
            โต๊ะ {tableParam}
          </div>

          {/* แถวที่ 3: ปุ่มเลือก ทานที่ร้าน / ซื้อกลับบ้าน */}
          <div className="w-full grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setOrderType('ทานที่ร้าน')}
              className={`py-2 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                orderType === 'ทานที่ร้าน'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🍽️ ทานที่ร้าน
            </button>
            <button
              type="button"
              onClick={() => setOrderType('ซื้อกลับบ้าน')}
              className={`py-2 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                orderType === 'ซื้อกลับบ้าน'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛍️ ซื้อกลับบ้าน
            </button>
          </div>

          {/* ช่องกรอกชื่อ/เบอร์โทร (จะแสดงเมื่อเลือก ซื้อกลับบ้าน) */}
          {orderType === 'ซื้อกลับบ้าน' && (
            <div className="w-full animate-fade-in">
              <input
                type="text"
                placeholder="👤 ระบุชื่อ หรือ เบอร์โทรศัพท์ลูกค้า (จำเป็น)*"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                className="w-full px-4 py-2 bg-amber-50/80 border-2 border-amber-300 rounded-xl text-xs font-bold text-slate-800 placeholder-amber-700/60 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* แถบหมวดหมู่อาหาร (ล็อก Sticky ค้างไว้ใต้ Header) */}
        <div className="bg-slate-100/90 backdrop-blur-xs border-t border-slate-200 p-3 overflow-x-auto flex gap-2 no-scrollbar">
          <div className="max-w-3xl mx-auto flex gap-2 w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* แจ้งเตือนสั่งสำเร็จ */}
      {orderSuccess && (
        <div className="max-w-xl mx-auto p-4 m-4 bg-emerald-500 text-white text-center font-bold rounded-2xl shadow-lg animate-bounce text-sm">
          🎉 สั่งอาหารเรียบร้อยแล้ว! ห้องครัวกำลังจัดเตรียมอาหารให้ครับ
        </div>
      )}

      {/* รายการอาหาร */}
      <div className="max-w-3xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => handleOpenModal(item)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex gap-4 cursor-pointer hover:border-blue-400 active:scale-[0.99] transition"
          >
            {item.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-24 h-24 object-cover rounded-xl flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-sm flex-shrink-0">
                Food
              </div>
            )}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">{item.name}</h3>
                <p className="text-xs text-slate-400 mt-1">แตะเพื่อระบุโน้ต/สั่งซื้อ</p>
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

      {/* ================= Pop-up / Modal ระบุโน้ตอาหาร ================= */}
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

            {/* ช่องกรอกโน้ต */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                ✍️ รายละเอียดเพิ่มเติม / โน้ตกำกับ
              </label>
              <input
                type="text"
                placeholder="เช่น ไม่เผ็ด, ไม่ใสผัก, ขอรสหวาน, เผ็ดน้อย"
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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-2xl z-40">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {cart.map((item) => (
                <div
                  key={item.cartItemId}
                  className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{item.name}</span>
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
                <p className="text-xs text-slate-500">ราคารวม ({orderType})</p>
                <p className="text-xl font-black text-blue-600">฿{totalPrice}</p>
              </div>
              <button
                onClick={handleSendOrder}
                disabled={isSubmitting}
                className={`font-black px-6 py-3 rounded-xl shadow-md transition text-sm text-white disabled:opacity-50 ${
                  orderType === 'ซื้อกลับบ้าน'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
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