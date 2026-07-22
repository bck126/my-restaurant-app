'use client';

import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';

// -------------------------------------------------------------
// 📌 นำค่าจาก Cloudinary มาใส่ตรง 2 บรรทัดนี้ครับ
const CLOUDINARY_CLOUD_NAME = 'ko3foqrl';
const CLOUDINARY_UPLOAD_PRESET = 'Rim Khuen';
// -------------------------------------------------------------

interface MenuItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

export default function AdminMenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // ดึงข้อมูลเมนูอาหารแบบ Realtime
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

  // ฟังก์ชันอัปโหลดรูปไปยัง Cloudinary
  const uploadImageToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!res.ok) {
      throw new Error('อัปโหลดรูปภาพไม่สำเร็จ');
    }

    const data = await res.json();
    return data.secure_url;
  };

  // ฟังก์ชันเพิ่มรายการอาหาร
  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      alert('กรุณากรอกชื่อเมนูและราคา');
      return;
    }

    try {
      setUploading(true);
      let finalImageUrl = '';

      // ถ้ามีการเลือกรูปภาพจากเครื่อง ให้อัปโหลดขึ้น Cloudinary ก่อน
      if (imageFile) {
        finalImageUrl = await uploadImageToCloudinary(imageFile);
      }

      // บันทึกลง Firestore
      await addDoc(collection(db, 'menu'), {
        name,
        price: Number(price),
        imageUrl: finalImageUrl,
        createdAt: new Date(),
      });

      // ล้างข้อมูลในฟอร์ม
      setName('');
      setPrice('');
      setImageFile(null);
      alert('บันทึกเมนูสำเร็จ!');
    } catch (error) {
      console.error('Error adding menu:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setUploading(false);
    }
  };

  // ฟังก์ชันลบเมนู
  const handleDeleteMenu = async (id: string) => {
    if (confirm('คุณต้องการลบรายการเมนูนี้นี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'menu', id));
      } catch (error) {
        console.error('Error deleting menu:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-800">
      <div className="max-w-4xl mx-auto mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🍔 ระบบจัดการรายการอาหาร (Menu Admin)</h1>
          <p className="text-slate-500 text-sm">เพิ่ม ลบ หรือแก้ไขเมนูอาหารที่จะแสดงให้ลูกค้าเห็น</p>
        </div>
        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
          ทั้งหมด {menuItems.length} รายการ
        </span>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ฟอร์มเพิ่มเมนู */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold mb-4 text-slate-800">➕ เพิ่มเมนูใหม่</h2>
          <form onSubmit={handleAddMenu} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">ชื่อเมนูอาหาร</label>
              <input
                type="text"
                placeholder="เช่น ข้าวกะเพราไก่ไข่ดาว"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">ราคา (บาท)</label>
              <input
                type="number"
                placeholder="เช่น 60"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">เลือกรูปภาพอาหาร</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl shadow transition duration-200 disabled:opacity-50"
            >
              {uploading ? '⏳ กำลังอัปโหลด...' : '💾 บันทึกเมนูใหม่'}
            </button>
          </form>
        </div>

        {/* รายการเมนูทั้งหมด */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold mb-4 text-slate-800">📜 รายการเมนูทั้งหมด</h2>
          {menuItems.length === 0 ? (
            <p className="text-slate-400 text-center py-8">ยังไม่มีรายการอาหาร กดเพิ่มทางด้านซ้ายได้เลย</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border rounded-xl flex items-center gap-3 bg-slate-50 hover:bg-white transition"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">ไม่มีรูป</span>
                    )}
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                    <p className="text-emerald-600 font-semibold text-sm">{item.price} บาท</p>
                  </div>
                  <button
                    onClick={() => handleDeleteMenu(item.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg text-xs"
                  >
                    🗑️ ลบ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}