'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';

export default function AdminQRCode() {
  const [tableCount, setTableCount] = useState<number>(6);
  // ✏️ สามารถตั้งชื่อร้าน และข้อความกำกับตรงนี้ได้เลยครับ
  const [restaurantName, setRestaurantName] = useState('ร้านอาหารของคุณ'); 
  const [subTitle, setSubTitle] = useState('สแกนเพื่อดูเมนูและสั่งอาหาร');

  // URL พื้นฐานของระบบสั่งอาหาร (หน้าบ้าน)
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://my-restaurant-app-iota.vercel.app';

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-800">
      {/* ส่วนควบคุม (จะไม่ถูกพิมพ์ออกมาเมื่อกด Print) */}
      <div className="print:hidden max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              🖨️ ระบบสร้าง QR Code ติดโต๊ะอาหาร
            </h1>
            <p className="text-xs text-slate-500">
              กำหนดชื่อร้าน จำนวนโต๊ะ แล้วกดพิมพ์เพื่อนำไปติดที่โต๊ะได้เลย
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 text-sm"
          >
            🖨️ พิมพ์ / Print QR Code
          </button>
        </div>

        <hr className="border-slate-100" />

        {/* ฟอร์มตั้งค่า ชื่อร้าน และ จำนวนโต๊ะ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              ชื่อร้านอาหารบนใบ QR Code
            </label>
            <input
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="เช่น ร้านส้มตำนายก"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              ข้อความบรรยายใต้ชื่อร้าน
            </label>
            <input
              type="text"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              placeholder="เช่น สแกนเพื่อดูเมนูและสั่งอาหาร"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              จำนวนโต๊ะทั้งหมด
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value))}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            />
          </div>
        </div>
      </div>

      {/* ส่วนแสดงรายการ QR Code สำหรับสั่งพิมพ์ (จะแสดงทั้งบนหน้าจอและกระดาษพิมพ์) */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:max-w-none">
        {Array.from({ length: tableCount }, (_, i) => i + 1).map((tableNumber) => {
          const qrUrl = `${baseUrl}?table=${tableNumber}`;

          return (
            <div
              key={tableNumber}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-between text-center break-inside-avoid print:shadow-none print:border-2 print:border-slate-300"
            >
              {/* ชื่อร้านและคำอธิบาย */}
              <div className="mb-4">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {restaurantName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {subTitle}
                </p>
              </div>

              {/* ตัว QR Code */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-inner my-2 flex items-center justify-center">
                <QRCode
                  value={qrUrl}
                  size={180}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  viewBox={`0 0 256 256`}
                />
              </div>

              {/* ป้ายบอกเลขโต๊ะ */}
              <div className="w-full mt-4">
                <div className="bg-slate-900 text-white font-black text-lg py-2.5 rounded-2xl tracking-wider shadow-sm">
                  โต๊ะ {tableNumber}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-mono truncate px-2">
                  {qrUrl}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}