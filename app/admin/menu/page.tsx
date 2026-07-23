'use client';

import { useState, useEffect } from 'react';
import { db } from '../../firebase'; // เช็ก path ให้ตรงกับโครงสร้างโฟลเดอร์ของคุณ
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
}

export default function AdminMenu() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // State ฟอร์ม (ใช้ทั้งเพิ่มและแก้ไข)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('เมนูส้มตำ');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // ดึงข้อมูลเมนูจาก Firebase Real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'menu'), (snapshot) => {
      const items: MenuItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as MenuItem);
      });
      setMenuItems(items);
    });

    return () => unsubscribe();
  }, []);

  // บันทึกข้อมูล (เพิ่มใหม่ หรือ อัปเดตเดิม)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return alert('กรุณากรอกชื่อและราคาอาหาร');

    setLoading(true);
    try {
      const menuData = {
        name,
        price: Number(price),
        category: category || 'ทั่วไป',
        imageUrl: imageUrl.trim() || 'https://placehold.co/150x150/e2e8f0/64748b?text=Food',
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        // แก้ไขเมนูเดิม
        await updateDoc(doc(db, 'menu', editingId), menuData);
        alert('อัปเดตเมนูเรียบร้อยแล้ว!');
      } else {
        // เพิ่มเมนูใหม่
        await addDoc(collection(db, 'menu'), {
          ...menuData,
          createdAt: serverTimestamp(),
        });
        alert('เพิ่มเมนูใหม่เรียบร้อยแล้ว!');
      }

      resetForm();
    } catch (error) {
      console.error('Save Error:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  // เลือกรายการขึ้นมาแก้ไข
  const handleEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(item.price.toString());
    setCategory(item.category || 'ทั่วไป');
    setImageUrl(item.imageUrl || '');
  };

  // ลบเมนู
  const handleDelete = async (id: string, name: string) => {
    if (confirm(`คุณต้องการลบเมนู "${name}" ใช่หรือไม่?`)) {
      try {
        await deleteDoc(doc(db, 'menu', id));
        alert('ลบเมนูเรียบร้อยแล้ว');
      } catch (error) {
        console.error('Delete Error:', error);
        alert('เกิดข้อผิดพลาดในการลบ');
      }
    }
  };

  // ล้างฟอร์ม
  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setCategory('เมนูส้มตำ');
    setImageUrl('');
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 pb-20 text-slate-800 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">📝 จัดการเมนูอาหาร</h1>
          <p className="text-xs text-slate-500">เพิ่ม แก้ไข หรือลบรายการเมนูในระบบ</p>
        </div>
        <a 
          href="/" 
          className="text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-600 shadow-sm"
        >
          🏠 หน้าบ้าน
        </a>
      </div>

      {/* ฟอร์ม เพิ่ม/แก้ไข เมนู */}
      <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <h2 className="font-bold text-base text-slate-800 mb-4 flex items-center gap-2">
          {editingId ? '✏️ แก้ไขรายการเมนู' : '➕ เพิ่มเมนูใหม่'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">ชื่อเมนู *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ตำปูปลาร้า"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">ราคา (บาท) *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="เช่น 50"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">หมวดหมู่</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="เช่น เมนูส้มตำ, ต้ม/แกง, เครื่องดื่ม"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">URL รูปภาพ (ถ้ามี)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... หรือ /logo.png"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm"
              >
                ยกเลิก
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'กำลังบันทึก...' : editingId ? '💾 บันทึกการแก้ไข' : '✨ เพิ่มเมนู'}
            </button>
          </div>
        </form>
      </section>

      {/* รายการเมนูทั้งหมด */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-700 text-base px-1">
          รายการเมนูในระบบทั้งหมด ({menuItems.length})
        </h2>

        {menuItems.map((item) => (
          <div 
            key={item.id}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <img 
                src={item.imageUrl || 'https://placehold.co/150x150/e2e8f0/64748b?text=Food'} 
                alt={item.name} 
                className="w-14 h-14 rounded-xl object-cover border border-slate-100 bg-slate-50"
              />
              <div>
                <div className="font-bold text-slate-900 text-base">{item.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-emerald-600 font-bold text-sm">{item.price} บาท</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-medium">
                    {item.category || 'ทั่วไป'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(item)}
                className="px-3 py-1.5 bg-amber-50 text-amber-700 font-bold rounded-xl text-xs border border-amber-200 active:bg-amber-100"
              >
                ✏️ แก้ไข
              </button>
              <button
                onClick={() => handleDelete(item.id, item.name)}
                className="px-3 py-1.5 bg-red-50 text-red-600 font-bold rounded-xl text-xs border border-red-200 active:bg-red-100"
              >
                🗑️ ลบ
              </button>
            </div>
          </div>
        ))}

        {menuItems.length === 0 && (
          <p className="text-center py-10 text-slate-400">ยังไม่มีรายการเมนูในระบบ</p>
        )}
      </section>
    </main>
  );
}