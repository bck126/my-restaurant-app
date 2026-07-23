'use client';

import { useState } from 'react';

export default function QrGeneratorPage() {
  const [tableCount, setTableCount] = useState<number>(6);
  const [restaurantName, setRestaurantName] = useState('ส้มตำ ริมเขื่อน');
  const [subTitle, setSubTitle] = useState('สแกนเพื่อดูเมนูและสั่งอาหาร');

  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://my-restaurant-app-iota.vercel.app';

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-800">
      {/* แผงควบคุม (ซ่อนเวลาพิมพ์) */}
      <div className="print:hidden max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              🖨️ ระบบสร้าง QR Code ติดโต๊ะอาหาร
            </h1>
            <p className="text-xs text-slate-500">
              กำหนดชื่อร้านและจำนวนโต๊ะเพื่อพิมพ์นำไปติดที่โต๊ะ
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 text-sm"
          >
            🖨️ พิมพ์ / Print QR Code
          </button>
        </div>

        {/* ฟอร์มตั้งค่า */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              ชื่อร้านอาหาร *
            </label>
            <input
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              ข้อความบรรยาย
            </label>
            <input
              type="text"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              จำนวนโต๊ะ
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

      {/* รายการ QR Code Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:max-w-none">
        {Array.from({ length: tableCount }, (_, i) => i + 1).map((tableNumber) => {
          const qrUrl = `${baseUrl}?table=${tableNumber}`;
          // สร้าง QR Code ด้วย API ของ api.qrserver.com
          const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;

          return (
            <div
              key={tableNumber}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-between text-center break-inside-avoid print:shadow-none print:border-2 print:border-slate-300 relative"
            >
              {/* โลโก้และชื่อร้าน */}
              <div className="mb-3 flex flex-col items-center">
                <img
                  src="/logo.png"
                  alt="Logo"
                  width={64}
                  height={64}
                  className="w-16 h-16 object-contain mb-2 rounded-xl"
                  onError={(e) => {
                    // ถ้าหารูป logo.png ไม่เจอ จะซ่อนไว้ไม่ให้ขึ้นรูปแตก
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {restaurantName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {subTitle}
                </p>
              </div>

              {/* QR Code (Pure HTML Image) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-inner my-2 flex items-center justify-center relative">
                <img
                  src={qrImgSrc}
                  alt={`QR Code Table ${tableNumber}`}
                  className="w-44 h-44 object-contain"
                />
              </div>

              {/* ป้ายโต๊ะ */}
              <div className="w-full mt-3">
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