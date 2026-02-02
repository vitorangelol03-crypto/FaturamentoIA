import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, Loader2, Save, Edit2, Trash2, FileText, ChevronRight, Plus, AlertTriangle } from 'lucide-react';
import { extractReceiptData } from '../services/geminiService';
import { Category, Receipt } from '../types';
import { supabase } from '../services/supabaseClient';
import { clsx } from 'clsx';

interface AddReceiptProps {
  categories: Category[];
  onSaved: () => void;
}

// Interface auxiliar para notas que estão sendo preparadas (antes de salvar no banco)
interface StagedReceipt extends Partial<Receipt> {
  tempId: string;
  originalFile?: File;
  imagePreview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
}

export const AddReceipt: React.FC<AddReceiptProps> = ({ categories, onSaved }) => {
  const [mode, setMode] = useState<'upload' | 'processing' | 'review_list' | 'edit_single'>('upload');
  
  // Estado para Múltiplas Notas
  const [stagedReceipts, setStagedReceipts] = useState<StagedReceipt[]>([]);
  const [processingIndex, setProcessingIndex] = useState<{current: number, total: number}>({ current: 0, total: 0 });
  
  // Estado para Edição Individual
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper para converter File em Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = Array.from(e.target.files);
      setMode('processing');
      setProcessingIndex({ current: 0, total: files.length });
      
      const newStaged: StagedReceipt[] = [];

      // Processar sequencialmente para não sobrecarregar a API (e garantir ordem)
      for (let i = 0; i < files.length; i++) {
        setProcessingIndex({ current: i + 1, total: files.length });
        const file = files[i];
        
        try {
            const base64 = await fileToBase64(file);
            const rawData = await extractReceiptData(base64, file.type);
            
            const matchedCategory = categories.find(c => 
                c.name.toLowerCase() === rawData.suggested_category?.toLowerCase()
            );

            newStaged.push({
                tempId: Math.random().toString(36).substr(2, 9),
                originalFile: file,
                imagePreview: base64,
                status: 'done',
                establishment: rawData.establishment,
                date: rawData.date,
                total_amount: rawData.total_amount,
                cnpj: rawData.cnpj,
                receipt_number: rawData.receipt_number,
                payment_method: rawData.payment_method,
                items: rawData.items || [],
                category_id: matchedCategory ? matchedCategory.id : categories[categories.length - 1].id,
            });

        } catch (error) {
            console.error(`Erro ao processar arquivo ${file.name}`, error);
            // Adiciona com status de erro e nome explícito
            const base64 = await fileToBase64(file);
            newStaged.push({
                tempId: Math.random().toString(36).substr(2, 9),
                originalFile: file,
                imagePreview: base64,
                status: 'error',
                establishment: "⚠️ Falha na Leitura (IA)", // Nome explícito para acusar o erro
                items: [],
                total_amount: 0,
                date: new Date().toISOString().split('T')[0],
                category_id: categories[categories.length - 1].id
            });
        }
      }

      setStagedReceipts(prev => [...prev, ...newStaged]);
      setMode('review_list');
    }
  };

  const handleSaveAll = async () => {
    if (stagedReceipts.length === 0) return;
    
    // Bloquear salvamento se houver erros não corrigidos (opcional, aqui permitimos salvar mas alertamos visualmente)
    // Para simplificar, assumimos que o usuário revisou.

    setIsSaving(true);
    
    try {
      const inserts = stagedReceipts.map(r => ({
        establishment: r.establishment || 'Desconhecido',
        date: r.date || new Date().toISOString(),
        total_amount: r.total_amount || 0,
        cnpj: r.cnpj,
        receipt_number: r.receipt_number,
        payment_method: r.payment_method,
        category_id: r.category_id,
        items: r.items,
        image_url: r.imagePreview // Base64
      }));

      const { error } = await supabase.from('receipts').insert(inserts);
      if (error) throw error;
      
      onSaved();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar notas. Verifique os dados e tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeStaged = (tempId: string) => {
      const filtered = stagedReceipts.filter(r => r.tempId !== tempId);
      setStagedReceipts(filtered);
      if (filtered.length === 0) setMode('upload');
  };

  const openEdit = (tempId: string) => {
      setEditingId(tempId);
      setMode('edit_single');
  };

  const saveEdit = (updatedData: Partial<Receipt>) => {
      setStagedReceipts(prev => prev.map(r => 
          r.tempId === editingId ? { ...r, ...updatedData, status: 'done' } : r // Marca como 'done' ao editar manualmente
      ));
      setEditingId(null);
      setMode('review_list');
  };

  // --- RENDERIZADORES ---

  if (mode === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-gray-800">Analisando Notas...</h3>
        <p className="text-gray-500 text-sm mt-2">
            Processando {processingIndex.current} de {processingIndex.total}
        </p>
        <div className="w-full max-w-xs bg-gray-200 h-2 rounded-full mt-4 overflow-hidden">
            <div 
                className="bg-brand-500 h-full transition-all duration-300"
                style={{ width: `${(processingIndex.current / processingIndex.total) * 100}%` }}
            ></div>
        </div>
      </div>
    );
  }

  // MODO: EDICÃO INDIVIDUAL (O formulário detalhado)
  if (mode === 'edit_single' && editingId) {
      const currentReceipt = stagedReceipts.find(r => r.tempId === editingId);
      if (!currentReceipt) return null;

      return (
        <div className="p-4 pb-24 h-full overflow-y-auto bg-gray-50 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => setMode('review_list')} className="flex items-center text-gray-500 hover:text-gray-800">
                    <X size={20} className="mr-1"/> Cancelar
                </button>
                <h2 className="text-lg font-bold text-gray-900">Editar Nota</h2>
                <div className="w-6"></div> {/* Spacer */}
            </div>

            <div className="space-y-4">
                {currentReceipt.imagePreview && (
                    <div className="h-40 w-full overflow-hidden rounded-lg border border-gray-200 bg-white flex justify-center group relative">
                        <img src={currentReceipt.imagePreview} className="h-full object-contain" alt="Nota" />
                    </div>
                )}

                <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
                    {/* Aviso se estiver editando uma nota com erro */}
                    {currentReceipt.status === 'error' && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2 mb-2">
                            <AlertTriangle size={16} />
                            A IA não conseguiu ler esta nota. Por favor, preencha manualmente.
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Estabelecimento</label>
                        <input 
                            type="text" 
                            value={currentReceipt.establishment || ''} 
                            onChange={(e) => saveEdit({...currentReceipt, establishment: e.target.value} as any)}
                            onBlur={(e) => {
                                setStagedReceipts(prev => prev.map(r => r.tempId === editingId ? { ...r, establishment: e.target.value } : r));
                            }}
                            className="w-full bg-white text-gray-900 border-b border-gray-300 focus:border-brand-500 outline-none py-1 text-lg font-medium placeholder-gray-400 mb-2"
                        />
                         
                         <SingleEditor 
                            receipt={currentReceipt} 
                            categories={categories} 
                            onSave={(updated) => {
                                setStagedReceipts(prev => prev.map(r => r.tempId === editingId ? { ...r, ...updated, status: 'done' } : r));
                                setMode('review_list');
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // MODO: REVISÃO EM LISTA (Bulk Review)
  if (mode === 'review_list') {
      const totalSum = stagedReceipts.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
      const errorsCount = stagedReceipts.filter(r => r.status === 'error').length;

      return (
        <div className="h-full flex flex-col bg-gray-50">
            <div className="p-4 bg-white shadow-sm z-10">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold text-gray-900">Revisar Notas ({stagedReceipts.length})</h2>
                    <button onClick={() => {
                        setStagedReceipts([]);
                        setMode('upload');
                    }} className="text-gray-400 hover:text-red-500">
                        <X size={24} />
                    </button>
                </div>
                <div className="flex justify-between text-sm text-gray-500 bg-gray-100 p-2 rounded-lg">
                    <span>Total Estimado:</span>
                    <span className="font-bold text-gray-900">R$ {totalSum.toFixed(2)}</span>
                </div>
                {errorsCount > 0 && (
                     <div className="mt-2 text-xs bg-red-50 text-red-600 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-2">
                        <AlertTriangle size={14} />
                        {errorsCount} nota(s) não foram lidas corretamente pela IA.
                     </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
                {stagedReceipts.map((receipt, index) => {
                    const category = categories.find(c => c.id === receipt.category_id);
                    const isError = receipt.status === 'error';
                    
                    return (
                        <div 
                            key={receipt.tempId} 
                            className={clsx(
                                "rounded-xl shadow-sm border p-3 flex gap-3 relative animate-in slide-in-from-bottom-2 fade-in duration-300",
                                isError ? "bg-red-50 border-red-300" : "bg-white border-gray-100"
                            )}
                            style={{animationDelay: `${index * 50}ms`}}
                        >
                            
                            {/* Thumbnail */}
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                {receipt.originalFile?.type === 'application/pdf' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-red-500 bg-red-50">
                                        <FileText size={20} />
                                        <span className="text-[8px] font-bold mt-1">PDF</span>
                                    </div>
                                ) : (
                                    <img src={receipt.imagePreview} className="w-full h-full object-cover" alt="Thumb" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0" onClick={() => openEdit(receipt.tempId)}>
                                <div className="flex justify-between items-start">
                                    <h4 className={clsx("font-semibold truncate pr-6", isError ? "text-red-700" : "text-gray-900")}>
                                        {receipt.establishment}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 truncate max-w-[100px]">
                                        {category?.name || 'Sem Categoria'}
                                    </span>
                                    <span className="text-xs text-gray-400">{receipt.date}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="font-bold text-brand-600">R$ {Number(receipt.total_amount).toFixed(2)}</span>
                                    <div className="flex text-xs text-brand-500 font-medium items-center gap-1 cursor-pointer hover:underline">
                                        {isError ? "Corrigir Manualmente" : "Editar"} <ChevronRight size={12} />
                                    </div>
                                </div>
                            </div>

                            {/* Delete Button */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeStaged(receipt.tempId); }}
                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    );
                })}
                
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-brand-300 transition-colors"
                >
                    <Plus size={20} />
                    Adicionar mais notas
                </button>
            </div>

            <div className="absolute bottom-20 w-full px-4 pb-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4">
                 <button 
                    onClick={handleSaveAll}
                    disabled={isSaving}
                    className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold shadow-xl shadow-brand-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg"
                >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    Salvar {stagedReceipts.length} Notas
                </button>
            </div>
            
             {/* Hidden input for adding more */}
             <input 
                type="file" 
                multiple
                accept="image/*,application/pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
            />
        </div>
      );
  }

  // MODO: UPLOAD (Inicial)
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center border border-gray-100">
        <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Upload className="text-brand-500" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Adicionar Notas</h2>
        <p className="text-gray-500 mb-8">Selecione múltiplas fotos ou PDFs para processamento inteligente em massa.</p>
        
        <input 
            type="file" 
            multiple 
            accept="image/*,application/pdf" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
        />

        <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-brand-600 text-white py-4 rounded-xl font-semibold shadow-lg shadow-brand-500/30 flex items-center justify-center gap-2 mb-4 hover:bg-brand-700 transition-colors"
        >
          <Camera size={20} />
          Selecionar Arquivos
        </button>
        
        <p className="text-xs text-gray-400 mt-4">Processamento IA via Google Gemini</p>
      </div>
    </div>
  );
};

// Componente Interno para Editar uma Única Nota na lista
const SingleEditor: React.FC<{ receipt: StagedReceipt, categories: Category[], onSave: (r: Partial<Receipt>) => void }> = ({ receipt, categories, onSave }) => {
    const [data, setData] = useState(receipt);

    const handleSaveLocal = () => {
        onSave(data);
    };

    return (
        <div className="bg-white rounded-lg mt-2"> 
            
            <div className="space-y-4 pt-2">
                 <div className="flex gap-4">
                     <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
                        <input 
                            type="date" 
                            value={data.date || ''} 
                            onChange={(e) => setData({...data, date: e.target.value})}
                            className="w-full bg-white text-gray-900 border-b border-gray-300 focus:border-brand-500 outline-none py-1"
                        />
                    </div>
                     <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Total (R$)</label>
                        <input 
                            type="number" 
                            step="0.01"
                            value={data.total_amount || ''} 
                            onChange={(e) => setData({...data, total_amount: parseFloat(e.target.value)})}
                            className="w-full bg-white text-gray-900 border-b border-gray-300 focus:border-brand-500 outline-none py-1 font-bold text-brand-600"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setData({...data, category_id: cat.id})}
                                className={`text-xs px-2 py-2 rounded-md border transition-colors ${data.category_id === cat.id ? 'bg-brand-50 border-brand-500 text-brand-700 font-medium' : 'bg-white border-gray-200 text-gray-600'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                    <h3 className="text-sm font-semibold mb-2">Itens Detectados</h3>
                    <ul className="space-y-2 max-h-32 overflow-y-auto mb-4">
                        {data.items?.map((item, i) => (
                            <li key={i} className="flex justify-between text-xs border-b border-gray-50 pb-1">
                                <span className="truncate flex-1 text-gray-700">{item.name}</span>
                                <span className="font-medium text-gray-900">R$ {item.totalPrice?.toFixed(2)}</span>
                            </li>
                        ))}
                        {(!data.items || data.items.length === 0) && <p className="text-xs text-gray-400">Nenhum item</p>}
                    </ul>
                </div>

                <button 
                    onClick={handleSaveLocal}
                    className="w-full bg-brand-600 text-white py-2 rounded-lg font-medium shadow-md hover:bg-brand-700"
                >
                    Confirmar Alterações
                </button>
            </div>
        </div>
    );
};