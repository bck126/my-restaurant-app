'use client';
import { useState, useEffect } from 'react';
import { db } from '../../firebase'; // เช็ก path ให้ตรงกับโปรเจกต์ของคุณ
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// 🔑 API Key ของ ImgBB สำหรับอัปโหลดรูปภาพฟรี
const IMGBB_API_KEY = 'b17a4ff3cb7cea8b4c87d85a8ea450e9'; 

export interface Addon {
  name: string;
  price: number;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  addons?: Addon[];
}

export default function AdminMenu() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // State ฟอร์ม
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('เมนูส้มตำ');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 🥗 State สำหรับจัดการเครื่องเคียง
  const [addons, setAddons] = useState<Addon[]>([]);

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

  // ฟังก์ชันจัดการรายการเครื่องเคียง (Add/Remove/Update)
  const handleAddAddon = () => {
    setAddons([...addons, { name: '', price: 0 }]);
  };

  const handleRemoveAddon = (index: number) => {
    setAddons(addons.filter((_, i) => i !== index));
  };

  const handleAddonNameChange = (index: number, value: string) => {
    const newAddons = [...addons];
    newAddons[index].name = value;
    setAddons(newAddons);
  };

  const handleAddonPriceChange = (index: number, value: string) => {
    const newAddons = [...addons];
    newAddons[index].price = Number(value) || 0;
    setAddons(newAddons);
  };

  // เลือกรูปจากเครื่อง/มือถือ
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // อัปโหลดรูปภาพไปที่ ImgBB แบบฟรี
  const uploadToImgBB = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (data.success) {
      return data.data.url;
    } else {
      throw new Error('Upload image failed');
    }
  };

  // บันทึกข้อมูล
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return alert('กรุณากรอกชื่อและราคาอาหาร');

    setLoading(true);
    try {
      let finalImageUrl = imageUrl;

      // ถ้ามีการเลือกไฟล์รูปจากเครื่อง ให้อัปโหลดเข้า ImgBB
      if (imageFile) {
        finalImageUrl = await uploadToImgBB(imageFile);
      }

      // คัดกรองเอาเฉพาะเครื่องเคียงที่มีชื่อระบุไว้
      const validAddons = addons.filter((addon) => addon.name.trim() !== '');

      const menuData = {
        name,
        price: Number(price),
        category: category.trim() || 'ทั่วไป',
        imageUrl: finalImageUrl || 'https://placehold.co/150x150/e2e8f0/64748b?text=Food',
        addons: validAddons, // 👈 บันทึกรายการเครื่องเคียงลง Firebase
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'menu', editingId), menuData);
        alert('อัปเดตเมนูเรียบร้อยแล้ว!');
      } else {
        await addDoc(collection(db, 'menu'), {
          ...menuData,
          createdAt: serverTimestamp(),
        });
        alert('เพิ่มเมนูใหม่เรียบร้อยแล้ว!');
      }

      resetForm();
    } catch (error) {
      console.error('Save Error:', error);
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปหรือบันทึกข้อมูล');
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
    setImagePreview(item.imageUrl || null);
    setImageFile(null);
    setAddons(item.addons || []); // 👈 ดึงข้อมูลเครื่องเคียงที่มีอยู่เดิมขึ้นมาแก้ไข
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
    setImageFile(null);
    setImagePreview(null);
    setAddons([]);
  };

  // จัดกลุ่มเมนูแยกตามหมวดหมู่
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    const cat = item.category?.trim() || 'ทั่วไป';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  // เรียงหมวดหมู่ตามลำดับตัวอักษรไทย
  const sortedCategories = Object.keys(groupedMenuItems).sort((a, b) =>
    a.localeCompare(b, 'th')
  );

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
          className="text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-600 shadow-xs hover:bg-slate-50 transition"
        >
          🏠 หน้าบ้าน
        </a>
      </div>

      {/* ฟอร์ม เพิ่ม/แก้ไข เมนู */}
      <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mb-6">
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
              <label className="text-xs font-bold text-slate-600 block mb-1">เลือกรูปภาพ (จากมือถือ/คอม)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
            </div>
          </div>

          {/* 🥗 ส่วนจัดการรายการเครื่องเคียงเพิ่มเติม */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-700">
                🥗 รายการเครื่องเคียงเพิ่ม (ออปชันเสริม)
              </label>
              <button
                type="button"
                onClick={handleAddAddon}
                className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition"
              >
                + เพิ่มตัวเลือก
              </button>
            </div>

            {addons.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200 text-center">
                ยังไม่มีเครื่องเคียงสำหรับเมนูนี (กด + เพิ่มตัวเลือก ด้านบน)
              </p>
            ) : (
              <div className="space-y-2">
                {addons.map((addon, index) => (
                  <div key={index} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      placeholder="ชื่อเครื่องเคียง เช่น เพิ่มไข่เค็ม"
                      value={addon.name}
                      onChange={(e) => handleAddonNameChange(index, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      placeholder="ราคา"
                      value={addon.price || ''}
                      onChange={(e) => handleAddonPriceChange(index, e.target.value)}
                      className="w-20 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-400 font-bold">บ.</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAddon(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg text-xs font-bold"
                      title="ลบตัวเลือกนี้"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* แสดงรูปตัวอย่าง */}
          {imagePreview && (
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
              <span className="text-xs text-slate-500 font-medium">รูปภาพตัวอย่างที่จะแสดง</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition"
              >
                ยกเลิก
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition disabled:opacity-50 cursor-pointer hover:bg-emerald-700"
            >
              {loading ? 'กำลังอัปโหลดรูปและบันทึก...' : editingId ? '💾 บันทึกการแก้ไข' : '✨ เพิ่มเมนู'}
            </button>
          </div>
        </form>
      </section>

      {/* รายการเมนูทั้งหมด แสดงผลแบบจัดหมวดหมู่อัตโนมัติ */}
      <section className="space-y-6">
        <h2 className="font-bold text-slate-700 text-base px-1">
          รายการเมนูในระบบทั้งหมด ({menuItems.length} รายการ)
        </h2>

        {sortedCategories.map((catName) => {
          const sortedItems = [...groupedMenuItems[catName]].sort((a, b) =>
            a.name.localeCompare(b.name, 'th')
          );

          return (
            <div key={catName} className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1 px-1">
                <span className="bg-slate-800 text-white font-black text-xs px-2.5 py-1 rounded-lg">
                  📂 {catName}
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  {sortedItems.length} รายการ
                </span>
              </div>

              <div className="space-y-2">
                {sortedItems.map((item) => (
                  <div 
                    key={item.id}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={item.imageUrl || 'https://placehold.co/150x150/e2e8f0/64748b?text=Food'} 
                        alt={item.name} 
                        className="w-14 h-14 rounded-xl object-cover border border-slate-100 bg-slate-50"
                      />
                      <div>
                        <div className="font-bold text-slate-900 text-base">{item.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-emerald-600 font-bold text-sm">{item.price} บาท</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-medium">
                            {item.category || 'ทั่วไป'}
                          </span>
                          {item.addons && item.addons.length > 0 && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-medium">
                              🥗 +{item.addons.length} เครื่องเคียง
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 font-bold rounded-xl text-xs border border-amber-200 active:bg-amber-100 hover:bg-amber-100 transition"
                      >
                        ✏️ แก้ไข
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.name)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 font-bold rounded-xl text-xs border border-red-200 active:bg-red-100 hover:bg-red-100 transition"
                      >
                        🗑️ ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {menuItems.length === 0 && (
          <p className="text-center py-10 text-slate-400">ยังไม่มีรายการเมนูในระบบ</p>
        )}
      </section>
    </main>
  );
}