import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, CheckCircle, XCircle, Loader2, Play, Pause, AlertTriangle, FileText, ArrowRight } from 'lucide-react';
import { extractReceiptData } from '../services/geminiService';
import { Category, Receipt } from '../types';
import { supabase } from '../services/supabaseClient';
import { clsx } from 'clsx';

interface AddReceiptProps {
  categories: Category[];
  onSaved: () => void;
}

type QueueStatus = 'waiting' | 'processing' | 'saving' | 'success' | 'error';

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  establishment?: string;
  errorMsg?: string;
}

export const AddReceipt: React.FC<AddReceiptProps> = ({ categories, onSaved }) => {
  const [mode, setMode] = useState<'upload' | 'queue' | 'summary'>('upload');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  
  // Refs para inputs ocultos
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const processedCount = queue.filter(i => i.status === 'success').length;
  const errorCount = queue.filter(i => i.status === 'error').length;
  const totalCount = queue.length;
  const progressPercent = totalCount > 0 
    ? ((processedCount + errorCount) / totalCount) * 100 
    : 0;

  // --- HELPER: Compress Image ---
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimensões (Full HD aprox)
          const MAX_DIM = 1920; 
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compressão JPEG 0.7
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
      // Se for PDF, não comprime via Canvas
      if (file.type === 'application/pdf') {
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = error => reject(error);
          });
      }
      // Se for imagem, tenta comprimir
      return compressImage(file);
  };

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems: QueueItem[] = Array.from(e.target.files).map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        status: 'waiting'
      }));
      
      setQueue(prev => [...prev, ...newItems]);
      setMode('queue');
      // Limpa inputs para permitir selecionar o mesmo arquivo se quiser
      e.target.value = ''; 
    }
  };

  // Effect para iniciar/continuar o processamento
  useEffect(() => {
    if (mode === 'queue' && !isProcessing && !cancelRequested) {
      processNextInQueue();
    }
  }, [queue, mode, isProcessing, cancelRequested]);

  const updateItemStatus = (id: string, status: QueueStatus, extra?: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status, ...extra } : item
    ));
  };

  const processNextInQueue = async () => {
    const nextItem = queue.find(i => i.status === 'waiting');
    
    if (!nextItem) {
      // Se não há mais itens esperando, verifica se acabou tudo
      const hasActive = queue.some(i => i.status === 'processing' || i.status === 'saving');
      if (!hasActive) {
          // Tudo finalizado
          // Pequeno delay para UX
          setTimeout(() => setMode('summary'), 1000);
      }
      return;
    }

    setIsProcessing(true);
    updateItemStatus(nextItem.id, 'processing');

    try {
      if (cancelRequested) throw new Error("Cancelado pelo usuário");

      // 1. Converter/Comprimir
      const base64 = await fileToBase64(nextItem.file);

      // 2. Extrair Dados (Gemini)
      const rawData = await extractReceiptData(base64, nextItem.file.type);
      
      if (cancelRequested) throw new Error("Cancelado pelo usuário");

      // 3. Preparar Categoria
      const matchedCategory = categories.find(c => 
          c.name.toLowerCase() === rawData.suggested_category?.toLowerCase()
      ) || categories.find(c => c.is_default) || categories[0];

      // 4. Salvar no Supabase (Auto Save)
      updateItemStatus(nextItem.id, 'saving', { establishment: rawData.establishment });

      const { error } = await supabase.from('receipts').insert({
        establishment: rawData.establishment || 'Desconhecido',
        date: rawData.date || new Date().toISOString(),
        total_amount: rawData.total_amount || 0,
        cnpj: rawData.cnpj,
        receipt_number: rawData.receipt_number,
        payment_method: rawData.payment_method,
        category_id: matchedCategory.id,
        items: rawData.items || [],
        image_url: base64 // Salvando base64
      });

      if (error) throw error;

      updateItemStatus(nextItem.id, 'success');

    } catch (error: any) {
      console.error(`Erro ao processar ${nextItem.file.name}:`, error);
      updateItemStatus(nextItem.id, 'error', { 
          errorMsg: error.message || "Falha desconhecida",
          establishment: "Erro" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setCancelRequested(true);
    setMode('summary'); // Vai para o resumo do que já foi feito
  };

  const resetAll = () => {
    setQueue([]);
    setMode('upload');
    setCancelRequested(false);
    setIsProcessing(false);
  };

  // --- RENDERIZADORES ---

  if (mode === 'summary') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-white animate-in zoom-in duration-300">
        <div className="text-center space-y-4 max-w-sm w-full">
            
            {processedCount > 0 ? (
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={40} />
                </div>
            ) : (
                <div className="w-20 h-20 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={40} />
                </div>
            )}

            <h2 className="text-2xl font-bold text-gray-900">Processamento Finalizado</h2>
            
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Sucesso:</span>
                    <span className="font-bold text-green-600">{processedCount} notas</span>
                </div>
                <div className="flex justify-between py-2">
                    <span className="text-gray-600">Erros:</span>
                    <span className="font-bold text-red-600">{errorCount} notas</span>
                </div>
            </div>

            {errorCount > 0 && (
                <p className="text-xs text-red-500 bg-red-50 p-2 rounded">
                    As notas com erro não foram salvas. Tente enviá-las novamente.
                </p>
            )}

            <div className="pt-4 space-y-3">
                <button 
                    onClick={onSaved}
                    className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-brand-700 flex items-center justify-center gap-2"
                >
                    Ver Notas Adicionadas <ArrowRight size={20} />
                </button>
                
                <button 
                    onClick={resetAll}
                    className="w-full bg-white text-gray-600 border border-gray-200 py-3 rounded-xl font-medium hover:bg-gray-50"
                >
                    Adicionar Mais
                </button>
            </div>
        </div>
      </div>
    );
  }

  if (mode === 'queue') {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header da Fila */}
        <div className="bg-white p-6 shadow-sm z-10 sticky top-0 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
                Processando {processedCount + errorCount + (isProcessing ? 1 : 0)} de {totalCount}
            </h2>
            
            {/* Barra de Progresso */}
            <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden mb-1">
                <div 
                    className="bg-brand-600 h-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                ></div>
            </div>
            <p className="text-right text-xs text-gray-400 font-medium">{Math.round(progressPercent)}%</p>
        </div>

        {/* Lista da Fila */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
            {queue.map((item) => (
                <div 
                    key={item.id}
                    className={clsx(
                        "bg-white p-3 rounded-xl border shadow-sm flex items-center gap-3 transition-all",
                        item.status === 'processing' || item.status === 'saving' ? "border-brand-300 ring-1 ring-brand-100" : "border-gray-100",
                        item.status === 'error' ? "border-red-200 bg-red-50" : ""
                    )}
                >
                    {/* Ícone de Status */}
                    <div className="flex-shrink-0">
                        {item.status === 'waiting' && <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Pause size={16} className="text-gray-400" /></div>}
                        {(item.status === 'processing' || item.status === 'saving') && <Loader2 size={24} className="text-brand-600 animate-spin" />}
                        {item.status === 'success' && <CheckCircle size={24} className="text-green-500" />}
                        {item.status === 'error' && <XCircle size={24} className="text-red-500" />}
                    </div>

                    {/* Texto */}
                    <div className="flex-1 min-w-0">
                        <p className={clsx("text-sm font-medium truncate", item.status === 'error' ? "text-red-700" : "text-gray-800")}>
                            {item.establishment || item.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                            {item.status === 'waiting' && 'Na fila...'}
                            {item.status === 'processing' && 'Lendo imagem...'}
                            {item.status === 'saving' && 'Salvando...'}
                            {item.status === 'success' && 'Concluído'}
                            {item.status === 'error' && (item.errorMsg || 'Erro')}
                        </p>
                    </div>

                    {/* Tamanho Arquivo */}
                    <div className="text-xs text-gray-400">
                        {(item.file.size / 1024 / 1024).toFixed(1)}MB
                    </div>
                </div>
            ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-gray-100 sticky bottom-0">
            <button 
                onClick={handleCancel}
                className="w-full border border-red-200 text-red-600 bg-red-50 py-3 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
                <X size={20} /> Cancelar Processamento
            </button>
        </div>
      </div>
    );
  }

  // MODO: UPLOAD (Inicial)
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-brand-100 rounded-full opacity-20 blur-3xl"></div>
      <div className="absolute bottom-[-50px] right-[-50px] w-60 h-60 bg-brand-200 rounded-full opacity-20 blur-3xl"></div>

      <div className="w-full max-w-sm space-y-6 z-10">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Adicionar Despesas</h2>
            <p className="text-gray-500 text-sm mt-2">Escolha como deseja enviar seus comprovantes para a IA.</p>
        </div>

        {/* Inputs Ocultos */}
        <input 
            type="file" 
            multiple 
            accept="image/*,application/pdf" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFilesSelect}
        />
        <input 
            type="file" 
            accept="image/*"
            capture="environment"
            className="hidden" 
            ref={cameraInputRef}
            onChange={handleFilesSelect}
        />

        {/* Botão Upload em Massa */}
        <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full group bg-white border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50 p-6 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md"
        >
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
             <Upload size={28} />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-gray-800">Selecionar Arquivos</h3>
            <p className="text-xs text-gray-500 mt-1">PDFs ou Imagens (Múltiplos)</p>
          </div>
        </button>

        <div className="flex items-center gap-4 text-gray-300">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-xs font-medium uppercase">ou</span>
            <div className="h-px bg-gray-200 flex-1"></div>
        </div>

        {/* Botão Câmera Direta */}
        <button 
            onClick={() => cameraInputRef.current?.click()}
            className="w-full bg-brand-600 text-white p-5 rounded-2xl shadow-xl shadow-brand-500/30 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Camera size={24} />
          <span className="font-bold text-lg">Tirar Foto</span>
        </button>
        
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 flex gap-3 items-start mt-4">
            <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-yellow-700 leading-tight">
                As notas serão processadas e salvas automaticamente. Você poderá editá-las depois na aba "Notas".
            </p>
        </div>
      </div>
    </div>
  );
};