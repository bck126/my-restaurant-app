'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setLoading(true);
    try {
      // ค้นหาผู้ใช้จาก Firestore Collection 'users'
      const q = query(
        collection(db, 'users'),
        where('username', '==', username.trim()),
        where('password', '==', password.trim())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert('❌ ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        setLoading(false);
        return;
      }

      // ดึงข้อมูลสิทธิ์ (role) ของผู้ใช้
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      const role = userData.role; // เช่น 'kitchen', 'cashier', 'dashboard'

      // บันทึกสิทธิ์ลงใน localStorage เพื่อใช้ตรวจสอบหน้า
      localStorage.setItem('userRole', role);
      localStorage.setItem('userName', userData.username);

      alert(`✅ เข้าสู่ระบบสำเร็จ (สิทธิ์: ${role})`);

      // พาเปลี่ยนหน้าไปตามสิทธิ์ของพนักงาน
      if (role === 'kitchen') {
        router.push('/kitchen');
      } else if (role === 'cashier') {
        router.push('/cashier');
      } else if (role === 'dashboard') {
        router.push('/dashboard');
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-md w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-black text-slate-800">🔐 เข้าสู่ระบบร้านค้า</h1>
          <p className="text-xs text-slate-400">กรุณากรอกข้อมูลพนักงานเพื่อเข้าใช้งาน</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">ชื่อผู้ใช้ (Username)</label>
            <input
              type="text"
              placeholder="ระบุชื่อผู้ใช้"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">รหัสผ่าน (Password)</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-xl shadow-md transition text-xs disabled:opacity-50"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}