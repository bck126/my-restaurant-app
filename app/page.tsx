'use client';
import MenuItemSelector, { Addon } from './MenuItemSelector';
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
  addons?: Addon[];
}

interface CartItem {
  id: string;
  cartItemId: string;
  name: string;
  price: number;
  basePrice: number;
  quantity: number;
  note: string;
  selectedAddons?: Addon[];
}

interface SubmittedOrderItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
  status?: string;
  itemStatus?: string;
  isCancelled?: boolean;
  selectedAddons?: Addon[];
}

interface SubmittedOrder {
  id: string;
  table: string | number;
  orderType: string;
  items: SubmittedOrderItem[];
  totalPrice: number;
  status: string;
  paymentStatus?: string;
  isPaid?: boolean;
}

// 🎯 ฟังก์ชันเช็กสถานะการยกเลิกให้ตรงกับฝั่ง Cashier 100%
const checkIsItemCancelled = (item: SubmittedOrderItem): boolean => {
  if (!item) return false;
  return (
    item.itemStatus === 'cancelled' ||
    item.status === 'cancelled' ||
    item.isCancelled === true
  );
};

function MenuContent() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get('table') || '1';

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'bill'>('menu');
  const [orderType, setOrderType] = useState<'ทานที่ร้าน' | 'ซื้อกลับบ้าน'>('ทานที่ร้าน');
  const [customerContact, setCustomerContact] = useState<string>('');

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const [activeOrders, setActiveOrders] = useState<SubmittedOrder[]>([]);

  // 1. ดึงข้อมูลเมนูอาหาร
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

  // 2. ดึงข้อมูลออเดอร์ของโต๊ะนี้
  useEffect(() => {
    const stringTable = String(tableParam);
    const numberTable = Number(tableParam);

    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const fetchedOrders: SubmittedOrder[] = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const isPaid = data.paymentStatus === 'paid' || data.isPaid === true;

          return {
            id: doc.id,
            table: data.table,
            orderType: data.orderType || 'ทานที่ร้าน',
            items: Array.isArray(data.items) ? data.items : [],
            totalPrice: Number(data.totalPrice) || 0,
            status: data.status || 'pending',
            paymentStatus: data.paymentStatus || 'unpaid',
            isPaid: isPaid,
          };
        })
        .filter((order) => {
          const isSameTable =
            String(order.table) === stringTable || order.table === numberTable;
          const isOrderCancelled = order.status === 'cancelled';

          return isSameTable && !order.isPaid && !isOrderCancelled;
        });

      setActiveOrders(fetchedOrders);
    });

    return () => unsub();
  }, [tableParam]);

  const getItemQuantityInCart = (itemId: string) => {
    return cart
      .filter((item) => item.id === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleOpenModal = (item: MenuItem) => {
    setSelectedItem(item);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  // 🎯 รับข้อมูลจาก MenuItemSelector และบันทึกลง ตะกร้า
  const handleAddToCartFromSelector = (orderData: {
    selectedAddons: Addon[];
    totalPrice: number;
    quantity: number;
    note?: string;
  }) => {
    if (!selectedItem) return;

    const addonsText = orderData.selectedAddons.map((a) => a.name).sort().join(',');
    const noteText = orderData.note ? orderData.note.trim() : '';
    const cartItemId = `${selectedItem.id}-${addonsText}-${noteText}`;

    // คำนวณราคาต่อหน่วย (รากฐาน + Addons)
    const unitPrice = orderData.totalPrice / orderData.quantity;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.cartItemId === cartItemId);

      if (existingIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingIndex].quantity += orderData.quantity;
        return newCart;
      } else {
        return [
          ...prevCart,
          {
            id: selectedItem.id,
            cartItemId,
            name: selectedItem.name,
            basePrice: selectedItem.price,
            price: unitPrice,
            quantity: orderData.quantity,
            note: noteText,
            selectedAddons: orderData.selectedAddons,
          },
        ];
      }
    });

    handleCloseModal();
  };

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

  const handleDecreaseItemFromCard = (itemId: string) => {
    const itemsInCart = cart.filter((item) => item.id === itemId);
    if (itemsInCart.length === 0) return;

    const targetCartItemId = itemsInCart[itemsInCart.length - 1].cartItemId;
    updateCartQuantity(targetCartItemId, -1);
  };

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

  // 🎯 คำนวณราคารวมใหม่ โดยหักรายการที่มี itemStatus === 'cancelled' ออก
  const totalSubmittedPrice = activeOrders.reduce((orderSum, order) => {
    const validItemsTotal = order.items.reduce((itemSum, item) => {
      const isCancelled = checkIsItemCancelled(item);
      return isCancelled ? itemSum : itemSum + item.price * item.quantity;
    }, 0);
    return orderSum + validItemsTotal;
  }, 0);

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
          selectedAddons: item.selectedAddons || [],
          status: 'pending',
          itemStatus: 'pending',
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

  // 🧾 ฟังก์ชันเรียกเช็คบิลส่งไปยังแคชเชียร์
  const handleCallBill = async () => {
    if (activeOrders.length === 0) {
      alert('ยังไม่มีรายการอาหารที่สั่งในบิลนี้ครับ');
      return;
    }

    if (confirm(`ยืนยันเรียกเช็คบิล (ยอดรวม ฿${totalSubmittedPrice}) สำหรับโต๊ะ ${tableParam} หรือไม่?`)) {
      try {
        await addDoc(collection(db, 'notifications'), {
          table: String(tableParam),
          type: 'call_bill',
          message: `โต๊ะ ${tableParam} เรียกเช็คบิล (ยอดรวม ฿${totalSubmittedPrice})`,
          totalAmount: totalSubmittedPrice,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        alert('ส่งสัญญาณเรียกเช็คบิลเรียบร้อยแล้วครับ กรุณารอสักครู่ พนักงานกำลังนำบิลมาให้');
      } catch (err) {
        console.error('Error calling bill:', err);
        alert('เกิดข้อผิดพลาดในการเรียกเช็คบิล กรุณาลองใหม่อีกครั้ง');
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

      {orderSuccess && (
        <div className="max-w-xl mx-auto p-3 m-3 bg-emerald-500 text-white text-center font-bold rounded-xl shadow-md animate-bounce text-xs">
          🎉 สั่งอาหารเรียบร้อยแล้ว! ห้องครัวกำลังจัดเตรียมอาหารให้ครับ
        </div>
      )}

      {/* ================= TAB 1: MENU ================= */}
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
                              {isSelected ? 'แตะเพิ่มเครื่องเคียง/จำนวนเพิ่ม' : 'แตะเพื่อเลือกเครื่องเคียง/ระบุโน้ต'}
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

      {/* ================= TAB 2: CART ================= */}
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
                      
                      {/* แสดงรายการเครื่องเคียงที่เลือก */}
                      {item.selectedAddons && item.selectedAddons.length > 0 && (
                        <div className="text-amber-700 font-medium text-[11px] mt-0.5">
                          ➕ {item.selectedAddons.map((a) => `${a.name} (+฿${a.price})`).join(', ')}
                        </div>
                      )}

                      {item.note && <span className="text-slate-500 font-medium block text-[11px] mt-0.5">📝 {item.note}</span>}
                      
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
              {activeOrders.map((order, idx) => (
                <div
                  key={order.id}
                  className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs space-y-3"
                >
                  <div className="flex justify-between items-center text-xs font-bold border-b border-slate-100 pb-2">
                    <span className="text-amber-900">
                      รอบการสั่งที่ {idx + 1} ({order.orderType})
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] ${
                        order.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : order.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {order.status === 'pending'
                        ? '⏳ ส่งห้องครัวแล้ว'
                        : order.status === 'completed'
                        ? '✅ เสิร์ฟแล้ว'
                        : '🔥 กำลังปรุงอาหาร'}
                    </span>
                  </div>

                  {/* 🎯 แสดงรายการอาหาร โดยใช้คลาสสไตล์เดียวกับฝั่ง Cashier เป๊ะๆ */}
                  <div className="space-y-2 text-xs">
                    {order.items &&
                      order.items.map((item, itemIdx) => {
                        const isCancelled = checkIsItemCancelled(item);

                        return (
                          <div
                            key={itemIdx}
                            className={`flex justify-between items-center p-2.5 rounded-xl border transition ${
                              isCancelled
                                ? 'bg-red-50 border-red-200 text-red-400 opacity-70'
                                : 'bg-slate-50/80 border-slate-100 text-slate-800'
                            }`}
                          >
                            <div>
                              <div className={`font-bold ${isCancelled ? 'line-through' : ''}`}>
                                {item.name} <span className="font-black">x{item.quantity}</span>
                              </div>

                              {/* แสดงรายการเครื่องเคียงในบิล */}
                              {item.selectedAddons && item.selectedAddons.length > 0 && (
                                <div className={`text-[10px] ${isCancelled ? 'line-through text-red-300' : 'text-amber-700'}`}>
                                  ➕ {item.selectedAddons.map((a) => a.name).join(', ')}
                                </div>
                              )}

                              {item.note && (
                                <div className={`text-[10px] ${isCancelled ? 'line-through text-red-300' : 'text-amber-600'}`}>
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
                </div>
              ))}

              {/* ยอดรวมสุทธิหลังหักรายการที่ยกเลิกออก */}
              <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-md flex justify-between items-center font-black">
                <span>ยอดรวมทั้งหมดที่สั่งแล้ว</span>
                <span className="text-xl">฿{totalSubmittedPrice}</span>
              </div>

              {/* 🧾 ปุ่มเรียกเช็คบิล */}
              <button
                onClick={handleCallBill}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black py-4 rounded-2xl shadow-lg transition text-sm flex justify-center items-center gap-2"
              >
                💵 เรียกเช็คบิล (แจ้งพนักงานเก็บเงิน)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal ระบุท็อปปิ้ง/เครื่องเคียง และ โน้ตอาหาร */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-3 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full font-bold flex items-center justify-center text-sm"
            >
              ✕
            </button>

            <MenuItemSelector
              item={{
                name: selectedItem.name,
                basePrice: selectedItem.price,
                addons: selectedItem.addons || [],
              }}
              onAddToCart={handleAddToCartFromSelector}
            />
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
