import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ReceiptList } from './components/ReceiptList';
import { AddReceipt } from './components/AddReceipt';
import { Settings } from './components/Settings';
import { AuthPage } from './components/AuthPage';
import { AdminPanel } from './components/AdminPanel';
import { SefazMonitor } from './components/SefazMonitor';
import { supabase } from './services/supabaseClient';
import { authService } from './services/authService';
import { Receipt, Category, User } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { LogOut } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  useEffect(() => {
    const savedUser = localStorage.getItem('smartreceipts_user');
    if (savedUser) {
        setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (u: User) => {
      setUser(u);
      localStorage.setItem('smartreceipts_user', JSON.stringify(u));
  };

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem('smartreceipts_user');
      setReceipts([]);
      setUsers([]);
      setCurrentTab('dashboard');
  };
  
  const [selectedLocation, setSelectedLocation] = useState<string>(() => {
      return localStorage.getItem('smartreceipts_location') || 'all';
  });

  const handleLocationChange = (loc: string) => {
      setSelectedLocation(loc);
      localStorage.setItem('smartreceipts_location', loc);
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoadingData(true);
      const isAdmin = user.role === 'admin' || user.username === 'zoork22';
      
      // Fetch Users mapping (basic info)
      const { data: userData } = await supabase.from('users').select('id, full_name, username');
      if (userData) setUsers(userData as User[]);

      // Fetch Categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .or(`is_default.eq.true,user_id.eq.${user.id}`)
        .order('name');

      if (catData && catData.length > 0) {
        setCategories(catData);
      }

      // Fetch Receipts
      let query = supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!isAdmin) {
          if (user.location) {
             query = query.eq('location', user.location);
          } else {
             query = query.eq('user_id', user.id);
          }
      } else {
          if (selectedLocation !== 'all') {
              query = query.eq('location', selectedLocation);
          }
      }

      const { data: recData } = await query;
      if (recData) setReceipts(recData as any);

    } catch (e) {
      console.error("Error fetching data", e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) {
        fetchData();
    }
  }, [user, selectedLocation]);

  const handleReceiptSaved = () => {
    fetchData(); 
    setCurrentTab('receipts');
  };

  if (!user) {
      return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen font-sans">
      <Layout 
        currentTab={currentTab} 
        onTabChange={setCurrentTab}
        selectedLocation={selectedLocation}
        onLocationChange={handleLocationChange}
        currentUser={user}
      >
        <div className="px-4 pt-2 pb-0 flex justify-between items-center bg-gray-50 text-xs text-gray-500">
             <div className="flex items-center gap-2">
                <span>Olá, <strong>{user.full_name.split(' ')[0]}</strong></span>
                {user.role === 'admin' && <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded text-[10px] font-bold">ADMIN</span>}
             </div>
             <button onClick={handleLogout} className="flex items-center gap-1 text-red-400 hover:text-red-600">
                <LogOut size={12} /> Sair
             </button>
        </div>

        {currentTab === 'dashboard' && <Dashboard receipts={receipts} categories={categories} />}
        {currentTab === 'receipts' && (
            <ReceiptList 
                receipts={receipts} 
                categories={categories} 
                users={users}
                onRefresh={fetchData} 
                currentUser={user}
            />
        )}
        {currentTab === 'add' && <AddReceipt categories={categories} onSaved={handleReceiptSaved} currentUser={user} />}
        {currentTab === 'admin' && (user.role === 'admin' || user.username === 'zoork22') && (
            <AdminPanel />
        )}
        {currentTab === 'sefaz' && (user.role === 'admin' || user.username === 'zoork22') && (user.location === 'Caratinga' || user.location === 'Ponte Nova') && (
            <SefazMonitor currentUser={user} categories={categories} />
        )}
        {currentTab === 'settings' && (
            <Settings 
                categories={categories} 
                refreshCategories={fetchData} 
                receipts={receipts}
                userId={user.id}
                isAdmin={user.role === 'admin' || user.username === 'zoork22'}
            />
        )}
      </Layout>
    </div>
  );
}