import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ReceiptList } from './components/ReceiptList';
import { AddReceipt } from './components/AddReceipt';
import { Settings } from './components/Settings';
import { supabase } from './services/supabaseClient';
import { Receipt, Category } from './types';
import { DEFAULT_CATEGORIES } from './constants';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  
  // Filtro Global de Empresa ('all', 'Caratinga', 'Ponte Nova')
  // Persiste a escolha no localStorage para não resetar ao recarregar
  const [selectedLocation, setSelectedLocation] = useState<string>(() => {
      return localStorage.getItem('smartreceipts_location') || 'all';
  });

  const handleLocationChange = (loc: string) => {
      setSelectedLocation(loc);
      localStorage.setItem('smartreceipts_location', loc);
      fetchData(true, loc); // Recarrega dados filtrados
  };

  const fetchData = async (showLoading = true, locationFilter = selectedLocation) => {
    try {
      if (showLoading) setLoading(true);
      
      // Fetch Categories
      const { data: catData } = await supabase.from('categories').select('*').order('name');
      if (catData && catData.length > 0) {
        setCategories(catData);
      }

      // Fetch Receipts with optional filter
      let query = supabase.from('receipts').select('*').order('date', { ascending: false });
      
      if (locationFilter !== 'all') {
          query = query.eq('location', locationFilter);
      }

      const { data: recData } = await query;
      
      if (recData) {
        setReceipts(recData as any);
      }
    } catch (e) {
      console.error("Error fetching data", e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReceiptSaved = () => {
    fetchData(false); // Silent update
    setCurrentTab('receipts');
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen font-sans">
      <Layout 
        currentTab={currentTab} 
        onTabChange={setCurrentTab}
        selectedLocation={selectedLocation}
        onLocationChange={handleLocationChange}
      >
        {currentTab === 'dashboard' && <Dashboard receipts={receipts} categories={categories} />}
        {currentTab === 'receipts' && (
            <ReceiptList 
                receipts={receipts} 
                categories={categories} 
                onRefresh={() => fetchData(false)} 
            />
        )}
        {currentTab === 'add' && <AddReceipt categories={categories} onSaved={handleReceiptSaved} />}
        {currentTab === 'settings' && (
            <Settings 
                categories={categories} 
                refreshCategories={() => fetchData(false)} 
                receipts={receipts}
            />
        )}
      </Layout>
    </div>
  );
}