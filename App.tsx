import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ReceiptList } from './components/ReceiptList';
import { AddReceipt } from './components/AddReceipt';
import { Settings } from './components/Settings';
import { AuthPage } from './components/AuthPage';
import { AdminPanel } from './components/AdminPanel';
import { supabase } from './services/supabaseClient';
import { Receipt, Category, User } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { LogOut } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loadingData, setLoadingData] = useState(false);
  
  // Persistência simples de sessão
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
      setCurrentTab('dashboard');
  };
  
  // Filtro Global de Empresa
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
      
      // Fetch Categories: Padrão OU do usuário OU todas se for admin (opcional, aqui mantemos foco nas do user + default)
      // query: is_default = true OR user_id = user.id
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
        .order('date', { ascending: false });
      
      // LOGICA CRÍTICA:
      // Se NÃO for admin, filtra rigorosamente pelo ID do usuário.
      // Se FOR admin, não aplica filtro de user_id, mostrando notas órfãs (antigas) e de outros users.
      if (!isAdmin) {
          query = query.eq('user_id', user.id);
      }
      
      if (selectedLocation !== 'all') {
          query = query.eq('location', selectedLocation);
      }

      const { data: recData } = await query;
      
      if (recData) {
        setReceipts(recData as any);
      }
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
        {/* Header Extra para Logout/User Info - Inserido no topo do children */}
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
                onRefresh={fetchData} 
            />
        )}
        {currentTab === 'add' && <AddReceipt categories={categories} onSaved={handleReceiptSaved} userId={user.id} />}
        {currentTab === 'admin' && (user.role === 'admin' || user.username === 'zoork22') && (
            <AdminPanel />
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