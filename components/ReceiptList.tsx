import React, { useState, useMemo } from 'react';
import { Receipt, Category, ViewMode, PeriodFilter } from '../types';
import { LayoutGrid, List, AlignJustify, Search, ChevronDown, ChevronUp, Image as ImageIcon, Filter, Edit2, X, Save, Loader2, Download, Maximize2, Calendar, CreditCard, Tag, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { generatePDFReport, generateSingleReceiptPDF } from '../services/pdfService';
import { supabase } from '../services/supabaseClient';

interface ReceiptListProps {
  receipts: Receipt[];
  categories: Category[];
  onRefresh?: () => void;
}

export const ReceiptList: React.FC<ReceiptListProps> = ({ receipts, categories, onRefresh }) => {
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

  // Filter Logic
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      // 1. Search
      const matchesSearch = 
        r.establishment.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      // 2. Category
      if (selectedCats.length > 0 && !selectedCats.includes(r.category_id)) return false;

      // 3. Period
      const rDate = new Date(r.date + 'T12:00:00'); // Consistent Timezone handling
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
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      setEditingReceipt(receipt);
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
                  category_id: editingReceipt.category_id
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

  // Helper to get category details safely
  const getCat = (id: string) => categories.find(c => c.id === id);

  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      
      {/* --- MODAL: IMAGE ZOOM --- */}
      {zoomedImage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200" onClick={() => setZoomedImage(null)}>
              <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
                  <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-md" alt="Zoom" />
                  <button className="absolute top-4 right-4 bg-white/20 text-white p-2 rounded-full hover:bg-white/40">
                      <X size={24} />
                  </button>
              </div>
          </div>
      )}

      {/* --- MODAL: VIEW DETAILS --- */}
      {viewingReceipt && !editingReceipt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-5 duration-300">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-900 truncate pr-4 text-lg">{viewingReceipt.establishment}</h3>
                    <button onClick={() => setViewingReceipt(null)} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full border border-gray-200">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-0">
                    {/* Image Header */}
                    <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden group cursor-zoom-in" onClick={() => viewingReceipt.image_url && setZoomedImage(viewingReceipt.image_url)}>
                         {viewingReceipt.image_url ? (
                            <>
                                <img src={viewingReceipt.image_url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="Comprovante" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                                    <span className="bg-black/50 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                                        <Maximize2 size={12} /> Ampliar
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center text-gray-400">
                                <ImageIcon size={32} />
                                <span className="text-xs mt-2">Sem imagem</span>
                            </div>
                        )}
                        <div className="absolute bottom-3 right-3">
                             <span className="px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-white/20 text-white backdrop-blur-md" 
                                   style={{backgroundColor: getCat(viewingReceipt.category_id)?.color}}>
                                {getCat(viewingReceipt.category_id)?.name}
                            </span>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Key Info Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1 uppercase font-semibold">
                                    <Calendar size={12} /> Data
                                </div>
                                <div className="font-medium text-gray-900">
                                    {new Date(viewingReceipt.date).toLocaleDateString('pt-BR')}
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1 uppercase font-semibold">
                                    <CreditCard size={12} /> Total
                                </div>
                                <div className="font-bold text-xl text-brand-600">
                                    R$ {Number(viewingReceipt.total_amount).toFixed(2)}
                                </div>
                            </div>
                            {viewingReceipt.payment_method && (
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1 uppercase font-semibold">
                                        <Tag size={12} /> Forma de Pagamento
                                    </div>
                                    <div className="font-medium text-gray-900">
                                        {viewingReceipt.payment_method}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Items List */}
                        {viewingReceipt.items && viewingReceipt.items.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <FileText size={16} className="text-brand-500" /> Itens da Nota
                                </h4>
                                <div className="border border-gray-100 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Item</th>
                                                <th className="px-3 py-2 font-medium text-right">R$</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {viewingReceipt.items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/50">
                                                    <td className="px-3 py-2 text-gray-700">
                                                        <div className="font-medium">{item.name}</div>
                                                        {(item.quantity > 1 || item.unitPrice > 0) && (
                                                            <div className="text-[10px] text-gray-400">
                                                                {item.quantity}x {item.unitPrice?.toFixed(2)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                                                        {item.totalPrice?.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                     <button 
                        onClick={(e) => handleDownloadSingle(e, viewingReceipt)}
                        className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                    >
                        <Download size={18} />
                        PDF
                    </button>
                    <button 
                        onClick={(e) => {
                             setViewingReceipt(null);
                             handleEditClick(e, viewingReceipt);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition-colors shadow-sm"
                    >
                        <Edit2 size={18} />
                        Editar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL: EDIT FORM --- */}
      {editingReceipt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex items-center justify-between p-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">Editar Nota</h3>
                      <button onClick={() => setEditingReceipt(null)} className="text-gray-500 hover:text-gray-800">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-4 overflow-y-auto">
                        <div className="h-32 w-full bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden border border-gray-200 relative group cursor-pointer" onClick={() => editingReceipt.image_url && setZoomedImage(editingReceipt.image_url)}>
                            {editingReceipt.image_url ? (
                                <>
                                    <img src={editingReceipt.image_url} className="h-full object-contain" alt="Nota" />
                                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Maximize2 className="text-white drop-shadow-md" />
                                    </div>
                                </>
                            ) : (
                                <ImageIcon className="text-gray-400" />
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Estabelecimento</label>
                                <input 
                                    type="text" 
                                    value={editingReceipt.establishment} 
                                    onChange={(e) => setEditingReceipt({...editingReceipt, establishment: e.target.value})}
                                    className="w-full bg-white text-gray-900 border-b border-gray-300 focus:border-brand-500 outline-none py-1 text-lg font-medium"
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
                                    <input 
                                        type="date" 
                                        value={editingReceipt.date} 
                                        onChange={(e) => setEditingReceipt({...editingReceipt, date: e.target.value})}
                                        className="w-full bg-white text-gray-900 border-b border-gray-300 focus:border-brand-500 outline-none py-1"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Total (R$)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={editingReceipt.total_amount} 
                                        onChange={(e) => setEditingReceipt({...editingReceipt, total_amount: parseFloat(e.target.value)})}
                                        className="w-full bg-white text-gray-900 border-b border-gray-300 focus:border-brand-500 outline-none py-1 font-bold text-brand-600"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-2">Categoria</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setEditingReceipt({...editingReceipt, category_id: cat.id})}
                                            className={clsx(
                                                "text-xs px-2 py-2 rounded-md border transition-colors text-left",
                                                editingReceipt.category_id === cat.id 
                                                    ? "bg-brand-50 border-brand-500 text-brand-700 font-medium" 
                                                    : "bg-white border-gray-200 text-gray-600"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: cat.color}}></div>
                                                {cat.name}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                  </div>
                  <div className="p-4 bg-gray-50 border-t border-gray-100">
                      <button 
                        onClick={handleSaveEdit}
                        disabled={isSavingEdit}
                        className="w-full bg-brand-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                      >
                          {isSavingEdit ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                          Salvar Alterações
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Search & Header */}
      <div className="bg-white p-4 shadow-sm z-10 sticky top-0">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar nota, item ou loja..." 
            className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 ring-brand-500 outline-none"
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

        {/* Expanded Filters */}
        {showFilters && (
            <div className="mb-4 space-y-3 border-t border-gray-100 pt-3 animate-in slide-in-from-top-2 fade-in duration-200">
                <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">Período</span>
                    <div className="flex gap-2 mt-1 overflow-x-auto pb-1">
                        {[
                            {id: 'current_month', label: 'Este Mês'},
                            {id: 'last_month', label: 'Mês Passado'},
                            {id: 'last_3_months', label: '3 Meses'},
                            {id: 'year', label: 'Este Ano'},
                            {id: 'custom', label: 'Todos'}
                        ].map((p) => (
                             <button 
                                key={p.id}
                                onClick={() => setPeriod(p.id as PeriodFilter)}
                                className={clsx("px-3 py-1 rounded-full text-xs whitespace-nowrap border", period === p.id ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-200")}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                 <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">Categorias</span>
                    <div className="flex gap-2 mt-1 overflow-x-auto pb-1">
                        {categories.map(c => (
                            <button 
                                key={c.id}
                                onClick={() => toggleCategory(c.id)}
                                className={clsx("px-3 py-1 rounded-full text-xs whitespace-nowrap border flex items-center gap-1", selectedCats.includes(c.id) ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200")}
                            >
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: c.color}}></div>
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>
                 <button 
                    onClick={downloadReport}
                    className="w-full mt-2 text-xs text-brand-600 font-medium py-2 border border-brand-200 rounded-lg hover:bg-brand-50"
                >
                    Baixar Relatório PDF
                </button>
            </div>
        )}

        <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-500">{filteredReceipts.length} notas encontradas</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={() => setViewMode('list')} className={clsx("p-1.5 rounded-md", viewMode === 'list' && "bg-white shadow-sm text-brand-600")}>
                    <List size={16} />
                </button>
                <button onClick={() => setViewMode('grid')} className={clsx("p-1.5 rounded-md", viewMode === 'grid' && "bg-white shadow-sm text-brand-600")}>
                    <LayoutGrid size={16} />
                </button>
                <button onClick={() => setViewMode('compact')} className={clsx("p-1.5 rounded-md", viewMode === 'compact' && "bg-white shadow-sm text-brand-600")}>
                    <AlignJustify size={16} />
                </button>
            </div>
        </div>
      </div>

      {/* List Content */}
      <div className="p-4 space-y-3">
        {filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Search size={32} className="mb-2 opacity-50"/>
                <p>Nenhuma nota encontrada.</p>
            </div>
        ) : (
            <div className={clsx(
                viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-3"
            )}>
                {filteredReceipts.map(receipt => {
                    const category = categories.find(c => c.id === receipt.category_id);
                    
                    if (viewMode === 'grid') {
                        return (
                            <div 
                                key={receipt.id} 
                                onClick={() => handleCardClick(receipt)}
                                className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 flex flex-col relative group cursor-pointer hover:shadow-md transition-shadow"
                            >
                                <div className="h-24 bg-gray-100 relative">
                                    {receipt.image_url ? (
                                        <img src={receipt.image_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon /></div>
                                    )}
                                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm z-10" style={{backgroundColor: category?.color}}>
                                        {category?.name.slice(0, 4)}..
                                    </div>
                                </div>
                                <div className="p-3">
                                    <p className="font-semibold text-gray-900 text-sm truncate">{receipt.establishment}</p>
                                    <p className="text-gray-500 text-xs">{new Date(receipt.date).toLocaleDateString('pt-BR')}</p>
                                    <div className="flex items-center justify-between mt-1">
                                         <p className="font-bold text-brand-600">R$ {Number(receipt.total_amount).toFixed(2)}</p>
                                         <div className="flex gap-1">
                                            <button 
                                                onClick={(e) => handleDownloadSingle(e, receipt)}
                                                className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-brand-50 hover:text-brand-600 transition-colors"
                                                title="Baixar PDF"
                                            >
                                                <Download size={12} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleEditClick(e, receipt)}
                                                className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-brand-50 hover:text-brand-600 transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                         </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (viewMode === 'compact') {
                        const isExpanded = expandedId === receipt.id;
                        return (
                            <div key={receipt.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                                <div 
                                    className="p-3 flex items-center justify-between cursor-pointer active:bg-gray-50 hover:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-1 h-8 rounded-full" style={{backgroundColor: category?.color}}></div>
                                        <div className="truncate">
                                            <p className="font-medium text-sm text-gray-900 truncate">{receipt.establishment}</p>
                                            <p className="text-xs text-gray-500">{new Date(receipt.date).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="font-bold text-sm text-gray-900">R$ {Number(receipt.total_amount).toFixed(2)}</p>
                                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="bg-gray-50 p-3 text-xs border-t border-gray-100 animate-in slide-in-from-top-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="grid grid-cols-2 gap-2 flex-1">
                                                <p><span className="text-gray-500">Categoria:</span> {category?.name}</p>
                                                <p><span className="text-gray-500">Pagamento:</span> {receipt.payment_method || '-'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                 <button 
                                                    onClick={(e) => handleDownloadSingle(e, receipt)}
                                                    className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-colors"
                                                >
                                                    <Download size={12} />
                                                    <span className="font-medium">PDF</span>
                                                </button>
                                                <button 
                                                    onClick={(e) => handleEditClick(e, receipt)}
                                                    className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-colors"
                                                >
                                                    <Edit2 size={12} />
                                                    <span className="font-medium">Editar</span>
                                                </button>
                                            </div>
                                        </div>

                                        {receipt.items && receipt.items.length > 0 && (
                                            <div className="mt-2">
                                                <p className="font-semibold text-gray-700 mb-1">Itens:</p>
                                                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                                                    {receipt.items.map((item, idx) => (
                                                        <li key={idx}>{item.name} - R$ {item.totalPrice?.toFixed(2)}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {receipt.image_url && (
                                            <div className="mt-2 relative group cursor-zoom-in inline-block" onClick={() => setZoomedImage(receipt.image_url!)}>
                                                <img src={receipt.image_url} alt="Receipt" className="h-32 object-contain border rounded bg-white" />
                                                <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                                     <Maximize2 size={16} className="text-white drop-shadow" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // Standard List View
                    return (
                        <div 
                            key={receipt.id} 
                            onClick={() => handleCardClick(receipt)}
                            className="bg-white rounded-xl shadow-sm p-3 flex gap-4 border border-gray-100 cursor-pointer hover:bg-gray-50/50 transition-colors"
                        >
                            <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                                {receipt.image_url ? (
                                    <img src={receipt.image_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-semibold text-gray-900 truncate pr-2">{receipt.establishment}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-brand-600 font-bold text-sm whitespace-nowrap mr-2">R$ {Number(receipt.total_amount).toFixed(2)}</span>
                                        <button 
                                            onClick={(e) => handleDownloadSingle(e, receipt)}
                                            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-gray-100 rounded-full transition-colors"
                                            title="Baixar PDF"
                                        >
                                            <Download size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => handleEditClick(e, receipt)}
                                            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-gray-100 rounded-full transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end mt-1">
                                    <div>
                                        <p className="text-xs text-gray-500">{new Date(receipt.date).toLocaleDateString('pt-BR')}</p>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium mt-1" style={{ backgroundColor: `${category?.color}20`, color: category?.color }}>
                                            {category?.name}
                                        </span>
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