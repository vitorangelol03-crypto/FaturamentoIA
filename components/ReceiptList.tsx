
import React, { useState, useMemo, useEffect } from 'react';
import { Receipt, Category, ViewMode, PeriodFilter, User } from '../types';
// Added Shield to the list of imports from lucide-react
import { LayoutGrid, List, AlignJustify, Search, ChevronDown, ChevronUp, Image as ImageIcon, Filter, Edit2, X, Save, Loader2, Download, Maximize2, Calendar, CreditCard, Tag, FileText, MapPin, Lock, Clock, User as UserIcon, Shield } from 'lucide-react';
import { clsx } from 'clsx';
import { generatePDFReport, generateSingleReceiptPDF } from '../services/pdfService';
import { supabase } from '../services/supabaseClient';

interface ReceiptListProps {
  receipts: Receipt[];
  categories: Category[];
  users: User[];
  onRefresh?: () => void;
  currentUser: User;
}

export const ReceiptList: React.FC<ReceiptListProps> = ({ receipts, categories, users, onRefresh, currentUser }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('current_month');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // States for Modals
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Force re-render periodically to update the "isEditable" status
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000); 
    return () => clearInterval(timer);
  }, []);

  const isAdmin = currentUser.role === 'admin' || currentUser.username === 'zoork22';

  const canEditReceipt = (receipt: Receipt): boolean => {
    if (isAdmin) return true;
    const createdTime = new Date(receipt.created_at).getTime();
    const now = currentTime;
    const diffMinutes = (now - createdTime) / (1000 * 60);
    return diffMinutes <= 5;
  };

  const getTimeRemaining = (receipt: Receipt): string | null => {
      if (isAdmin) return null;
      const createdTime = new Date(receipt.created_at).getTime();
      const now = currentTime;
      const diffMinutes = (now - createdTime) / (1000 * 60);
      if (diffMinutes > 5) return null;
      const remaining = 5 - diffMinutes;
      if (remaining < 1) return "< 1 min";
      return `${Math.ceil(remaining)} min`;
  };

  const getUserName = (userId?: string) => {
    if (!userId) return 'Sistema';
    const u = users.find(user => user.id === userId);
    return u ? u.full_name : 'Usuário Desconhecido';
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter Logic
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      const matchesSearch = 
        r.establishment.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;
      if (selectedCats.length > 0 && !selectedCats.includes(r.category_id)) return false;

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
      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [receipts, searchQuery, selectedCats, period]);

  const toggleCategory = (id: string) => {
    if (selectedCats.includes(id)) setSelectedCats(selectedCats.filter(c => c !== id));
    else setSelectedCats([...selectedCats, id]);
  };

  const downloadReport = () => {
      const periodLabelMap: Record<string, string> = {
          'current_month': 'Este Mês',
          'last_month': 'Mês Passado',
          'last_3_months': 'Últimos 3 Meses',
          'year': 'Este Ano',
          'custom': 'Geral'
      };
      generatePDFReport(filteredReceipts, categories, periodLabelMap[period] || 'Período', "", true);
  };

  const handleDownloadSingle = (e: React.MouseEvent, receipt: Receipt) => {
      e.stopPropagation();
      const catName = categories.find(c => c.id === receipt.category_id)?.name || 'Desconhecido';
      generateSingleReceiptPDF(receipt, catName);
  };

  const handleEditClick = (e: React.MouseEvent, receipt: Receipt) => {
      e.stopPropagation();
      if (canEditReceipt(receipt)) {
          setEditingReceipt(receipt);
      } else {
          alert("O tempo limite para edição (5 minutos) expirou. Contate o administrador.");
      }
  };

  const handleCardClick = (receipt: Receipt) => {
      setViewingReceipt(receipt);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingReceipt) return;
      setIsSavingEdit(true);
      try {
          const { error } = await supabase
              .from('receipts')
              .update({
                  establishment: editingReceipt.establishment,
                  date: editingReceipt.date,
                  total_amount: editingReceipt.total_amount,
                  category_id: editingReceipt.category_id,
                  location: editingReceipt.location
              })
              .eq('id', editingReceipt.id);
          if (error) throw error;
          setEditingReceipt(null);
          if (viewingReceipt?.id === editingReceipt.id) {
              setViewingReceipt(prev => prev ? { ...prev, ...editingReceipt } : null);
          }
          if (onRefresh) onRefresh();
      } catch (error) {
          console.error("Error updating receipt", error);
          alert("Erro ao atualizar nota.");
      } finally {
          setIsSavingEdit(false);
      }
  };

  const getCat = (id: string) => categories.find(c => c.id === id);

  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      {zoomedImage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-in fade-in" onClick={() => setZoomedImage(null)}>
              <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
                  <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-md" alt="Zoom" />
                  <button className="absolute top-4 right-4 bg-white/20 text-white p-2 rounded-full"><X size={24} /></button>
              </div>
          </div>
      )}

      {viewingReceipt && !editingReceipt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-900 truncate pr-4 text-lg">{viewingReceipt.establishment}</h3>
                    <button onClick={() => setViewingReceipt(null)} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full border border-gray-200"><X size={20} /></button>
                </div>
                <div className="overflow-y-auto p-0">
                    <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden group cursor-zoom-in" onClick={() => viewingReceipt.image_url && setZoomedImage(viewingReceipt.image_url)}>
                         {viewingReceipt.image_url ? (
                            <img src={viewingReceipt.image_url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" alt="Comprovante" />
                        ) : (
                            <div className="flex flex-col items-center text-gray-400"><ImageIcon size={32} /></div>
                        )}
                        <div className="absolute bottom-3 right-3">
                             <span className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm" style={{backgroundColor: getCat(viewingReceipt.category_id)?.color}}>{getCat(viewingReceipt.category_id)?.name}</span>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="text-gray-400 text-[10px] uppercase font-bold mb-1">Data de Compra</div>
                                <div className="font-medium text-gray-900">{new Date(viewingReceipt.date).toLocaleDateString('pt-BR')}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="text-gray-400 text-[10px] uppercase font-bold mb-1">Valor Total</div>
                                <div className="font-bold text-xl text-brand-600">R$ {Number(viewingReceipt.total_amount).toFixed(2)}</div>
                            </div>
                        </div>

                        {/* SEÇÃO DE AUDITORIA NO DETALHE */}
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                            <h4 className="text-[10px] font-bold text-blue-800 uppercase mb-3 flex items-center gap-1.5">
                                <Shield size={12} /> Registro no Sistema
                            </h4>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <UserIcon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-blue-700/60 leading-none mb-1">Adicionado por:</p>
                                        <p className="text-sm font-bold text-blue-900">{getUserName(viewingReceipt.user_id)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Clock size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-blue-700/60 leading-none mb-1">Data/Hora do Lançamento:</p>
                                        <p className="text-sm font-bold text-blue-900">{formatDateTime(viewingReceipt.created_at)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {viewingReceipt.items && viewingReceipt.items.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText size={16} /> Itens da Nota</h4>
                                <div className="border border-gray-100 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <tbody className="divide-y divide-gray-100">
                                            {viewingReceipt.items.map((item, idx) => (
                                                <tr key={idx}><td className="px-3 py-2 text-gray-700 font-medium">{item.name}</td><td className="px-3 py-2 text-right font-bold text-gray-900">{item.totalPrice?.toFixed(2)}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                     <button onClick={(e) => handleDownloadSingle(e, viewingReceipt)} className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 py-3 rounded-xl font-medium"><Download size={18} /> PDF</button>
                     {canEditReceipt(viewingReceipt) ? (
                        <button onClick={(e) => { setViewingReceipt(null); handleEditClick(e, viewingReceipt); }} className="flex-1 flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl font-medium shadow-sm"><Edit2 size={18} /> Editar</button>
                    ) : (
                        <button disabled className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-400 py-3 rounded-xl font-medium cursor-not-allowed"><Lock size={16} /> Bloqueado</button>
                    )}
                </div>
            </div>
        </div>
      )}

      <div className="bg-white p-4 shadow-sm z-10 sticky top-0">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input type="text" placeholder="Buscar nota, item ou loja..." className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 ring-brand-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <button onClick={() => setShowFilters(!showFilters)} className={clsx("absolute right-2 top-1.5 p-1 rounded-md transition-colors", showFilters ? "bg-brand-100 text-brand-600" : "text-gray-400")}><Filter size={18} /></button>
        </div>
        <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-500">{filteredReceipts.length} notas no período</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={() => setViewMode('list')} className={clsx("p-1.5 rounded-md", viewMode === 'list' && "bg-white shadow-sm text-brand-600")}><List size={16} /></button>
                <button onClick={() => setViewMode('grid')} className={clsx("p-1.5 rounded-md", viewMode === 'grid' && "bg-white shadow-sm text-brand-600")}><LayoutGrid size={16} /></button>
                <button onClick={() => setViewMode('compact')} className={clsx("p-1.5 rounded-md", viewMode === 'compact' && "bg-white shadow-sm text-brand-600")}><AlignJustify size={16} /></button>
            </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400"><Search size={32} className="mb-2 opacity-50"/><p>Nenhuma nota encontrada.</p></div>
        ) : (
            <div className={clsx(viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-3")}>
                {filteredReceipts.map(receipt => {
                    const category = categories.find(c => c.id === receipt.category_id);
                    const editable = canEditReceipt(receipt);
                    const uploaderName = getUserName(receipt.user_id);
                    
                    if (viewMode === 'grid') {
                        return (
                            <div key={receipt.id} onClick={() => handleCardClick(receipt)} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 flex flex-col relative group cursor-pointer">
                                <div className="h-24 bg-gray-100 relative">
                                    {receipt.image_url ? <img src={receipt.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon /></div>}
                                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white shadow-sm z-10" style={{backgroundColor: category?.color}}>{category?.name.slice(0, 8)}</div>
                                </div>
                                <div className="p-2.5">
                                    <p className="font-bold text-gray-900 text-xs truncate mb-1">{receipt.establishment}</p>
                                    <p className="text-[10px] text-brand-600 font-bold mb-2">R$ {Number(receipt.total_amount).toFixed(2)}</p>
                                    <div className="border-t border-gray-50 pt-2 flex flex-col gap-1">
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
                            <div key={receipt.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex items-center justify-between cursor-pointer" onClick={() => handleCardClick(receipt)}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-1 h-8 rounded-full" style={{backgroundColor: category?.color}}></div>
                                    <div className="truncate">
                                        <p className="font-bold text-xs text-gray-900 truncate">{receipt.establishment}</p>
                                        <p className="text-[9px] text-gray-400 truncate flex items-center gap-1"><UserIcon size={8}/> {uploaderName} • {formatDateTime(receipt.created_at)}</p>
                                    </div>
                                </div>
                                <p className="font-bold text-xs text-gray-900 ml-2">R$ {Number(receipt.total_amount).toFixed(2)}</p>
                            </div>
                        );
                    }

                    return (
                        <div key={receipt.id} onClick={() => handleCardClick(receipt)} className="bg-white rounded-xl shadow-sm p-3 flex gap-4 border border-gray-100 cursor-pointer">
                            <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative">
                                {receipt.image_url ? <img src={receipt.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-gray-900 truncate pr-2 text-sm">{receipt.establishment}</h3>
                                    <span className="text-brand-600 font-bold text-sm whitespace-nowrap">R$ {Number(receipt.total_amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-end mt-1">
                                    <div className="space-y-1">
                                        <div className="flex gap-2">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: `${category?.color}20`, color: category?.color }}>{category?.name}</span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-500 border border-gray-200">{receipt.location || 'Caratinga'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] text-gray-400 font-medium">
                                            <span className="flex items-center gap-1"><UserIcon size={9}/> {uploaderName}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1"><Clock size={9}/> {formatDateTime(receipt.created_at)}</span>
                                        </div>
                                    </div>
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
