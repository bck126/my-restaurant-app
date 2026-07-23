'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRGeneratorPage() {
  const [tableCount, setTableCount] = useState<number>(6); // จำนวนโต๊ะเริ่มต้น 6 โต๊ะ
  const [baseUrl, setBaseUrl] = useState<string>('');

     useEffect(() => {
  // ดึง URL/Domain ปัจจุบันของเว็บโดยอัตโนมัติ (ใช้ได้ทั้งตอนรัน local และขึ้นเว็บจริง)
  if (typeof window !== 'undefined') {
    setBaseUrl(window.location.origin);
  }
}, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-800">
      {/* ส่วนควบคุม (จะไม่แสดงเวลาสั่งพิมพ์/Print) */}
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">🖨️ ระบบสร้าง QR Code ติดโต๊ะอาหาร</h1>
            <p className="text-slate-500 text-sm">กำหนดจำนวนโต๊ะ แล้วกดพิมพ์เพื่อนำไปติดที่โต๊ะได้เลย</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="font-semibold text-sm">จำนวนโต๊ะ:</label>
            <input
              type="number"
              min="1"
              max="50"
              value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value))}
              className="w-20 p-2 border rounded-lg text-center font-bold bg-slate-50"
            />
            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition flex items-center gap-2"
            >
              🖨️ พิมพ์ / Print QR Code
            </button>
          </div>
        </div>
      </div>

      {/* แผ่นการ์ด QR Code ของแต่ละโต๊ะ */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
        {Array.from({ length: tableCount }, (_, i) => i + 1).map((tableNo) => {
          const qrUrl = `${baseUrl}?table=${tableNo}`;

          return (
            <div
              key={tableNo}
              className="bg-white border-2 border-slate-300 rounded-3xl p-6 text-center shadow-sm flex flex-col items-center justify-between print:break-inside-avoid print:border-black"
            >
              <div className="mb-3">
                <h2 className="text-xl font-bold text-slate-800">ร้านอาหารอร่อยจัง 🍲</h2>
                <p className="text-xs text-slate-500">สแกนเพื่อดูเมนูและสั่งอาหาร</p>
              </div>

              {/* ตัวสร้าง QR Code */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 my-2">
                {baseUrl && (
                  <QRCodeSVG
                    value={qrUrl}
                    size={160}
                    level="H"
                    includeMargin={true}
                  />
                )}
              </div>

              <div className="mt-3 w-full">
                <div className="bg-slate-900 text-white py-2 rounded-xl font-black text-2xl tracking-wide print:bg-black">
                  โต๊ะ {tableNo}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 truncate print:text-black">
                  {qrUrl}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}