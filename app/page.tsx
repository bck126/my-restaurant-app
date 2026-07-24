'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where } from 'firebase/firestore';

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

interface SubmittedOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

interface SubmittedOrder {
  id: string;
  table: string;
  orderType: string;
  items: SubmittedOrderItem[];
  totalPrice: number;
  status: string;
  createdAt?: any;
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

  // รายการออเดอร์ที่สั่งเข้าครัวไปแล้ว (Active Orders)
  const [activeOrders, setActiveOrders] = useState<SubmittedOrder[]>([]);
  const [showActiveOrdersList, setShowActiveOrdersList] = useState(true);

  // 1. ดึงข้อมูลเมนูอาหารจาก Firebase
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

  // 2. ดึงข้อมูลออเดอร์ที่โต๊ะนี้สั่งไปแล้ว (Realtime)
  useEffect(() => {
    const savedOrderIds: string[] = JSON.parse(localStorage.getItem(`table_${tableParam}_orders`) || '[]');

    if (savedOrderIds.length === 0) {
      setActiveOrders([]);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('table', '==', tableParam)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedOrders: SubmittedOrder[] = [];
      const currentActiveIds: string[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as SubmittedOrder;
        const orderId = doc.id;

        if (savedOrderIds.includes(orderId) && data.status !== 'completed' && data.status !== 'cancelled') {
          fetchedOrders.push({ id: orderId, ...data });
          currentActiveIds.push(orderId);
        }
      });

      localStorage.setItem(`table_${tableParam}_orders`, JSON.stringify(currentActiveIds));
      setActiveOrders(fetchedOrders);
    });

    return () => unsub();
  }, [tableParam]);

  // คำนวณจำนวนรวมของเมนูนั้นๆ ในตะกร้า
  const getItemQuantityInCart = (itemId: string) => {
    return cart
      .filter((item) => item.id === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

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

  // ลดจำนวนรวมของเมนูบนการ์ดเมนู
  const handleDecreaseItemFromCard = (itemId: string) => {
    const itemsInCart = cart.filter((item) => item.id === itemId);
    if (itemsInCart.length === 0) return;

    const targetCartItemId = itemsInCart[itemsInCart.length - 1].cartItemId;
    updateCartQuantity(targetCartItemId, -1);
  };

  // เลื่อนหน้าจอไปยังหมวดหมู่ที่เลือก ( Smooth Scroll โดยใช้ id )
  const handleCategoryClick = (cat: string) => {
    setSelectedCategory(cat);
    if (cat === 'ทั้งหมด') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const targetElement = document.getElementById(`category-${cat}`);
      if (targetElement) {
        const headerOffset = 110; // ชดเชยความสูง Header Sticky
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
    }
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalSubmittedPrice = activeOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);

  // ส่งออเดอร์เข้า Firestore
  const handleSendOrder = async () => {
    if (cart.length === 0) return;

    if (orderType === 'ซื้อกลับบ้าน' && !customerContact.trim()) {
      alert('⚠️ กรุณาระบุชื่อลูกค้า หรือ เบอร์โทรศัพท์ สำหรับการสั่งซื้อกลับบ้านครับ');
      return;
    }

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'orders'), {
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

      const savedOrderIds: string[] = JSON.parse(localStorage.getItem(`table_${tableParam}_orders`) || '[]');
      savedOrderIds.push(docRef.id);
      localStorage.setItem(`table_${tableParam}_orders`, JSON.stringify(savedOrderIds));

      setCart([]);
      setCustomerContact('');
      setOrderSuccess(true);
      setShowActiveOrdersList(true);
      setTimeout(() => setOrderSuccess(false), 4000);
    } catch (error) {
      console.error('Error sending order:', error);
      alert('เกิดข้อผิดพลาดในการส่งออเดอร์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ดึงหมวดหมู่ทั้งหมดแบบไม่ซ้ำ
  const availableCategories = Array.from(new Set(menuItems.map((i) => i.category || 'ทั่วไป')));
  const categoriesNav = ['ทั้งหมด', ...availableCategories];

  // จัดกลุ่มรายการอาหารตามหมวดหมู่
  const groupedMenuItems = availableCategories.reduce((acc, category) => {
    acc[category] = menuItems.filter((i) => (i.category || 'ทั่วไป') === category);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <main className="min-h-screen bg-slate-50 pb-32">
      {/* Header + หมวดหมู่ แบบ Sticky ด้านบน */}
      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-slate-200">
        <div className="max-w-xl mx-auto px-3 py-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="โลโก้ ร้านค้า"
                className="h-14 w-auto object-contain drop-shadow-md"
                onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
              />
              <span className="bg-slate-900 text-white font-black text-xs px-2.5 py-1 rounded-lg shadow-xs whitespace-nowrap">
                โต๊ะ {tableParam}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setOrderType('ทานที่ร้าน')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center justify-center gap-1 ${
                  orderType === 'ทานที่ร้าน'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🍽️ ทานที่ร้าน
              </button>
              <button
                type="button"
                onClick={() => setOrderType('ซื้อกลับบ้าน')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center justify-center gap-1 ${
                  orderType === 'ซื้อกลับบ้าน'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🛍️ กลับบ้าน
              </button>
            </div>
          </div>

          {orderType === 'ซื้อกลับบ้าน' && (
            <div className="w-full animate-fade-in">
              <input
                type="text"
                placeholder="👤 ระบุชื่อ หรือ เบอร์โทรศัพท์ลูกค้า (จำเป็น)*"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                className="w-full px-3 py-1.5 bg-amber-50/90 border border-amber-300 rounded-lg text-xs font-bold text-slate-800 placeholder-amber-700/60 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* แถบหมวดหมู่อาหาร */}
        <div className="bg-slate-100/90 backdrop-blur-xs border-t border-slate-200 px-3 py-1.5 overflow-x-auto flex gap-1.5 no-scrollbar">
          <div className="max-w-3xl mx-auto flex gap-1.5 w-full">
            {categoriesNav.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs'
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
        <div className="max-w-xl mx-auto p-3 m-3 bg-emerald-500 text-white text-center font-bold rounded-xl shadow-md animate-bounce text-xs">
          🎉 สั่งอาหารเรียบร้อยแล้ว! ห้องครัวกำลังจัดเตรียมอาหารให้ครับ
        </div>
      )}

      {/* ================= กล่องแสดงรายการที่ส่งเข้าครัวไปแล้ว (Active Orders) ================= */}
      {activeOrders.length > 0 && (
        <div className="max-w-3xl mx-auto px-3 pt-3">
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300/80 rounded-2xl p-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <h2 className="font-black text-slate-800 text-xs sm:text-sm">
                  🍳 รายการที่สั่งเข้าครัวแล้ว ({activeOrders.reduce((acc, o) => acc + o.items.reduce((iAcc, item) => iAcc + item.quantity, 0), 0)} รายการ)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-800 font-black text-xs">
                  รวม ฿{totalSubmittedPrice}
                </span>
                <button
                  onClick={() => setShowActiveOrdersList(!showActiveOrdersList)}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline"
                >
                  {showActiveOrdersList ? 'ซ่อน' : 'ดูรายการ'}
                </button>
              </div>
            </div>

            {showActiveOrdersList && (
              <div className="mt-2 space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {activeOrders.map((order, idx) => (
                  <div key={order.id} className="bg-white/80 backdrop-blur-xs p-2.5 rounded-xl border border-amber-200/60 text-xs">
                    <div className="flex justify-between items-center mb-1 text-[11px] font-bold text-amber-900 border-b border-slate-100 pb-1">
                      <span>สั่งรอบที่ {idx + 1} ({order.orderType})</span>
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px]">
                        {order.status === 'pending' ? '⏳ ส่งห้องครัวแล้ว' : '🔥 กำลังปรุงอาหาร'}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {order.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex justify-between text-slate-700">
                          <div>
                            <span className="font-bold">{item.name}</span>
                            <span className="text-slate-500 font-medium"> x{item.quantity}</span>
                            {item.note && (
                              <span className="text-amber-700 font-normal text-[10px] block">
                                📝 {item.note}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-slate-900">฿{item.price * item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= รายการอาหาร แสดงแยกตามหมวดหมู่ต่อเนื่อง ================= */}
      <div className="max-w-3xl mx-auto p-3 space-y-6">
        {availableCategories.map((category) => {
          const items = groupedMenuItems[category] || [];
          if (items.length === 0) return null;

          return (
            <section
              key={category}
              id={`category-${category}`}
              className="space-y-3"
            >
              {/* หัวข้อหมวดหมู่ */}
              <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-1.5 pt-2">
                <div className="w-2 h-5 bg-blue-600 rounded-full"></div>
                <h2 className="font-black text-slate-800 text-base">{category}</h2>
                <span className="text-xs text-slate-400 font-medium">({items.length})</span>
              </div>

              {/* การ์ดรายการอาหารในหมวดหมู่ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((item) => {
                  const qtyInCart = getItemQuantityInCart(item.id);
                  const isSelected = qtyInCart > 0;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl p-3 shadow-xs border transition flex gap-3 relative overflow-hidden ${
                        isSelected ? 'border-amber-500 bg-amber-50/30 ring-1 ring-amber-400/50' : 'border-slate-200 hover:border-blue-400'
                      }`}
                    >
                      {/* รูปภาพ */}
                      <div 
                        className="relative w-20 h-20 flex-shrink-0 cursor-pointer"
                        onClick={() => handleOpenModal(item)}
                      >
                        {item.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-20 h-20 object-cover rounded-xl"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xs">
                            Food
                          </div>
                        )}

                        {isSelected && (
                          <div className="absolute -top-1 -left-1 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg shadow-md animate-pulse">
                            ในตะกร้า x{qtyInCart}
                          </div>
                        )}
                      </div>

                      {/* ข้อมูลเมนู + ปุ่มควบคุม */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div 
                          className="cursor-pointer"
                          onClick={() => handleOpenModal(item)}
                        >
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {isSelected ? 'แตะเพิ่มโน้ต/จำนวนเพิ่ม' : 'แตะเพื่อระบุโน้ต/สั่งซื้อ'}
                          </p>
                        </div>

                        <div className="flex justify-between items-end mt-2">
                          <span className="text-blue-600 font-black text-base">฿{item.price}</span>

                          {isSelected ? (
                            <div className="flex items-center gap-1.5 bg-amber-100 p-1 rounded-xl border border-amber-200">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDecreaseItemFromCard(item.id);
                                }}
                                className="w-6 h-6 bg-white hover:bg-slate-100 text-amber-800 font-black rounded-lg text-xs shadow-xs flex items-center justify-center"
                              >
                                -
                              </button>
                              <span className="text-amber-900 font-black text-xs px-1">
                                {qtyInCart}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenModal(item);
                                }}
                                className="w-6 h-6 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-lg text-xs shadow-xs flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenModal(item)}
                              className="bg-slate-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xs hover:bg-slate-800 active:scale-95 transition"
                            >
                              + สั่งซื้อ
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* ================= Pop-up / Modal ระบุโน้ตอาหาร ================= */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">{selectedItem.name}</h3>
                <p className="text-blue-600 font-black text-base">฿{selectedItem.price}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full font-bold flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                ✍️ รายละเอียดเพิ่มเติม / โน้ตกำกับ
              </label>
              <input
                type="text"
                placeholder="เช่น ไม่เผ็ด, ไม่ใส่ผัก, ขอรสหวาน"
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-700">จำนวนที่ต้องการเพิ่ม</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-slate-700 text-base"
                >
                  -
                </button>
                <span className="font-black text-base text-slate-900 w-5 text-center">
                  {modalQuantity}
                </span>
                <button
                  onClick={() => setModalQuantity((q) => q + 1)}
                  className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-slate-700 text-base"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCartFromModal}
              className="w-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold py-3 rounded-xl shadow-md transition text-xs flex justify-between px-5"
            >
              <span>เพิ่มลงตะกร้า</span>
              <span>฿{selectedItem.price * modalQuantity}</span>
            </button>
          </div>
        </div>
      )}

      {/* ตะกร้าสินค้า Floating ด้านล่าง */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-2xl z-40">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {cart.map((item) => (
                <div
                  key={item.cartItemId}
                  className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{item.name}</span>
                    {item.note && (
                      <span className="text-amber-600 font-medium block text-[10px]">
                        📝 {item.note}
                      </span>
                    )}
                    <span className="text-slate-500 block text-[10px]">
                      ฿{item.price} x {item.quantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateCartQuantity(item.cartItemId, -1)}
                      className="w-5 h-5 bg-slate-200 rounded-md font-bold text-slate-700 text-xs"
                    >
                      -
                    </button>
                    <span className="font-bold text-slate-800 text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.cartItemId, 1)}
                      className="w-5 h-5 bg-slate-200 rounded-md font-bold text-slate-700 text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <div>
                <p className="text-[10px] text-slate-500">ราคารวมรอบนี้ ({orderType})</p>
                <p className="text-lg font-black text-blue-600">฿{totalPrice}</p>
              </div>
              <button
                onClick={handleSendOrder}
                disabled={isSubmitting}
                className={`font-black px-5 py-2.5 rounded-xl shadow-md transition text-xs text-white disabled:opacity-50 ${
                  orderType === 'ซื้อกลับบ้าน'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? 'กำลังส่ง...' : '🚀 ยืนยันสั่งอาหารเพิ่ม'}
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