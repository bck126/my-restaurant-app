'use client';

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  orderType: 'DINE_IN' | 'TAKEAWAY';
  tableNo: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: 'PENDING' | 'COMPLETED' | 'PAID';
  createdAt: any;
}

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  useEffect(() => {
    // ดึงข้อมูลออเดอร์ทั้งหมด Realtime
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderList: Order[] = [];
      snapshot.forEach((doc) => {
        orderList.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(orderList);
    });

    return () => unsubscribe();
  }, []);

  // กรองหาออเดอร์ที่ยังไม่ได้ชำระเงิน (PENDING หรือ COMPLETED)
  const unpaidOrders = orders.filter((o) => o.status !== 'PAID');

  // ดึงรายการเลขโต๊ะที่มีออเดอร์ค้างชำระ
  const activeTables = Array.from(
    new Set(unpaidOrders.map((o) => (o.orderType === 'DINE_IN' ? o.tableNo : 'TAKEAWAY')).filter(Boolean))
  );

  // คำนวณรายการอาหารและยอดรวมของโต๊ะที่เลือก
  const currentTableOrders = unpaidOrders.filter((o) =>
    selectedTable === 'TAKEAWAY'
      ? o.orderType === 'TAKEAWAY'
      : o.tableNo === selectedTable && o.orderType === 'DINE_IN'
  );

  const totalBill = currentTableOrders.reduce((sum, o) => sum + o.totalPrice, 0);

  // ชำระเงิน / เช็กบิล
  const handlePayment = async () => {
    if (!selectedTable || currentTableOrders.length === 0) return;

    if (confirm(`ยืนยันการรับชำระเงินจำนวน ${totalBill} บาท สำหรับ ${selectedTable === 'TAKEAWAY' ? 'สั่งกลับบ้าน' : `โต๊ะ ${selectedTable}`} ?`)) {
      try {
        // อัปเดตสถานะของออเดอร์โต๊ะนี้ทั้งหมดให้เป็น PAID
        for (const order of currentTableOrders) {
          const orderRef = doc(db, 'orders', order.id);
          await updateDoc(orderRef, { status: 'PAID' });
        }
        alert('ชำระเงินสำเร็จเรียบร้อยครับ!');
        setSelectedTable(null);
      } catch (error) {
        console.error('Error completing payment:', error);
        alert('เกิดข้อผิดพลาดในการชำระเงิน');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-6 max-w-6xl mx-auto">
      <header className="bg-white p-6 rounded-2xl shadow-sm mb-6 border border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">💵 หน้าจอแคชเชียร์ / เช็กบิล</h1>
          <p className="text-slate-500 text-sm">เลือกโต๊ะเพื่อดูรายการและออกบิลชำระเงิน</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold border border-emerald-200">
          รอชำระเงินทั้งหมด {activeTables.length} โต๊ะ/รายการ
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* รายชื่อโต๊ะที่มีออเดอร์ค้าง */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="font-bold text-lg mb-4 text-slate-700">โต๊ะที่รอชำระเงิน</h2>
          <div className="space-y-2">
            {activeTables.map((table) => {
              const count = unpaidOrders.filter((o) =>
                table === 'TAKEAWAY' ? o.orderType === 'TAKEAWAY' : o.tableNo === table
              ).length;

              return (
                <button
                  key={table}
                  onClick={() => setSelectedTable(table)}
                  className={`w-full p-4 rounded-xl text-left font-semibold transition flex justify-between items-center ${
                    selectedTable === table
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{table === 'TAKEAWAY' ? '🛍️ ซื้อกลับบ้าน' : `🍽️ โต๊ะ ${table}`}</span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full ${
                      selectedTable === table ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count} รายการสั่ง
                  </span>
                </button>
              );
            })}

            {activeTables.length === 0 && (
              <p className="text-center py-10 text-slate-400 text-sm">ไม่มีโต๊ะค้างชำระเงิน 👍</p>
            )}
          </div>
        </div>

        {/* รายละเอียดบิลของโต๊ะที่เลือก */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h2 className="font-bold text-xl text-slate-800">
                {selectedTable
                  ? selectedTable === 'TAKEAWAY'
                    ? 'รายการอาหาร: ซื้อกลับบ้าน'
                    : `รายการอาหาร: โต๊ะ ${selectedTable}`
                  : 'กรุณาเลือกโต๊ะทางซ้ายมือ'}
              </h2>
              {selectedTable && (
                <span className="text-sm font-medium bg-slate-100 px-3 py-1 rounded-lg text-slate-600">
                  รวม {currentTableOrders.length} ออเดอร์
                </span>
              )}
            </div>

            {selectedTable ? (
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {currentTableOrders.map((order) => (
                  <div key={order.id} className="border border-slate-100 bg-slate-50 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-2 text-xs text-slate-500 font-semibold">
                      <span>รหัสออเดอร์: #{order.id.slice(0, 6)}</span>
                      <span className={order.status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-600'}>
                        {order.status === 'COMPLETED' ? '🟢 ครัวทำเสร็จแล้ว' : '🟡 ครัวกำลังทำ'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>
                            {item.name} x {item.quantity}
                          </span>
                          <span className="font-medium">{item.price * item.quantity} บาท</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400">
                <p className="text-4xl mb-2">🧾</p>
                <p>เลือกโต๊ะจากรายการฝั่งซ้ายเพื่อดูใบแจ้งหนี้</p>
              </div>
            )}
          </div>

          {/* ปุ่มสรุปยอดและรับเงิน */}
          {selectedTable && (
            <div className="border-t pt-4 mt-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600 text-lg font-medium">รวมเงินยอดทั้งหมด</span>
                <span className="text-3xl font-extrabold text-blue-600">{totalBill} บาท</span>
              </div>
              <button
                onClick={handlePayment}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold py-4 rounded-xl shadow-lg transition"
              >
                💵 รับชำระเงิน / ปิดบิล
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}