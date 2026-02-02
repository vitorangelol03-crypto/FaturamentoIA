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

  // Modified to accept a showLoading parameter (default true)
  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      // Fetch Categories
      const { data: catData } = await supabase.from('categories').select('*').order('name');
      if (catData && catData.length > 0) {
        setCategories(catData);
      }

      // Fetch Receipts
      const { data: recData } = await supabase.from('receipts').select('*').order('date', { ascending: false });
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
      <Layout currentTab={currentTab} onTabChange={setCurrentTab}>
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
                refreshCategories={() => fetchData(false)} // Pass silent refresh
                receipts={receipts}
            />
        )}
      </Layout>
    </div>
  );
}