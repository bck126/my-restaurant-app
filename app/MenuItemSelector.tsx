'use client';
import { useState } from 'react';

// 1. กำหนดโครงสร้างข้อมูล (Type Definition)
export interface Addon {
  name: string;
  price: number;
}

export interface MenuItem {
  id?: string;
  name: string;
  basePrice: number;
  addons?: Addon[];
}

interface MenuItemSelectorProps {
  item: MenuItem;
  onAddToCart?: (orderData: {
    selectedAddons: Addon[];
    totalPrice: number;
    quantity: number;
    note?: string;
  }) => void;
}

export default function MenuItemSelector({ item, onAddToCart }: MenuItemSelectorProps) {
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [note, setNote] = useState<string>(''); // 📝 เพิ่ม State สำหรับเก็บรายละเอียดเพิ่มเติม

  // ฟังก์ชันเลือก/ยกเลิก เครื่องเคียง
  const handleCheckboxChange = (addon: Addon) => {
    const exists = selectedAddons.some((a) => a.name === addon.name);
    if (exists) {
      setSelectedAddons(selectedAddons.filter((a) => a.name !== addon.name));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  // คำนวณราคารวม
  const addonsTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
  const totalPrice = (item?.basePrice || 0) + addonsTotal;

  const addToCart = () => {
    const orderData = {
      selectedAddons: selectedAddons,
      totalPrice: totalPrice,
      quantity: 1,
      note: note.trim(), // ส่งรายละเอียดเพิ่มเติมไปด้วย
    };

    if (onAddToCart) {
      onAddToCart(orderData);
    } else {
      console.log("ส่งรายการสั่งซื้อ:", orderData);
    }
  };

  if (!item) return null;

  return (
    <div className="p-4 border rounded-xl bg-white shadow-sm space-y-4">
      {/* ชื่อเมนู และราคาพื้นฐาน */}
      <div>
        <h2 className="text-xl font-black text-slate-800">{item.name}</h2>
        <p className="text-slate-500 font-bold text-xs">ราคาพื้นฐาน: ฿{item.basePrice}</p>
      </div>

      {/* ✍️ ช่องระบุความต้องการเพิ่มเติม (รสจัด, ไม่ใส่พริก, เปรี้ยว ฯลฯ) */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-600 block">
          รายละเอียดเพิ่มเติม (เช่น รสจัด, ไม่พริก, เปรี้ยวๆ):
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ระบุความต้องการพิเศษ..."
          className="w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 transition bg-slate-50"
        />
      </div>

      {/* 🥗 รายการเครื่องเคียงเพิ่ม */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-600">เลือกเครื่องเคียงเพิ่ม:</p>
        
        {item.addons && item.addons.length > 0 ? (
          item.addons.map((addon) => {
            const isChecked = selectedAddons.some((a) => a.name === addon.name);
            return (
              <label 
                key={addon.name} 
                className={`flex items-center justify-between p-3 border-2 rounded-xl cursor-pointer transition ${
                  isChecked ? 'border-amber-500 bg-amber-50/30' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleCheckboxChange(addon)}
                    className="w-5 h-5 accent-amber-500 rounded"
                  />
                  <span className="font-bold text-slate-700 text-sm">{addon.name}</span>
                </div>
                <span className="text-xs font-bold text-amber-600">
                  +฿{addon.price}
                </span>
              </label>
            );
          })
        ) : (
          <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 text-center">
            ไม่มีรายการเครื่องเคียงเพิ่มเติมสำหรับเมนูนี
          </p>
        )}
      </div>

      {/* สรุปราคารวม */}
      <div className="p-4 bg-slate-100 rounded-xl flex justify-between items-center">
        <span className="font-black text-slate-800 text-sm">ราคารวม:</span>
        <span className="text-2xl font-black text-amber-600">฿{totalPrice}</span>
      </div>

      {/* ปุ่มกดเพิ่มลงตะกร้า */}
      <button 
        onClick={addToCart} 
        className="w-full py-3 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 transition shadow-sm text-sm"
      >
        เพิ่มลงตะกร้า
      </button>
    </div>
  );
}