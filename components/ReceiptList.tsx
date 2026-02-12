import React, { useState, useMemo, useEffect } from 'react';
import { Receipt, Category, ViewMode, PeriodFilter, User } from '../types';
import { 
  LayoutGrid, List, AlignJustify, Search, ChevronDown, ChevronUp, 
  Image as ImageIcon, Filter, Edit2, X, Save, Loader2, Download, 
  Maximize2, Calendar, CreditCard, Tag, FileText, MapPin, Lock, CheckCircle,
  Clock, User as UserIcon, Shield, Activity, AlertCircle, FileDown
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

  // States for Modals
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Time-based editing logic
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000); 
    return () => clearInterval(timer);
  }, []);

  const isAdmin = currentUser.role === 'admin' || currentUser.username === 'zoork22';

  const canEditReceipt = (receipt: Receipt): boolean => {
    if (isAdmin) return true;
    const createdTime = new Date(receipt.created_at).getTime();
    const diffMinutes = (currentTime - createdTime) / (1000 * 60);
    return diffMinutes <= 5;
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

      // 2. Category filter
      if (selectedCats.length > 0 && !selectedCats.includes(r.category_id)) return false;

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
  }, [receipts, searchQuery, selectedCats, period, sefazFilter, linkedReceiptIds]);

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh] mb-[env(safe-area-inset-bottom,0px)]">
                <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-900 truncate pr-4 text-lg">{viewingReceipt.establishment}</h3>
                    <button onClick={() => setViewingReceipt(null)} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full border border-gray-200"><X size={20} /></button>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0 p-0">
                    <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden group cursor-zoom-in" onClick={() => viewingReceipt.image_url && setZoomedImage(viewingReceipt.image_url)}>
                         {viewingReceipt.image_url ? (
                            <img src={viewingReceipt.image_url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" alt="Comprovante" />
                        ) : (
                            <div className="flex flex-col items-center text-gray-400"><ImageIcon size={32} /></div>
                        )}
                        <div className="absolute bottom-3 right-3">
                             <span className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm" style={{backgroundColor: getCat(viewingReceipt.category_id)?.color || '#666'}}>{getCat(viewingReceipt.category_id)?.name || 'Outros'}</span>
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
                     <button onClick={(e) => handleDownloadSingle(e, viewingReceipt)} className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 py-3 rounded-xl font-medium"><Download size={18} /> PDF</button>
                     {canEditReceipt(viewingReceipt) ? (
                        <button onClick={(e) => { setViewingReceipt(null); setEditingReceipt(viewingReceipt); }} className="flex-1 flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl font-medium shadow-sm"><Edit2 size={18} /> Editar</button>
                    ) : (
                        <button disabled className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-400 py-3 rounded-xl font-medium cursor-not-allowed"><Lock size={16} /> Bloqueado</button>
                    )}
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
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Categorias</p>
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
                        {categories.map(cat => (
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
                                    {receipt.image_url ? <img src={receipt.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon /></div>}
                                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white shadow-sm z-10" style={{backgroundColor: category?.color || '#666'}}>{category?.name || 'Outros'}</div>
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
                                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{backgroundColor: category?.color || '#666'}}></div>
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
                        <div key={receipt.id} onClick={() => handleCardClick(receipt)} className="bg-white rounded-xl shadow-sm p-3 flex gap-4 border border-gray-100 cursor-pointer active:bg-gray-50 transition-colors">
                            <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative border border-gray-100">
                                {receipt.image_url ? <img src={receipt.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-gray-900 truncate pr-2 text-sm">{receipt.establishment}</h3>
                                    <span className="text-brand-600 font-bold text-sm whitespace-nowrap">R$ {Number(receipt.total_amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-end mt-1">
                                    <div className="space-y-1">
                                        <div className="flex gap-2">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: `${category?.color || '#666'}20`, color: category?.color || '#666' }}>{category?.name || 'Outros'}</span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-500 border border-gray-200">{receipt.location || 'Caratinga'}</span>
                                            {linkedReceiptIds.has(receipt.id) && (
                                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-green-600 bg-green-50 border border-green-100">
                                                <CheckCircle size={8} /> SEFAZ
                                              </span>
                                            )}
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