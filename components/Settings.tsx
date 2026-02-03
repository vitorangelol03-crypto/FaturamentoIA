import React, { useState } from 'react';
import { Category, Receipt } from '../types';
import { Trash2, Plus, Download, BarChart2, AlertTriangle, Eraser, X, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface SettingsProps {
  categories: Category[];
  receipts: Receipt[];
  refreshCategories: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ categories, receipts, refreshCategories }) => {
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366F1');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Track which specific action is loading
  const [activeDeleteAction, setActiveDeleteAction] = useState<string | null>(null);

  const addCategory = async () => {
    if (!newCatName) return;
    const { error } = await supabase.from('categories').insert({
      name: newCatName,
      color: newCatColor,
      is_default: false
    });
    if (!error) {
      setNewCatName('');
      refreshCategories();
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Deletar categoria? Notas associadas ficarão sem categoria.")) return;
    await supabase.from('categories').delete().eq('id', id);
    refreshCategories();
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify({
        generated_at: new Date().toISOString(),
        receipts: receipts,
        categories: categories
    }, null, 2);
    
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smartreceipts_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeClearData = async (period: 'current_month' | 'last_month' | 'last_3_months' | 'all') => {
      // Remove window.confirm to avoid blocking UI issues, relying on the modal choice as confirmation.
      setActiveDeleteAction(period);

      try {
          let query = supabase.from('receipts').delete();
          const now = new Date();
          let startDate: Date | null = null;
          let endDate: Date | null = null;

          // Date Calculation Logic
          if (period === 'current_month') {
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          } else if (period === 'last_month') {
              startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          } else if (period === 'last_3_months') {
              startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
              // End date is today (or future)
          }

          // Apply Filters
          if (period !== 'all') {
              if (startDate) {
                  const startStr = startDate.toISOString().split('T')[0];
                  query = query.gte('date', startStr);
              }
              if (endDate) {
                   const endStr = endDate.toISOString().split('T')[0];
                   query = query.lte('date', endStr);
              }
          } else {
              // For 'all', explicit filter to satisfy some RLS/safe-delete requirements
              query = query.neq('id', '00000000-0000-0000-0000-000000000000');
          }

          const { error } = await query;
          
          if (error) {
              console.error("Supabase Delete Error:", error);
              throw error;
          }
          
          refreshCategories(); 
          setShowDeleteModal(false);
          alert("Notas removidas com sucesso!");
      } catch (e: any) {
          alert(`Erro ao limpar dados: ${e.message || "Erro desconhecido"}`);
      } finally {
          setActiveDeleteAction(null);
      }
  };

  return (
    <div className="bg-gray-50 p-4 relative">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h2>

      {/* Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center gap-4">
        <div className="p-3 bg-brand-50 rounded-full text-brand-600">
            <BarChart2 size={24} />
        </div>
        <div>
            <p className="text-sm text-gray-500">Uso do Sistema</p>
            <p className="font-bold text-gray-900">{receipts.length} notas processadas</p>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">Gerenciar Categorias</h3>
        
        <div className="space-y-3 mb-4">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                {cat.is_default && <span className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded">Padrão</span>}
              </div>
              {!cat.is_default && (
                <button onClick={() => deleteCategory(cat.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4 flex gap-2">
            <input 
                type="color" 
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0.5"
            />
            <input 
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nova Categoria..."
                className="flex-1 border border-gray-200 rounded-lg px-3 text-sm focus:border-brand-500 outline-none" 
            />
            <button 
                onClick={addCategory}
                className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700"
            >
                <Plus size={20} />
            </button>
        </div>
      </div>

      {/* Data Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 mb-2">Gerenciamento de Dados</h3>
        
        <button 
            onClick={exportJSON}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors"
        >
            <Download size={18} />
            Exportar Backup (JSON)
        </button>

        <button 
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 font-medium py-3 rounded-lg hover:bg-red-50 transition-colors"
        >
            <Eraser size={18} />
            Limpar Notas...
        </button>
        <p className="text-[10px] text-gray-400 text-center pt-1">
            <AlertTriangle size={10} className="inline mr-1" />
            Atenção: A limpeza de dados remove permanentemente os registros.
        </p>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                    <h3 className="font-bold text-red-700 flex items-center gap-2">
                        <Eraser size={20} />
                        Limpar Notas
                    </h3>
                    <button onClick={() => setShowDeleteModal(false)} className="text-red-400 hover:text-red-700">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">Selecione o período das notas que deseja excluir permanentemente:</p>
                    <div className="space-y-2">
                        <button 
                            onClick={() => executeClearData('current_month')}
                            disabled={activeDeleteAction !== null}
                            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium flex items-center justify-between group disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                <Calendar size={18} className="text-brand-500 group-hover:text-brand-600"/>
                                Este Mês
                            </div>
                            {activeDeleteAction === 'current_month' && <Loader2 className="animate-spin text-brand-500" size={18} />}
                        </button>
                        <button 
                             onClick={() => executeClearData('last_month')}
                             disabled={activeDeleteAction !== null}
                             className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium flex items-center justify-between group disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                <Calendar size={18} className="text-brand-500 group-hover:text-brand-600"/>
                                Mês Passado
                            </div>
                            {activeDeleteAction === 'last_month' && <Loader2 className="animate-spin text-brand-500" size={18} />}
                        </button>
                        <button 
                             onClick={() => executeClearData('last_3_months')}
                             disabled={activeDeleteAction !== null}
                             className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium flex items-center justify-between group disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                <Calendar size={18} className="text-brand-500 group-hover:text-brand-600"/>
                                Últimos 3 Meses
                            </div>
                             {activeDeleteAction === 'last_3_months' && <Loader2 className="animate-spin text-brand-500" size={18} />}
                        </button>
                         <button 
                             onClick={() => executeClearData('all')}
                             disabled={activeDeleteAction !== null}
                             className="w-full text-left px-4 py-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center justify-between mt-4 disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                <Eraser size={18} />
                                Todas as Notas
                            </div>
                             {activeDeleteAction === 'all' && <Loader2 className="animate-spin text-red-600" size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      <p className="text-center text-xs text-gray-400 mt-8">SmartReceipts AI v1.0.1</p>
    </div>
  );
};