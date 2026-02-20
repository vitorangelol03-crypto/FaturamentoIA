import React, { useState, useMemo, useEffect } from 'react';
import { Receipt, Category, ViewMode, PeriodFilter, User, isAdmin as checkIsAdmin } from '../types';
import { 
  LayoutGrid, List, AlignJustify, Search,
  Image as ImageIcon, Filter, Edit2, X, Save, Loader2, Download, Trash2,
  FileText, Lock, CheckCircle,
  Clock, User as UserIcon, Shield, FileDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { generatePDFReport, generateSingleReceiptPDF } from '../services/pdfService';
import { supabase } from '../services/supabaseClient';
import { notificationService } from '../services/notificationService';

interface ReceiptListProps {
  receipts: Receipt[];
  categories: Category[];
  users: User[];
  onRefresh?: () => void;
  currentUser: User;
  linkedReceiptIds: Set<string>;
}

export const ReceiptList: React.FC<ReceiptListProps> = ({ receipts, categories, users, onRefresh, currentUser, linkedReceiptIds }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('current_month');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [sefazFilter, setSefazFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [categorySourceUserId, setCategorySourceUserId] = useState<string>('mine');
  const [filterCategories, setFilterCategories] = useState<Category[]>(categories);

  useEffect(() => {
    if (categorySourceUserId === 'mine') {
      setFilterCategories(categories);
      setSelectedCats([]);
    } else {
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', categorySourceUserId)
        .order('name')
        .then(({ data }) => {
          setFilterCategories(data || []);
          setSelectedCats([]);
        });
    }
  }, [categorySourceUserId, categories]);

  // States for Modals
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);
  const [isDeletingReceipt, setIsDeletingReceipt] = useState(false);

  // Time-based editing logic
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000); 
    return () => clearInterval(timer);
  }, []);

  const isAdmin = checkIsAdmin(currentUser);

  const canEditReceipt = (receipt: Receipt): boolean => {
    if (isAdmin) return true;
    const createdTime = new Date(receipt.created_at).getTime();
    const diffMinutes = (currentTime - createdTime) / (1000 * 60);
    return diffMinutes <= 5;
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    setIsDeletingReceipt(true);
    try {
      await supabase.from('sefaz_notes').update({ receipt_id: null }).eq('receipt_id', receiptId);
      const { error } = await supabase.from('receipts').delete().eq('id', receiptId);
      if (error) throw error;
      setDeletingReceiptId(null);
      setViewingReceipt(null);
      onRefresh?.();
    } catch (err: any) {
      alert('Erro ao excluir: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsDeletingReceipt(false);
    }
  };

  const getUserName = (userId?: string | null) => {
    if (!userId) return 'Sistema/Externo';
    const u = users.find(user => user.id === userId);
    return u ? u.full_name : 'Usuário ' + userId.slice(0, 4);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return 'Data inválida'; }
  };

  // --- FILTER LOGIC ---
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      // 1. Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        r.establishment.toLowerCase().includes(searchLower) || 
        (r.items?.some(i => i.name.toLowerCase().includes(searchLower)) ?? false);
      
      if (!matchesSearch) return false;

      // 2. Category filter (match by name when using another user's categories)
      if (selectedCats.length > 0) {
        const selectedNames = selectedCats.map(id => filterCategories.find(c => c.id === id)?.name).filter(Boolean);
        const receiptCatName = r.category_name || categories.find(c => c.id === r.category_id)?.name;
        if (!selectedNames.includes(receiptCatName)) return false;
      }

      // 3. SEFAZ link filter
      if (sefazFilter === 'linked' && !linkedReceiptIds.has(r.id)) return false;
      if (sefazFilter === 'unlinked' && linkedReceiptIds.has(r.id)) return false;

      // 4. Period filter
      const rDate = new Date(r.date + 'T12:00:00'); 
      const now = new Date();
      
      if (period === 'current_month') {
        return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
      } else if (period === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return rDate.getMonth() === lastMonth.getMonth() && rDate.getFullYear() === lastMonth.getFullYear();
      } else if (period === 'last_3_months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return rDate >= threeMonthsAgo;
      } else if (period === 'year') {
        return rDate.getFullYear() === now.getFullYear();
      }
      return true; // "all"
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [receipts, searchQuery, selectedCats, period, sefazFilter, linkedReceiptIds, filterCategories, categories]);

  const toggleCategory = (id: string) => {
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const downloadReport = () => {
    if (!isAdmin) return;
    const periodLabels: Record<string, string> = {
      'current_month': 'Este Mês',
      'last_month': 'Mês Passado',
      'last_3_months': 'Últimos 3 Meses',
      'year': 'Este Ano',
      'custom': 'Geral'
    };
    
    let label = periodLabels[period] || 'Relatório';
    generatePDFReport(filteredReceipts, categories, label, formatDateTime(new Date().toISOString()), true);
    notificationService.notifyDownload(`Relatório ${label}.pdf`);
  };

  const handleDownloadSingle = (e: React.MouseEvent, receipt: Receipt) => {
      e.stopPropagation();
      const catName = categories.find(c => c.id === receipt.category_id)?.name || 'Outros';
      generateSingleReceiptPDF(receipt, catName);
      notificationService.notifyDownload(`${receipt.establishment}.pdf`);
  };

  const handleCardClick = (receipt: Receipt) => {
      setViewingReceipt(receipt);
  };

  const getCat = (id: string) => categories.find(c => c.id === id);

  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      {/* --- MODAL: IMAGE ZOOM --- */}
      {zoomedImage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-in fade-in" onClick={() => setZoomedImage(null)}>
              <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
                  <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-md" alt="Zoom" />
                  <button className="absolute top-4 right-4 bg-white/20 text-white p-2 rounded-full"><X size={24} /></button>
              </div>
          </div>
      )}

      {/* --- MODAL: DETAIL VIEW --- */}
      {viewingReceipt && !editingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] sm:max-h-[90vh] sm:!mb-0" style={{ marginBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
                <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-900 truncate pr-4 text-lg">{viewingReceipt.establishment}</h3>
                    <button onClick={() => setViewingReceipt(null)} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full border border-gray-200"><X size={20} /></button>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0 p-0">
                    <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden group cursor-zoom-in" onClick={() => {
                      if (viewingReceipt.image_url && !viewingReceipt.image_url.startsWith('data:application/pdf')) {
                        setZoomedImage(viewingReceipt.image_url);
                      }
                    }}>
                         {viewingReceipt.image_url ? (
                            viewingReceipt.image_url.startsWith('data:application/pdf') ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-400">
                                <FileText size={48} className="mb-2" />
                                <span className="text-xs font-medium">Documento PDF</span>
                              </div>
                            ) : (
                              <img src={viewingReceipt.image_url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" alt="Comprovante" />
                            )
                        ) : (
                            <div className="flex flex-col items-center text-gray-400"><ImageIcon size={32} /></div>
                        )}
                        <div className="absolute bottom-3 right-3">
                             {(() => { const viewCatName = viewingReceipt.category_name || getCat(viewingReceipt.category_id)?.name || 'Outros'; const viewCatColor = viewingReceipt.category_color || getCat(viewingReceipt.category_id)?.color || '#6B7280'; return <span className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm" style={{backgroundColor: viewCatColor}}>{viewCatName}</span>; })()}
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="text-gray-400 text-[10px] uppercase font-bold mb-1">Data de Pagamento</div>
                                <div className="font-medium text-gray-900">{new Date(viewingReceipt.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="text-gray-400 text-[10px] uppercase font-bold mb-1">Valor Total</div>
                                <div className="font-bold text-xl text-brand-600">R$ {Number(viewingReceipt.total_amount).toFixed(2)}</div>
                            </div>
                        </div>
                        {(viewingReceipt.issue_date || viewingReceipt.due_date) && (
                          <div className="grid grid-cols-2 gap-4">
                            {viewingReceipt.issue_date && viewingReceipt.issue_date.length >= 10 && (
                              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                                <div className="text-amber-500 text-[10px] uppercase font-bold mb-1">Data de Emissão</div>
                                <div className="font-medium text-gray-900">{(() => { try { return new Date(viewingReceipt.issue_date + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return viewingReceipt.issue_date; } })()}</div>
                              </div>
                            )}
                            {viewingReceipt.due_date && viewingReceipt.due_date.length >= 10 && (
                              <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                                <div className="text-orange-500 text-[10px] uppercase font-bold mb-1">Data de Vencimento</div>
                                <div className="font-medium text-gray-900">{(() => { try { return new Date(viewingReceipt.due_date + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return viewingReceipt.due_date; } })()}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* AUDIT SECTION */}
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                            <h4 className="text-[10px] font-bold text-blue-800 uppercase mb-3 flex items-center gap-1.5">
                                <Shield size={12} /> Auditoria do Lançamento
                            </h4>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <UserIcon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-blue-700/60 leading-none mb-1">Lançado por:</p>
                                        <p className="text-sm font-bold text-blue-900">{getUserName(viewingReceipt.user_id)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Clock size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-blue-700/60 leading-none mb-1">Data do Registro:</p>
                                        <p className="text-sm font-bold text-blue-900">{formatDateTime(viewingReceipt.created_at)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {viewingReceipt.observations && (
                            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                                <h4 className="text-[10px] font-bold text-amber-800 uppercase mb-2 flex items-center gap-1.5">
                                    <FileText size={12} /> Observações
                                </h4>
                                <p className="text-sm text-amber-900 whitespace-pre-wrap">{viewingReceipt.observations}</p>
                            </div>
                        )}

                        {viewingReceipt.items && viewingReceipt.items.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText size={16} /> Itens Extraídos</h4>
                                <div className="border border-gray-100 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <tbody className="divide-y divide-gray-100">
                                            {viewingReceipt.items.map((item, idx) => (
                                                <tr key={idx}><td className="px-3 py-2 text-gray-700 font-medium">{item.name}</td><td className="px-3 py-2 text-right font-bold text-gray-900">{item.totalPrice?.toFixed(2) || '0.00'}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] border-t border-gray-100 bg-gray-50 flex gap-3">
                     <button onClick={(e) => handleDownloadSingle(e, viewingReceipt)} className="flex items-center justify-center gap-2 bg-white border border-gray-200 py-3 px-4 rounded-xl font-medium"><Download size={18} /></button>
                     {canEditReceipt(viewingReceipt) ? (
                        <button onClick={(e) => { setViewingReceipt(null); setEditingReceipt(viewingReceipt); }} className="flex-1 flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl font-medium shadow-sm"><Edit2 size={18} /> Editar</button>
                    ) : (
                        <button disabled className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-400 py-3 rounded-xl font-medium cursor-not-allowed"><Lock size={16} /> Bloqueado</button>
                    )}
                    {isAdmin && (
                        <button onClick={() => setDeletingReceiptId(viewingReceipt.id)} className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 py-3 px-4 rounded-xl font-medium hover:bg-red-100 transition-colors"><Trash2 size={18} /></button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL: DELETE CONFIRMATION --- */}
      {deletingReceiptId && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 text-center">
                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 size={28} className="text-red-500" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2">Excluir Nota</h3>
                    <p className="text-gray-500 text-sm">Tem certeza que deseja excluir esta nota? Esta ação não pode ser desfeita.</p>
                </div>
                <div className="flex border-t border-gray-100">
                    <button onClick={() => setDeletingReceiptId(null)} disabled={isDeletingReceipt} className="flex-1 py-3.5 text-gray-600 font-medium border-r border-gray-100 hover:bg-gray-50 transition-colors">Cancelar</button>
                    <button onClick={() => handleDeleteReceipt(deletingReceiptId)} disabled={isDeletingReceipt} className="flex-1 py-3.5 text-red-600 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                        {isDeletingReceipt ? <><Loader2 size={16} className="animate-spin" /> Excluindo...</> : 'Excluir'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL: EDIT RECEIPT --- */}
      {editingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[90vh] sm:!mb-0" style={{ marginBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
                <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-900 text-lg">Editar Nota</h3>
                    <button onClick={() => { setEditingReceipt(null); setViewingReceipt(editingReceipt); }} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full border border-gray-200"><X size={20} /></button>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0 p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Estabelecimento</label>
                        <input
                            type="text"
                            value={editingReceipt.establishment}
                            onChange={(e) => setEditingReceipt({...editingReceipt, establishment: e.target.value})}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 ring-brand-500 outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Pagamento</label>
                            <input
                                type="date"
                                value={editingReceipt.date}
                                onChange={(e) => setEditingReceipt({...editingReceipt, date: e.target.value})}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-brand-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Valor (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={editingReceipt.total_amount}
                                onChange={(e) => setEditingReceipt({...editingReceipt, total_amount: parseFloat(e.target.value) || 0})}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-brand-600 focus:ring-2 ring-brand-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Emissão</label>
                            <input
                                type="date"
                                value={editingReceipt.issue_date || ''}
                                onChange={(e) => setEditingReceipt({...editingReceipt, issue_date: e.target.value || undefined})}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-brand-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Vencimento</label>
                            <input
                                type="date"
                                value={editingReceipt.due_date || ''}
                                onChange={(e) => setEditingReceipt({...editingReceipt, due_date: e.target.value || undefined})}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-brand-500 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Categoria</label>
                        <div className="grid grid-cols-2 gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setEditingReceipt({...editingReceipt, category_id: cat.id})}
                                    className={clsx(
                                        "text-xs px-3 py-2.5 rounded-xl border transition-colors text-left flex items-center gap-2 min-h-[40px]",
                                        editingReceipt.category_id === cat.id
                                            ? "bg-brand-50 border-brand-500 text-brand-700 font-bold"
                                            : "bg-white border-gray-200 text-gray-600"
                                    )}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: cat.color}}></div>
                                    <span className="break-words leading-tight">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {isAdmin && (
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Unidade</label>
                            <div className="flex gap-2">
                                {['Caratinga', 'Ponte Nova'].map(loc => (
                                    <button
                                        key={loc}
                                        onClick={() => setEditingReceipt({...editingReceipt, location: loc})}
                                        className={clsx(
                                            "flex-1 py-2.5 text-xs font-bold rounded-xl border transition-colors",
                                            editingReceipt.location === loc
                                                ? "bg-brand-50 border-brand-500 text-brand-700"
                                                : "bg-white border-gray-200 text-gray-500"
                                        )}
                                    >
                                        {loc}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Observações</label>
                        <textarea
                            value={editingReceipt.observations || ''}
                            onChange={(e) => setEditingReceipt({...editingReceipt, observations: e.target.value})}
                            placeholder="Adicionar observações sobre esta nota..."
                            rows={3}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-brand-500 outline-none resize-none"
                        />
                    </div>
                </div>
                <div className="flex-shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] border-t border-gray-100 bg-gray-50 flex gap-3">
                    <button
                        onClick={() => { setEditingReceipt(null); setViewingReceipt(editingReceipt); }}
                        className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 py-3 rounded-xl font-medium text-gray-600"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={isSavingEdit}
                        onClick={async () => {
                            if (!editingReceipt) return;
                            setIsSavingEdit(true);
                            try {
                                const editCat = categories.find(c => c.id === editingReceipt.category_id);
                                const { error } = await supabase.from('receipts').update({
                                    establishment: editingReceipt.establishment,
                                    date: editingReceipt.date,
                                    issue_date: editingReceipt.issue_date || null,
                                    due_date: editingReceipt.due_date || null,
                                    total_amount: editingReceipt.total_amount,
                                    category_id: editingReceipt.category_id,
                                    category_name: editCat?.name || null,
                                    category_color: editCat?.color || null,
                                    location: editingReceipt.location,
                                    observations: editingReceipt.observations || null,
                                }).eq('id', editingReceipt.id);
                                if (error) throw error;
                                setEditingReceipt(null);
                                if (onRefresh) onRefresh();
                            } catch (err) {
                                alert('Erro ao salvar alterações.');
                            } finally {
                                setIsSavingEdit(false);
                            }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl font-bold shadow-sm"
                    >
                        {isSavingEdit ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- SEARCH & FILTERS --- */}
      <div className="bg-white p-4 shadow-sm z-10 sticky top-0 border-b border-gray-100">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar nota ou item..." 
            className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 ring-brand-500 outline-none transition-all" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={clsx("absolute right-2 top-1.5 p-1 rounded-md transition-colors", showFilters ? "bg-brand-100 text-brand-600" : "text-gray-400")}
          >
            <Filter size={18} />
          </button>
        </div>

        {showFilters && (
            <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-4">
                  {/* Filtro de Período */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Período</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            {id: 'current_month', label: 'Este Mês'},
                            {id: 'last_month', label: 'Mês Passado'},
                            {id: 'last_3_months', label: '3 Meses'},
                            {id: 'custom', label: 'Geral'}
                        ].map(p => (
                            <button 
                                key={p.id}
                                onClick={() => setPeriod(p.id as any)}
                                className={clsx("px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all shadow-sm", period === p.id ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-gray-200 text-gray-500")}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                  </div>

                  {/* Filtro de Categorias */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Categorias</p>
                      <select
                        value={categorySourceUserId}
                        onChange={(e) => setCategorySourceUserId(e.target.value)}
                        className="text-[10px] bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:border-brand-400"
                      >
                        <option value="mine">Minhas categorias</option>
                        {users.filter(u => u.id !== currentUser.id).map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <button 
                            onClick={() => setSelectedCats([])}
                            className={clsx(
                              "px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all shadow-sm",
                              selectedCats.length === 0 ? "bg-gray-800 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-500"
                            )}
                        >
                            Todas
                        </button>
                        {filterCategories.map(cat => (
                            <button 
                                key={cat.id}
                                onClick={() => toggleCategory(cat.id)}
                                className={clsx(
                                  "px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all shadow-sm flex items-center gap-1.5",
                                  selectedCats.includes(cat.id) ? "border-brand-600 bg-brand-50 text-brand-700" : "bg-white border-gray-200 text-gray-500"
                                )}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                                {cat.name}
                            </button>
                        ))}
                    </div>
                  </div>

                  {/* Filtro SEFAZ */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Vínculo SEFAZ</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            {id: 'all' as const, label: 'Todas'},
                            {id: 'linked' as const, label: 'Vinculadas'},
                            {id: 'unlinked' as const, label: 'Não vinculadas'}
                        ].map(f => (
                            <button 
                                key={f.id}
                                onClick={() => setSefazFilter(f.id)}
                                className={clsx("px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all shadow-sm", sefazFilter === f.id ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-200 text-gray-500")}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                  </div>
                </div>
            </div>
        )}

        <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
                  {filteredReceipts.length} notas
                </span>
                
                {/* Botão de Relatório Restabelecido - RESTRICTED TO ADMINS ONLY */}
                {isAdmin && (
                  <button 
                    onClick={downloadReport}
                    className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-brand-600 transition-colors bg-white border border-gray-200 px-2 py-0.5 rounded-full"
                  >
                    <FileDown size={12} />
                    Baixar Relatório
                  </button>
                )}
            </div>
            
            <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={() => setViewMode('list')} className={clsx("p-1.5 rounded-md transition-all", viewMode === 'list' && "bg-white shadow-sm text-brand-600")}><List size={16} /></button>
                <button onClick={() => setViewMode('grid')} className={clsx("p-1.5 rounded-md transition-all", viewMode === 'grid' && "bg-white shadow-sm text-brand-600")}><LayoutGrid size={16} /></button>
                <button onClick={() => setViewMode('compact')} className={clsx("p-1.5 rounded-md transition-all", viewMode === 'compact' && "bg-white shadow-sm text-brand-600")}><AlignJustify size={16} /></button>
            </div>
        </div>
      </div>

      {/* --- LIST CONTENT --- */}
      <div className="p-4 space-y-3 pb-24 flex-1">
        {filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                <Search size={48} className="mb-3 opacity-20"/>
                <p className="text-sm font-medium">Nenhuma nota encontrada com os filtros atuais.</p>
                {(searchQuery || selectedCats.length > 0 || period !== 'current_month' || sefazFilter !== 'all') && (
                  <button 
                    onClick={() => { setSearchQuery(''); setSelectedCats([]); setPeriod('current_month'); setSefazFilter('all'); }}
                    className="mt-4 text-brand-600 text-xs font-bold hover:underline"
                  >
                    Limpar todos os filtros
                  </button>
                )}
            </div>
        ) : (
            <div className={clsx(viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-3")}>
                {filteredReceipts.map(receipt => {
                    const category = getCat(receipt.category_id);
                    const uploaderName = getUserName(receipt.user_id);
                    
                    if (viewMode === 'grid') {
                        return (
                            <div key={receipt.id} onClick={() => handleCardClick(receipt)} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 flex flex-col relative group cursor-pointer active:scale-95 transition-all">
                                <div className="h-24 bg-gray-100 relative">
                                    {receipt.image_url ? (
                                      receipt.image_url.startsWith('data:application/pdf') ? (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><FileText size={24} /></div>
                                      ) : (
                                        <img src={receipt.image_url} className="w-full h-full object-cover" alt="" />
                                      )
                                    ) : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon /></div>}
                                    {(() => { const catName = receipt.category_name || category?.name || 'Outros'; const catColor = receipt.category_color || category?.color || '#6B7280'; return <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white shadow-sm z-10" style={{backgroundColor: catColor}}>{catName}</div>; })()}
                                </div>
                                <div className="p-2.5">
                                    <p className="font-bold text-gray-900 text-[10px] truncate mb-0.5">{receipt.establishment}</p>
                                    <p className="text-xs text-brand-600 font-bold mb-1.5">R$ {Number(receipt.total_amount).toFixed(2)}</p>
                                    <div className="border-t border-gray-50 pt-1.5 space-y-0.5">
                                        <div className="flex items-center gap-1 text-[8px] text-gray-400 font-medium">
                                            <UserIcon size={8} /> {uploaderName.split(' ')[0]}
                                        </div>
                                        <div className="flex items-center gap-1 text-[8px] text-gray-400">
                                            <Clock size={8} /> {formatDateTime(receipt.created_at)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (viewMode === 'compact') {
                        return (
                            <div key={receipt.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors" onClick={() => handleCardClick(receipt)}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{backgroundColor: receipt.category_color || category?.color || '#6B7280'}}></div>
                                    <div className="truncate">
                                        <p className="font-bold text-xs text-gray-900 truncate">{receipt.establishment}</p>
                                        <p className="text-[9px] text-gray-400 truncate flex items-center gap-1"><UserIcon size={8}/> {uploaderName} • {new Date(receipt.date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                                <p className="font-bold text-xs text-brand-600 ml-2 whitespace-nowrap">R$ {Number(receipt.total_amount).toFixed(2)}</p>
                            </div>
                        );
                    }

                    return (
                        <div key={receipt.id} onClick={() => handleCardClick(receipt)} className="bg-white rounded-xl shadow-sm p-3 flex gap-3 border border-gray-100 cursor-pointer active:bg-gray-50 transition-colors overflow-hidden">
                            <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative border border-gray-100">
                                {receipt.image_url ? (
                                  receipt.image_url.startsWith('data:application/pdf') ? (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><FileText size={20} /></div>
                                  ) : (
                                    <img src={receipt.image_url} className="w-full h-full object-cover" alt="" />
                                  )
                                ) : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-1">
                                    <h3 className="font-bold text-gray-900 truncate text-[13px] leading-tight">{receipt.establishment}</h3>
                                    <span className="text-brand-600 font-bold text-[13px] whitespace-nowrap flex-shrink-0">R$ {Number(receipt.total_amount).toFixed(2)}</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {(() => { const catName = receipt.category_name || category?.name || 'Outros'; const catColor = receipt.category_color || category?.color || '#6B7280'; return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none" style={{ backgroundColor: `${catColor}20`, color: catColor }}>{catName}</span>; })()}
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none bg-gray-100 text-gray-500">{receipt.location || 'Caratinga'}</span>
                                    {linkedReceiptIds.has(receipt.id) && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold leading-none text-green-600 bg-green-50">
                                        <CheckCircle size={8} /> SEFAZ
                                      </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-[9px] text-gray-400 font-medium truncate">
                                    <span className="flex items-center gap-0.5 truncate"><UserIcon size={8}/> {uploaderName.split(' ')[0]}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-0.5 whitespace-nowrap"><Clock size={8}/> {formatDateTime(receipt.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    </div>
  );
};