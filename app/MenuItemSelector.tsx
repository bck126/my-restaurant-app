'use client';
import { useState } from 'react';

// 1. กำหนดโครงสร้างข้อมูล (Type Definition)
export interface Addon {
  name: string;
  price: number;
}

export interface MenuItem {
  name: string;
  basePrice: number;
  addons?: Addon[];
}

interface MenuItemSelectorProps {
  item: MenuItem;
}

export default function MenuItemSelector({ item }: MenuItemSelectorProps) {
  // 🎯 เก็บข้อมูลแบบ Array พร้อมระบุประเภท Addon[]
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);

  // ฟังก์ชันเมื่อกดคลิก Checkbox เพื่อเพิ่มหรือลดรายการ
  const handleCheckboxChange = (addon: Addon) => {
    const exists = selectedAddons.some((a) => a.name === addon.name);
    
    if (exists) {
      // ถ้าเลือกอยู่แล้ว ให้เอาออก (Uncheck)
      setSelectedAddons(selectedAddons.filter((a) => a.name !== addon.name));
    } else {
      // ถ้ายังไม่ได้เลือก ให้เพิ่มเข้าไปในรายการ
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  // 🧮 คำนวณราคารวม: ราคาพื้นฐาน + ผลรวมราคาของทุกตัวเลือกเสริมที่เลือก
  const addonsTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
  const totalPrice = (item?.basePrice || 0) + addonsTotal;

  const addToCart = () => {
    const orderItem = {
      name: item?.name,
      basePrice: item?.basePrice,
      selectedAddons: selectedAddons,
      totalPrice: totalPrice,
      quantity: 1
    };
    console.log("ส่งรายการสั่งซื้อ:", orderItem);
  };

  if (!item) return null;

  return (
    <div className="p-4 border rounded-xl bg-white shadow-sm space-y-4">
      <div>
        <h2 className="text-xl font-black text-slate-800">{item.name}</h2>
        <p className="text-slate-500 font-bold text-xs">ราคาพื้นฐาน: ฿{item.basePrice}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-400">เลือกเครื่องเคียงเพิ่มได้ (เลือกได้หลายอย่าง):</p>
        {item.addons?.map((addon) => {
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
        })}
      </div>

      <div className="p-4 bg-slate-100 rounded-xl flex justify-between items-center">
        <span className="font-black text-slate-800 text-sm">ราคารวม:</span>
        <span className="text-2xl font-black text-amber-600">฿{totalPrice}</span>
      </div>

      <button 
        onClick={addToCart} 
        className="w-full py-3 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 transition shadow-sm text-sm"
      >
        เพิ่มลงตะกร้า
      </button>
    </div>
  );
}