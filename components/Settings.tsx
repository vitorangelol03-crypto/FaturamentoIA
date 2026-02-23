import React, { useState } from 'react';
import { Category, Receipt, User } from '../types';
import { Trash2, Plus, Download, BarChart2, AlertTriangle, Eraser, X, Calendar, Loader2, Check, Palette, Search, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { clsx } from 'clsx';

const COLOR_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#78716C', '#6B7280', '#1E293B',
];

interface SettingsProps {
  categories: Category[];
  receipts: Receipt[];
  refreshCategories: () => void;
  userId: string;
  isAdmin?: boolean;
  users?: User[];
}

export const Settings: React.FC<SettingsProps> = ({ categories, receipts, refreshCategories, userId, isAdmin, users }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeDeleteAction, setActiveDeleteAction] = useState<string | null>(null);
  const [catModal, setCatModal] = useState<{ mode: 'add' | 'edit'; id?: string; name: string; color: string } | null>(null);
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const [showAdvancedDelete, setShowAdvancedDelete] = useState(false);
  const [advFilterUser, setAdvFilterUser] = useState('');
  const [advFilterDate, setAdvFilterDate] = useState('');
  const [advResults, setAdvResults] = useState<any[]>([]);
  const [advLoading, setAdvLoading] = useState(false);
  const [advSelected, setAdvSelected] = useState<Set<string>>(new Set());
  const [advDeleting, setAdvDeleting] = useState(false);
  const [advSearched, setAdvSearched] = useState(false);

  const advSearch = async () => {
    if (!advFilterUser && !advFilterDate) return;
    setAdvLoading(true);
    setAdvSearched(true);
    setAdvSelected(new Set());
    try {
      let query = supabase
        .from('receipts')
        .select('id,establishment,total_amount,date,created_at,user_id,category_name,category_color')
        .order('created_at', { ascending: false })
        .limit(200);
      if (advFilterUser) query = query.eq('user_id', advFilterUser);
      if (advFilterDate) query = query.eq('date', advFilterDate);
      const { data, error } = await query;
      if (error) throw error;
      setAdvResults(data || []);
    } catch (err: any) {
      alert('Erro ao buscar: ' + (err.message || 'Erro'));
      setAdvResults([]);
    } finally {
      setAdvLoading(false);
    }
  };

  const advToggle = (id: string) => {
    setAdvSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const advToggleAll = () => {
    if (advSelected.size === advResults.length) {
      setAdvSelected(new Set());
    } else {
      setAdvSelected(new Set(advResults.map(r => r.id)));
    }
  };

  const advDeleteSelected = async () => {
    if (advSelected.size === 0) return;
    if (!confirm(`Excluir permanentemente ${advSelected.size} nota(s)? Esta ação não pode ser desfeita.`)) return;
    setAdvDeleting(true);
    try {
      const ids = Array.from(advSelected);
      await supabase.from('sefaz_notes').update({ receipt_id: null }).in('receipt_id', ids);
      const BATCH = 50;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { error } = await supabase.from('receipts').delete().in('id', batch);
        if (error) throw error;
      }
      alert(`${advSelected.size} nota(s) excluída(s) com sucesso!`);
      setAdvResults(prev => prev.filter(r => !advSelected.has(r.id)));
      setAdvSelected(new Set());
      refreshCategories();
    } catch (err: any) {
      alert('Erro ao excluir: ' + (err.message || 'Erro'));
    } finally {
      setAdvDeleting(false);
    }
  };

  const getUserName = (uid: string) => {
    const u = (users || []).find(u => u.id === uid);
    return u ? u.full_name : 'Usuário';
  };

  const openAddModal = () => setCatModal({ mode: 'add', name: '', color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)] });
  const openEditModal = (cat: Category) => setCatModal({ mode: 'edit', id: cat.id, name: cat.name, color: cat.color });

  const saveCategory = async () => {
    if (!catModal || !catModal.name.trim()) return;
    setIsSavingCat(true);
    try {
      if (catModal.mode === 'add') {
        const { error } = await supabase.from('categories').insert({
          name: catModal.name.trim(),
          color: catModal.color,
          is_default: false,
          user_id: userId
        });
        if (error) throw error;
      } else if (catModal.id) {
        const { error } = await supabase.from('categories').update({
          name: catModal.name.trim(),
          color: catModal.color
        }).eq('id', catModal.id);
        if (error) throw error;
      }
      setCatModal(null);
      refreshCategories();
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsSavingCat(false);
    }
  };

  const deleteCategory = async (id: string) => {
    setDeletingCatId(id);
    try {
      await supabase.from('categories').delete().eq('id', id);
      refreshCategories();
    } finally {
      setDeletingCatId(null);
    }
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
      if (!isAdmin) return;
      setActiveDeleteAction(period);
      try {
          let query = supabase.from('receipts').delete();
          const now = new Date();
          let startDate: Date | null = null;
          let endDate: Date | null = null;
          if (period === 'current_month') {
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          } else if (period === 'last_month') {
              startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          } else if (period === 'last_3_months') {
              startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          }
          if (period === 'all') {
              query = query.gte('id', '00000000-0000-0000-0000-000000000000');
          } else {
              if (startDate) query = query.gte('date', startDate.toISOString().split('T')[0]);
              if (endDate) query = query.lte('date', endDate.toISOString().split('T')[0]);
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

  const catCount = (catId: string) => receipts.filter(r => r.category_id === catId).length;

  return (
    <div className="bg-gray-50 p-4 relative">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center gap-4">
        <div className="p-3 bg-brand-50 rounded-full text-brand-600">
            <BarChart2 size={24} />
        </div>
        <div>
            <p className="text-sm text-gray-500">Uso do Sistema {isAdmin ? '(Global)' : ''}</p>
            <p className="font-bold text-gray-900">{receipts.length} notas processadas</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Palette size={18} className="text-brand-500" /> Categorias</h3>
            <button onClick={openAddModal} className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors">
                <Plus size={14} /> Nova
            </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => openEditModal(cat)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all group"
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: cat.color }}></div>
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{cat.name}</span>
              <span className="text-[10px] text-gray-400 font-medium bg-white px-1.5 py-0.5 rounded-md min-w-[20px] text-center">{catCount(cat.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 mb-2">Gerenciamento de Dados</h3>
        <button 
            onClick={exportJSON}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors"
        >
            <Download size={18} />
            Exportar Backup (JSON)
        </button>
        {isAdmin && (
            <>
                <button 
                    onClick={() => setShowDeleteModal(true)}
                    className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 font-medium py-3 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <Eraser size={18} />
                    Limpar Notas por Período...
                </button>
                <button 
                    onClick={() => { setShowAdvancedDelete(true); setAdvResults([]); setAdvSearched(false); setAdvFilterUser(''); setAdvFilterDate(''); setAdvSelected(new Set()); }}
                    className="w-full flex items-center justify-center gap-2 border border-orange-200 text-orange-600 font-medium py-3 rounded-lg hover:bg-orange-50 transition-colors"
                >
                    <Search size={18} />
                    Excluir por Usuário / Data...
                </button>
                <p className="text-[10px] text-gray-400 text-center pt-1">
                    <AlertTriangle size={10} className="inline mr-1" />
                    Atenção: A exclusão de dados é permanente e não pode ser desfeita.
                </p>
            </>
        )}
      </div>

      {catModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden sm:!mb-0" style={{ marginBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">{catModal.mode === 'add' ? 'Nova Categoria' : 'Editar Categoria'}</h3>
                    <button onClick={() => setCatModal(null)} className="text-gray-400 hover:text-gray-700 p-1"><X size={20} /></button>
                </div>
                <div className="p-5 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Nome</label>
                        <input
                            type="text"
                            value={catModal.name}
                            onChange={(e) => setCatModal({...catModal, name: e.target.value})}
                            placeholder="Ex: Alimentação"
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 ring-brand-500 outline-none"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Cor</label>
                        <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
                            {COLOR_PALETTE.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCatModal({...catModal, color: c})}
                                    className={clsx(
                                        "w-7 h-7 rounded-full transition-all flex items-center justify-center",
                                        catModal.color === c ? "ring-2 ring-offset-2 ring-gray-800 scale-110" : "hover:scale-110 ring-1 ring-black/5"
                                    )}
                                    style={{ backgroundColor: c }}
                                >
                                    {catModal.color === c && <Check size={14} className="text-white drop-shadow-sm" />}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <div className="w-8 h-8 rounded-full ring-1 ring-black/10" style={{ backgroundColor: catModal.color }}></div>
                            <input
                                type="text"
                                value={catModal.color}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setCatModal({...catModal, color: v});
                                }}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-500 focus:ring-1 ring-brand-500 outline-none"
                                maxLength={7}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex border-t border-gray-100">
                    {catModal.mode === 'edit' && catModal.id && (
                        <button
                            onClick={() => { if (confirm('Excluir esta categoria? Notas associadas ficarão sem categoria.')) { deleteCategory(catModal.id!); setCatModal(null); } }}
                            disabled={deletingCatId === catModal.id}
                            className="flex items-center justify-center gap-2 px-5 py-3.5 text-red-500 font-medium hover:bg-red-50 transition-colors border-r border-gray-100"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button onClick={() => setCatModal(null)} className="flex-1 py-3.5 text-gray-500 font-medium hover:bg-gray-50 transition-colors border-r border-gray-100">Cancelar</button>
                    <button
                        onClick={saveCategory}
                        disabled={isSavingCat || !catModal.name.trim()}
                        className="flex-1 py-3.5 text-brand-600 font-bold hover:bg-brand-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {isSavingCat ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        {catModal.mode === 'add' ? 'Criar' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {showDeleteModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                    <h3 className="font-bold text-red-700 flex items-center gap-2">
                        <Eraser size={20} />
                        Limpar Notas (Admin)
                    </h3>
                    <button onClick={() => setShowDeleteModal(false)} className="text-red-400 hover:text-red-700">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">Selecione o período das notas que deseja excluir permanentemente:</p>
                    <div className="space-y-2">
                        {(['current_month', 'last_month', 'last_3_months'] as const).map(p => (
                            <button 
                                key={p}
                                onClick={() => executeClearData(p)}
                                disabled={activeDeleteAction !== null}
                                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium flex items-center justify-between group disabled:opacity-50"
                            >
                                <div className="flex items-center gap-3">
                                    <Calendar size={18} className="text-brand-500 group-hover:text-brand-600"/>
                                    {p === 'current_month' ? 'Este Mês' : p === 'last_month' ? 'Mês Passado' : 'Últimos 3 Meses'}
                                </div>
                                {activeDeleteAction === p && <Loader2 className="animate-spin text-brand-500" size={18} />}
                            </button>
                        ))}
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
      
      {showAdvancedDelete && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh] sm:!mb-0" style={{ marginBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
                <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center flex-shrink-0">
                    <h3 className="font-bold text-orange-700 flex items-center gap-2">
                        <Search size={20} />
                        Excluir por Usuário / Data
                    </h3>
                    <button onClick={() => setShowAdvancedDelete(false)} className="text-orange-400 hover:text-orange-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100 space-y-3 flex-shrink-0">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Usuário</label>
                        <select
                            value={advFilterUser}
                            onChange={e => setAdvFilterUser(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:ring-2 ring-orange-500 outline-none"
                        >
                            <option value="">Todos os usuários</option>
                            {(users || []).map(u => (
                                <option key={u.id} value={u.id}>{u.full_name} (@{u.username})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Data de Pagamento</label>
                        <input
                            type="date"
                            value={advFilterDate}
                            onChange={e => setAdvFilterDate(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:ring-2 ring-orange-500 outline-none"
                        />
                    </div>
                    <button
                        onClick={advSearch}
                        disabled={advLoading || (!advFilterUser && !advFilterDate)}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
                    >
                        {advLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        Buscar Notas
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-4">
                    {!advSearched ? (
                        <div className="text-center py-8 text-gray-400">
                            <Search size={40} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Selecione um usuário e/ou data e clique em Buscar.</p>
                        </div>
                    ) : advLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-orange-500" size={32} />
                        </div>
                    ) : advResults.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Check size={40} className="mx-auto mb-2 opacity-20 text-green-400" />
                            <p className="text-sm">Nenhuma nota encontrada com esses filtros.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-3">
                                <button
                                    onClick={advToggleAll}
                                    className="flex items-center gap-2 text-xs font-bold text-orange-600 hover:text-orange-700"
                                >
                                    {advSelected.size === advResults.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                    {advSelected.size === advResults.length ? 'Desmarcar todas' : 'Selecionar todas'}
                                </button>
                                <span className="text-[10px] text-gray-400 font-medium">{advResults.length} nota(s) encontrada(s)</span>
                            </div>
                            {advResults.map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => advToggle(r.id)}
                                    className={clsx(
                                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                        advSelected.has(r.id)
                                            ? "border-red-300 bg-red-50"
                                            : "border-gray-100 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <div className="flex-shrink-0">
                                        {advSelected.has(r.id) ? (
                                            <CheckSquare size={20} className="text-red-500" />
                                        ) : (
                                            <Square size={20} className="text-gray-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-900 truncate">{r.establishment}</p>
                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                                            <span>{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                            <span>•</span>
                                            <span>{getUserName(r.user_id)}</span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        <p className="font-bold text-sm text-brand-600">{Number(r.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        {r.category_name && (
                                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold text-white" style={{ backgroundColor: r.category_color || '#6B7280' }}>{r.category_name}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {advResults.length > 0 && advSelected.size > 0 && (
                    <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white">
                        <button
                            onClick={advDeleteSelected}
                            disabled={advDeleting}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50 transition-colors"
                        >
                            {advDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            Excluir {advSelected.size} nota(s) selecionada(s)
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}
      
      <p className="text-center text-xs text-gray-400 mt-8">SmartReceipts AI v1.0.1</p>
    </div>
  );
};
