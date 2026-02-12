import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { LogOut, Bell } from 'lucide-react';
import { notificationService } from './services/notificationService';

type HistoryEntry = { type: 'tab'; tab: string } | { type: 'overlay'; name: string };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [linkedReceiptIds, setLinkedReceiptIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const historyStackRef = useRef<HistoryEntry[]>([{ type: 'tab', tab: 'dashboard' }]);
  const overlayCloseHandlersRef = useRef<Map<string, () => void>>(new Map());
  
  useEffect(() => {
    const savedUser = localStorage.getItem('smartreceipts_user');
    if (savedUser) {
        setUser(JSON.parse(savedUser));
        if (notificationService.needsPermissionRequest()) {
          setTimeout(() => setShowNotifBanner(true), 3000);
        }
    }
    window.history.replaceState({ type: 'tab', tab: 'dashboard' }, '', '');
  }, []);

  const handleLogin = (u: User) => {
      setUser(u);
      localStorage.setItem('smartreceipts_user', JSON.stringify(u));
      if (notificationService.needsPermissionRequest()) {
        setTimeout(() => setShowNotifBanner(true), 2000);
      }
  };

  const handleNotifAllow = async () => {
    await notificationService.requestPermission();
    setShowNotifBanner(false);
  };

  const handleNotifDismiss = () => {
    setShowNotifBanner(false);
  };

  const registerOverlayClose = useCallback((name: string, handler: () => void) => {
    overlayCloseHandlersRef.current.set(name, handler);
  }, []);

  const unregisterOverlayClose = useCallback((name: string) => {
    overlayCloseHandlersRef.current.delete(name);
  }, []);

  const pushOverlay = useCallback((name: string) => {
    const entry: HistoryEntry = { type: 'overlay', name };
    historyStackRef.current.push(entry);
    window.history.pushState({ type: 'overlay', name }, '', '');
  }, []);

  const closeOverlay = useCallback((name: string) => {
    const stack = historyStackRef.current;
    const lastEntry = stack[stack.length - 1];
    if (lastEntry && lastEntry.type === 'overlay' && lastEntry.name === name) {
      window.history.back();
    }
  }, []);

  const removeOverlayFromStack = useCallback((name: string) => {
    const stack = historyStackRef.current;
    const idx = stack.findIndex(e => e.type === 'overlay' && (e as any).name === name);
    if (idx !== -1) {
      stack.splice(idx, 1);
    }
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setCurrentTab(tab);
    const entry: HistoryEntry = { type: 'tab', tab };
    historyStackRef.current.push(entry);
    window.history.pushState({ type: 'tab', tab }, '', '');
  }, []);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const stack = historyStackRef.current;
      if (stack.length <= 1) {
        window.history.pushState({ type: 'tab', tab: 'dashboard' }, '', '');
        return;
      }

      const popped = stack.pop();

      if (popped && popped.type === 'overlay') {
        const handler = overlayCloseHandlersRef.current.get(popped.name);
        if (handler) handler();
        return;
      }

      if (popped && popped.type === 'tab') {
        const prevTabEntry = [...stack].reverse().find(e => e.type === 'tab');
        if (prevTabEntry && prevTabEntry.type === 'tab') {
          setCurrentTab(prevTabEntry.tab);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem('smartreceipts_user');
      setReceipts([]);
      setUsers([]);
      setCurrentTab('dashboard');
      historyStackRef.current = [{ type: 'tab', tab: 'dashboard' }];
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
      
      const { data: userData } = await supabase.from('users').select('id, full_name, username');
      if (userData) setUsers(userData as User[]);

      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .or(`is_default.eq.true,user_id.eq.${user.id}`)
        .order('name');

      if (catData && catData.length > 0) {
        setCategories(catData);
      }

      let query = supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!isAdmin) {
          query = query.eq('user_id', user.id);
      } else {
          if (selectedLocation !== 'all') {
              query = query.eq('location', selectedLocation);
          }
      }

      const { data: recData } = await query;
      if (recData) setReceipts(recData as any);

      const { data: linkedData } = await supabase
        .from('sefaz_notes')
        .select('receipt_id')
        .not('receipt_id', 'is', null);
      if (linkedData) {
        setLinkedReceiptIds(new Set(linkedData.map((n: any) => n.receipt_id)));
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
    handleTabChange('receipts');
  };

  if (!user) {
      return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen font-sans">
      <Layout 
        currentTab={currentTab} 
        onTabChange={handleTabChange}
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

        {showNotifBanner && (
          <div className="mx-4 mt-2 bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-top-2">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
              <Bell size={20} className="text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">Ativar notificações?</p>
              <p className="text-[11px] text-gray-500">Receba avisos de downloads e notas salvas.</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleNotifDismiss} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-gray-500 bg-white border border-gray-200">Agora não</button>
              <button onClick={handleNotifAllow} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-brand-600 shadow-sm">Permitir</button>
            </div>
          </div>
        )}

        {currentTab === 'dashboard' && <Dashboard receipts={receipts} categories={categories} />}
        {currentTab === 'receipts' && (
            <ReceiptList 
                receipts={receipts} 
                categories={categories} 
                users={users}
                onRefresh={fetchData} 
                currentUser={user}
                linkedReceiptIds={linkedReceiptIds}
            />
        )}
        {currentTab === 'add' && (
          <AddReceipt 
            categories={categories} 
            onSaved={handleReceiptSaved} 
            currentUser={user}
            pushOverlay={pushOverlay}
            closeOverlay={closeOverlay}
            removeOverlayFromStack={removeOverlayFromStack}
            registerOverlayClose={registerOverlayClose}
            unregisterOverlayClose={unregisterOverlayClose}
          />
        )}
        {currentTab === 'admin' && (user.role === 'admin' || user.username === 'zoork22') && (
            <AdminPanel />
        )}
        {currentTab === 'sefaz' && (user.role === 'admin' || user.username === 'zoork22') && (user.location === 'Caratinga' || user.location === 'Ponte Nova') && (
            <SefazMonitor 
              currentUser={user} 
              categories={categories}
              pushOverlay={pushOverlay}
              closeOverlay={closeOverlay}
              registerOverlayClose={registerOverlayClose}
              unregisterOverlayClose={unregisterOverlayClose}
            />
        )}
        {currentTab === 'settings' && (user.role === 'admin' || user.username === 'zoork22') && (
            <Settings 
                categories={categories} 
                refreshCategories={fetchData} 
                receipts={receipts}
                userId={user.id}
                isAdmin={true}
            />
        )}
      </Layout>
    </div>
  );
}
