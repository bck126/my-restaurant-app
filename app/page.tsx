import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { Plus, Trash2, Edit2, Check, X, Search, Utensils } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  order?: number;
}

export const MenuManagement: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Form State
  const [name, setName] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch Items from Firestore
  const fetchMenuItems = async (): Promise<void> => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'menuItems'));
      const items: MenuItem[] = querySnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Omit<MenuItem, 'id'>),
      }));
      setMenuItems(items);
    } catch (err: unknown) {
      console.error('Error fetching menu items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  // Add or Update Item
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!name || !price) return;

    try {
      const itemData = {
        name,
        price: parseFloat(price),
        category: category.trim() || 'ทั่วไป',
        imageUrl: imageUrl.trim() || '',
      };

      if (editingId) {
        await updateDoc(doc(db, 'menuItems', editingId), itemData);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'menuItems'), itemData);
      }

      // Reset Form
      setName('');
      setPrice('');
      setCategory('');
      setImageUrl('');
      await fetchMenuItems();
    } catch (err: unknown) {
      console.error('Error saving menu item:', err);
    }
  };

  // Start Edit
  const handleEdit = (item: MenuItem): void => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(item.price.toString());
    setCategory(item.category || '');
    setImageUrl(item.imageUrl || '');
  };

  // Cancel Edit
  const handleCancelEdit = (): void => {
    setEditingId(null);
    setName('');
    setPrice('');
    setCategory('');
    setImageUrl('');
  };

  // Delete Item
  const handleDelete = async (id: string): Promise<void> => {
    if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'menuItems', id));
        await fetchMenuItems();
      } catch (err: unknown) {
        console.error('Error deleting menu item:', err);
      }
    }
  };

  // 1. จัดเรียงหมวดหมู่ตามตัวอักษรภาษาไทย
  const rawCategories = Array.from(
    new Set(menuItems.map((i) => i.category || 'ทั่วไป'))
  ).sort((a, b) => a.localeCompare(b, 'th'));

  const categories = ['ทั้งหมด', ...rawCategories];

  // 2. กรองและจัดเรียงรายการอาหาร
  const filteredItems = menuItems
    .filter((item) => {
      const matchesCategory =
        selectedCategory === 'ทั้งหมด' ||
        (item.category || 'ทั่วไป') === selectedCategory;

      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name, 'th');
    });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Utensils className="w-7 h-7 text-indigo-600" />
          จัดการเมนูอาหาร
        </h1>
      </div>

      {/* Form Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          {editingId ? 'แก้ไขรายการอาหาร' : 'เพิ่มรายการอาหารใหม่'}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ชื่ออาหาร *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ส้มตำไทย"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ราคา (บาท) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="เช่น 50"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">หมวดหมู่</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="เช่น ตำ/ยำ (ค่าสั่งคือ 'ทั่วไป')"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ลิงก์รูปภาพ (URL)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-1 transition-colors"
            >
              {editingId ? (
                <>
                  <Check className="w-4 h-4" /> บันทึก
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> เพิ่มเมนู
                </>
              )}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-3 rounded-lg flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่ออาหาร..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Menu Cards Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">กำลังโหลดรายการอาหาร...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100">
          ไม่พบรายการอาหารในหมวดหมู่นี้
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="h-40 bg-gray-100 relative overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      e.currentTarget.src = 'https://via.placeholder.com/300x200?text=No+Image';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Utensils className="w-10 h-10" />
                  </div>
                )}
                <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                  {item.category || 'ทั่วไป'}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg mb-1">{item.name}</h3>
                  <p className="text-indigo-600 font-bold text-xl">
                    ฿{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-1.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="border border-red-200 text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};