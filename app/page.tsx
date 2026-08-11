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
  paymentStatus?: string;
  isPaid?: boolean;
}

function MenuContent() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get('table') || '1';

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // สถานะการเปลี่ยน Tab ด้านล่าง: 'menu' | 'cart' | 'bill'
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'bill'>('menu');

  // สถานะการสั่งทานที่ร้าน / ซื้อกลับบ้าน
  const [orderType, setOrderType] = useState<'ทานที่ร้าน' | 'ซื้อกลับบ้าน'>('ทานที่ร้าน');
  const [customerContact, setCustomerContact] = useState<string>('');

  // State สำหรับ Modal ป๊อปอัปเลือกเมนู
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalNote, setModalNote] = useState<string>('');

  // รายการออเดอร์ที่สั่งเข้าครัวไปแล้ว (Active Orders)
  const [activeOrders, setActiveOrders] = useState<SubmittedOrder[]>([]);

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

  // 2. ดึงข้อมูลออเดอร์ที่โต๊ะนี้สั่งไปแล้ว (Realtime) - แก้ไขการ Mapping ป้องกันหน้าสรุปบิลค้าง
  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('table', '==', String(tableParam))
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const fetchedOrders: SubmittedOrder[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const isPaid = data.paymentStatus === 'paid' || data.isPaid === true;

            // คืนค่าเฉพาะฟิลด์ที่ต้องการ ป้องกันปัญหาเกี่ยวกับ Firestore Timestamp Object
            return {
              id: doc.id,
              table: String(data.table || ''),
              orderType: data.orderType || 'ทานที่ร้าน',
              items: Array.isArray(data.items) ? data.items : [],
              totalPrice: Number(data.totalPrice) || 0,
              status: data.status || 'pending',
              paymentStatus: data.paymentStatus || 'unpaid',
              isPaid: isPaid,
            };
          })
          .filter((order) => !order.isPaid); // ดึงเฉพาะออเดอร์ที่ยังไม่จ่ายเงิน

        setActiveOrders(fetchedOrders);
      },
      (error) => {
        console.error('Error fetching active orders:', error);
      }
    );

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

  // เลื่อนหน้าจอไปยังหมวดหมู่ที่เลือก
  const handleCategoryClick = (cat: string) => {
    setSelectedCategory(cat);
    if (cat === 'ทั้งหมด') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const targetElement = document.getElementById(`category-${cat}`);
      if (targetElement) {
        const headerOffset = 110;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
    }
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // คำนวณราคารวมของออเดอร์ที่สั่งแล้ว โดยข้ามรายการที่ถูกยกเลิก (cancelled)
  const totalSubmittedPrice = activeOrders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + (order.totalPrice || 0), 0);

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
        table: String(tableParam),
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
        paymentStatus: 'unpaid',
        isPaid: false,
        createdAt: serverTimestamp(),
      });

      setCart([]);
      setCustomerContact('');
      setOrderSuccess(true);
      setActiveTab('menu');
      setTimeout(() => setOrderSuccess(false), 4000);
    } catch (error) {
      console.error('Error sending order:', error);
      alert('เกิดข้อผิดพลาดในการส่งออเดอร์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ฟังก์ชันเรียกพนักงาน
  const handleCallStaff = async () => {
    if (confirm(`เรียกพนักงานมาที่ โต๊ะ ${tableParam} หรือไม่?`)) {
      try {
        await addDoc(collection(db, 'notifications'), {
          table: String(tableParam),
          type: 'call_staff',
          message: `โต๊ะ ${tableParam} เรียกพนักงาน`,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        alert('ส่งสัญญาณเรียกพนักงานเรียบร้อยแล้วครับ กรุณารอสักครู่');
      } catch (err) {
        console.error('Error calling staff:', err);
        alert('เกิดข้อผิดพลาดในการเรียกพนักงาน');
      }
    }
  };

  const availableCategories = Array.from(new Set(menuItems.map((i) => i.category || 'ทั่วไป')));
  const categoriesNav = ['ทั้งหมด', ...availableCategories];

  const groupedMenuItems = availableCategories.reduce((acc, category) => {
    acc[category] = menuItems.filter((i) => (i.category || 'ทั่วไป') === category);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <main className="min-h-screen bg-slate-50 pb-28">
      {/* Header */}
      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-slate-200">
        <div className="max-w-xl mx-auto px-3 py-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="โลโก้ ร้านค้า"
                className="h-12 w-auto object-contain drop-shadow-md"
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
                    ? 'bg-amber-500 text-white shadow-xs'
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
        {activeTab === 'menu' && (
          <div className="bg-slate-100/90 backdrop-blur-xs border-t border-slate-200 px-3 py-1.5 overflow-x-auto flex gap-1.5 no-scrollbar">
            <div className="max-w-3xl mx-auto flex gap-1.5 w-full">
              {categoriesNav.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* แจ้งเตือนสั่งสำเร็จ */}
      {orderSuccess && (
        <div className="max-w-xl mx-auto p-3 m-3 bg-emerald-500 text-white text-center font-bold rounded-xl shadow-md animate-bounce text-xs">
          🎉 สั่งอาหารเรียบร้อยแล้ว! ห้องครัวกำลังจัดเตรียมอาหารให้ครับ
        </div>
      )}

      {/* ================= TAB 1: รายการอาหาร (MENU) ================= */}
      {activeTab === 'menu' && (
        <div className="max-w-3xl mx-auto p-3 space-y-6">
          {availableCategories.map((category) => {
            const items = groupedMenuItems[category] || [];
            if (items.length === 0) return null;

            return (
              <section key={category} id={`category-${category}`} className="space-y-3">
                <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-1.5 pt-2">
                  <div className="w-2 h-5 bg-amber-500 rounded-full"></div>
                  <h2 className="font-black text-slate-800 text-base">{category}</h2>
                  <span className="text-xs text-slate-400 font-medium">({items.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((item) => {
                    const qtyInCart = getItemQuantityInCart(item.id);
                    const isSelected = qtyInCart > 0;

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl p-3 shadow-xs border transition flex gap-3 relative overflow-hidden ${
                          isSelected ? 'border-amber-500 bg-amber-50/30 ring-1 ring-amber-400/50' : 'border-slate-200 hover:border-amber-400'
                        }`}
                      >
                        <div className="relative w-20 h-20 flex-shrink-0 cursor-pointer" onClick={() => handleOpenModal(item)}>
                          {item.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-xl" />
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

                        <div className="flex-1 flex flex-col justify-between">
                          <div className="cursor-pointer" onClick={() => handleOpenModal(item)}>
                            <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {isSelected ? 'แตะเพิ่มโน้ต/จำนวนเพิ่ม' : 'แตะเพื่อระบุโน้ต/สั่งซื้อ'}
                            </p>
                          </div>

                          <div className="flex justify-between items-end mt-2">
                            <span className="text-amber-600 font-black text-base">฿{item.price}</span>

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
                                <span className="text-amber-900 font-black text-xs px-1">{qtyInCart}</span>
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
                                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold w-8 h-8 rounded-lg shadow-xs flex items-center justify-center text-lg active:scale-95 transition"
                              >
                                +
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
      )}

      {/* ================= TAB 2: ตะกร้าสินค้า (CART) ================= */}
      {activeTab === 'cart' && (
        <div className="max-w-2xl mx-auto p-4 animate-fade-in space-y-4">
          <h2 className="text-lg font-black text-slate-800 border-b pb-2 flex items-center gap-2">
            🛒 ตะกร้าของคุณ ({totalCartCount} รายการ)
          </h2>

          {cart.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300">
              <p className="text-4xl mb-2">🛒</p>
              <p className="text-slate-500 font-bold text-sm">ยังไม่มีรายการอาหารในตะกร้า</p>
              <button onClick={() => setActiveTab('menu')} className="mt-4 bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold">
                ไปเลือกเมนูอาหาร
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
                {cart.map((item) => (
                  <div key={item.cartItemId} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                      {item.note && <span className="text-amber-600 font-medium block text-[11px] mt-0.5">📝 {item.note}</span>}
                      <span className="text-slate-500 block text-xs mt-0.5">
                        ฿{item.price} x {item.quantity} = ฿{item.price * item.quantity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartQuantity(item.cartItemId, -1)} className="w-7 h-7 bg-slate-200 rounded-lg font-bold text-slate-700 text-sm flex items-center justify-center">
                        -
                      </button>
                      <span className="font-bold text-slate-800 text-sm w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.cartItemId, 1)} className="w-7 h-7 bg-amber-500 text-white rounded-lg font-bold text-sm flex items-center justify-center">
                        +
                      </button>
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-slate-800 font-bold">
                  <span>ราคารวมทั้งหมด</span>
                  <span className="text-lg font-black text-amber-600">฿{totalPrice}</span>
                </div>
              </div>

              <button
                onClick={handleSendOrder}
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3.5 rounded-2xl shadow-lg transition text-sm flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'กำลังส่งออเดอร์...' : '🚀 ยืนยันส่งออเดอร์เข้าครัว'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: สรุปบิล (BILL) ================= */}
      {activeTab === 'bill' && (
        <div className="max-w-2xl mx-auto p-4 animate-fade-in space-y-4">
          <h2 className="text-lg font-black text-slate-800 border-b pb-2 flex items-center gap-2">
            📄 สรุปรายการอาหารที่สั่ง (โต๊ะ {tableParam})
          </h2>

          {activeOrders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300">
              <p className="text-4xl mb-2">🍽️</p>
              <p className="text-slate-500 font-bold text-sm">ยังไม่มีรายการที่สั่งเข้าครัว</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((order, idx) => {
                const isCancelled = order.status === 'cancelled';

                return (
                  <div
                    key={order.id}
                    className={`bg-white p-4 rounded-2xl border shadow-xs space-y-2 transition ${
                      isCancelled ? 'border-red-200 bg-red-50/20' : 'border-amber-200/80'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-100 pb-2">
                      <span className={isCancelled ? 'text-slate-400 line-through' : 'text-amber-900'}>
                        รอบการสั่งที่ {idx + 1} ({order.orderType})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] ${
                          isCancelled
                            ? 'bg-red-100 text-red-700 font-bold'
                            : order.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : order.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isCancelled
                          ? '❌ ยกเลิกแล้ว'
                          : order.status === 'pending'
                          ? '⏳ ส่งห้องครัวแล้ว'
                          : order.status === 'completed'
                          ? '✅ เสิร์ฟแล้ว'
                          : '🔥 กำลังปรุงอาหาร'}
                      </span>
                    </div>

                    {/* รายการอาหารในออเดอร์ */}
                    <ul className="space-y-1.5 text-xs">
                      {order.items &&
                        order.items.map((item, itemIdx) => (
                          <li
                            key={itemIdx}
                            className={`flex justify-between ${
                              isCancelled ? 'text-slate-400 line-through' : 'text-slate-700'
                            }`}
                          >
                            <div>
                              <span className="font-bold">{item.name}</span>
                              <span> x{item.quantity}</span>
                              {item.note && (
                                <span
                                  className={`block text-[10px] ${
                                    isCancelled ? 'text-slate-400 line-through' : 'text-amber-700'
                                  }`}
                                >
                                  📝 {item.note}
                                </span>
                              )}
                            </div>
                            <span className={`font-bold ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                              ฿{item.price * item.quantity}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}

              <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-md flex justify-between items-center font-black">
                <span>ยอดรวมทั้งหมดที่สั่งแล้ว</span>
                <span className="text-xl">฿{totalSubmittedPrice}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal ระบุโน้ตอาหาร */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">{selectedItem.name}</h3>
                <p className="text-amber-600 font-black text-base">฿{selectedItem.price}</p>
              </div>
              <button onClick={handleCloseModal} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full font-bold flex items-center justify-center text-sm">
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">✍️ รายละเอียดเพิ่มเติม / โน้ตกำกับ</label>
              <input
                type="text"
                placeholder="เช่น ไม่เผ็ด, ไม่ใส่ผัก, ขอรสหวาน"
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-700">จำนวนที่ต้องการเพิ่ม</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setModalQuantity((q) => Math.max(1, q - 1))} className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-slate-700 text-base">
                  -
                </button>
                <span className="font-black text-base text-slate-900 w-5 text-center">{modalQuantity}</span>
                <button onClick={() => setModalQuantity((q) => q + 1)} className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-slate-700 text-base">
                  +
                </button>
              </div>
            </div>

            <button onClick={handleAddToCartFromModal} className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold py-3 rounded-xl shadow-md transition text-xs flex justify-between px-5">
              <span>เพิ่มลงตะกร้า</span>
              <span>฿{selectedItem.price * modalQuantity}</span>
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-200/90 backdrop-blur-md border-t border-slate-300 z-40 px-2 py-1.5">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeTab === 'menu' ? 'bg-amber-500 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-[11px]">เมนู</span>
          </button>

          <button
            onClick={() => setActiveTab('cart')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition relative ${
              activeTab === 'cart' ? 'bg-amber-500 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {totalCartCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </div>
            <span className="text-[11px]">ตะกร้า</span>
          </button>

          <button onClick={handleCallStaff} className="flex flex-col items-center justify-center py-1.5 rounded-xl text-slate-600 hover:text-slate-900 font-medium transition active:scale-95">
            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-[11px]">เรียกพนักงาน</span>
          </button>

          <button
            onClick={() => setActiveTab('bill')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeTab === 'bill' ? 'bg-amber-500 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[11px]">สรุปบิล</span>
          </button>
        </div>
      </div>
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