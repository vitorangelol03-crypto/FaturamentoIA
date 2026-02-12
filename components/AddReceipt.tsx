import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, X, CheckCircle, XCircle, Loader2, Play, Pause, AlertTriangle, FileText, ArrowRight, Save, Edit2, RotateCcw, Image as ImageIcon, Zap, Check, MapPin } from 'lucide-react';
import { extractReceiptData, ExtractionResult } from '../services/geminiService';
import { Category, User } from '../types';
import { supabase } from '../services/supabaseClient';
import { clsx } from 'clsx';
import { REQUIRED_CNPJ } from '../constants';
import { notificationService } from '../services/notificationService';
import * as pdfjsLib from 'pdfjs-dist';

interface AddReceiptProps {
  categories: Category[];
  onSaved: () => void;
  currentUser: User;
  pushOverlay: (name: string) => void;
  closeOverlay: (name: string) => void;
  removeOverlayFromStack: (name: string) => void;
  registerOverlayClose: (name: string, handler: () => void) => void;
  unregisterOverlayClose: (name: string) => void;
}

type QueueStatus = 'waiting' | 'processing' | 'saving' | 'success' | 'error';

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  establishment?: string;
  total_amount?: number;
  date?: string;
  category_id?: string;
  location?: string;
  dbId?: string; // ID salvo no Supabase
  errorMsg?: string;
  imagePreview?: string;
  extractedCNPJ?: string;
}

export const AddReceipt: React.FC<AddReceiptProps> = ({ categories, onSaved, currentUser, pushOverlay, closeOverlay, removeOverlayFromStack, registerOverlayClose, unregisterOverlayClose }) => {
  const [mode, setMode] = useState<'upload' | 'camera' | 'queue' | 'summary'>('upload');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [flashEffect, setFlashEffect] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [cameraToast, setCameraToast] = useState<{ type: 'success' | 'error' | 'processing'; message: string } | null>(null);
  const cameraToastTimer = useRef<NodeJS.Timeout | null>(null);

  // Edit State
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper
  const isAdmin = currentUser.role === 'admin' || currentUser.username === 'zoork22';

  const showCameraToast = (type: 'success' | 'error' | 'processing', message: string, duration: number = 3000) => {
    if (cameraToastTimer.current) clearTimeout(cameraToastTimer.current);
    setCameraToast({ type, message });
    if (type !== 'processing') {
      cameraToastTimer.current = setTimeout(() => setCameraToast(null), duration);
    }
  };

  // Stats
  const processedCount = queue.filter(i => i.status === 'success').length;
  const errorCount = queue.filter(i => i.status === 'error').length;
  const totalCount = queue.length;
  const progressPercent = totalCount > 0 
    ? ((processedCount + errorCount) / totalCount) * 100 
    : 0;
  
  const isQueueFinished = queue.length > 0 && !queue.some(i => ['waiting', 'processing', 'saving'].includes(i.status));

  // --- CAMERA INPUT HANDLING (Hiding Nav) ---
  const handleInputFocus = () => {
    document.body.classList.add('camera-active');
  };

  const handleInputBlur = () => {
    // Pequeno delay para evitar flash
    setTimeout(() => {
        document.body.classList.remove('camera-active');
    }, 500);
  };

  // --- CAMERA FUNCTIONS ---

  const closeCameraOverlay = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setMode('upload');
    document.body.classList.remove('camera-active');
  }, [cameraStream]);

  useEffect(() => {
    registerOverlayClose('camera', closeCameraOverlay);
    return () => unregisterOverlayClose('camera');
  }, [closeCameraOverlay, registerOverlayClose, unregisterOverlayClose]);

  const startCamera = async () => {
    try {
      setMode('camera');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPermissionError(false);
      pushOverlay('camera');
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      setPermissionError(true);
      alert("Não foi possível acessar a câmera. Verifique as permissões.");
      setMode('upload');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Visual Flash Effect
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 150);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Configura canvas para tamanho do vídeo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Desenha frame atual
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Converte para File
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
                const previewUrl = URL.createObjectURL(blob);
                
                // Adiciona à fila
                const newItem: QueueItem = {
                    id: Math.random().toString(36).substr(2, 9),
                    file: file,
                    status: 'waiting',
                    imagePreview: previewUrl
                };
                setQueue(prev => [...prev, newItem]);
            }
        }, 'image/jpeg', 0.8);
    }
  };

  const finishCameraSession = () => {
    stopCamera();
    document.body.classList.remove('camera-active');
    unregisterOverlayClose('camera');
    removeOverlayFromStack('camera');
    setCameraToast(null);
    if (cameraToastTimer.current) clearTimeout(cameraToastTimer.current);
    const allDone = queue.length > 0 && queue.every(i => i.status === 'success' || i.status === 'error');
    setMode(allDone ? 'summary' : 'queue');
  };

  // --- FILE HANDLING ---

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    handleInputBlur();

    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newItems: QueueItem[] = [];

      for (const file of files) {
        let preview: string | undefined;
        if (file.type === 'application/pdf') {
          try {
            const pages = await renderPdfToImages(file);
            if (pages[0]) {
              const blob = await (await fetch(pages[0])).blob();
              preview = URL.createObjectURL(blob);
            }
          } catch {
            preview = undefined;
          }
        } else {
          preview = URL.createObjectURL(file);
        }

        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          status: 'waiting',
          imagePreview: preview
        });
      }

      setQueue(prev => [...prev, ...newItems]);
      setMode('queue');
      e.target.value = '';
    }
  };

  // --- QUEUE PROCESSING ---

  // Compressão de Imagem
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const renderPdfToImages = async (file: File): Promise<string[]> => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = Math.min(pdf.numPages, 5);
    const pageImages: string[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      pageImages.push(canvas.toDataURL('image/jpeg', 0.85));
    }

    return pageImages;
  };

  const fileToBase64 = (file: File): Promise<string> => {
      if (file.type === 'application/pdf') {
          return renderPdfToImages(file).then(pages => pages[0] || '');
      }
      return compressImage(file);
  };

  const fileToAllImages = async (file: File): Promise<{ mainImage: string; extraImages: string[] }> => {
    if (file.type === 'application/pdf') {
      const pages = await renderPdfToImages(file);
      return {
        mainImage: pages[0] || '',
        extraImages: pages.slice(1)
      };
    }
    const compressed = await compressImage(file);
    return { mainImage: compressed, extraImages: [] };
  };

  // Effect Trigger: Process queue automatically whenever items are added or one finishes
  useEffect(() => {
    if ((mode === 'queue' || mode === 'camera') && !isProcessing) {
      processNextInQueue();
    }
  }, [queue, mode, isProcessing]);

  useEffect(() => {
      return () => {
          stopCamera();
          document.body.classList.remove('camera-active');
      };
  }, []);

  const updateItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.imagePreview) URL.revokeObjectURL(item.imagePreview);
      return prev.filter(i => i.id !== id);
    });
  };

  const processNextInQueue = async () => {
    const nextItem = queue.find(i => i.status === 'waiting');
    if (!nextItem) return;

    setIsProcessing(true);
    updateItem(nextItem.id, { status: 'processing' });

    if (mode === 'camera') {
      showCameraToast('processing', 'Analisando nota fiscal...');
    }

    try {
      const { mainImage, extraImages } = await fileToAllImages(nextItem.file);
      if (!mainImage) {
        removeItem(nextItem.id);
        if (mode === 'camera') {
          showCameraToast('error', 'Não foi possível processar o arquivo', 4000);
        }
        setIsProcessing(false);
        return;
      }
      const rawData = await extractReceiptData(mainImage, 'image/jpeg', extraImages.length > 0 ? extraImages : undefined);

      if (!rawData.readable) {
        removeItem(nextItem.id);
        if (mode === 'camera') {
          showCameraToast('error', 'Foto ilegível — tente novamente com melhor enquadramento', 4000);
        }
        setIsProcessing(false);
        return;
      }
      
      const extractedCNPJ = rawData.cnpj ? rawData.cnpj.replace(/\D/g, '') : '';
      const cleanRequiredCNPJ = REQUIRED_CNPJ.replace(/\D/g, '');

      let determinedLocation = 'Ponte Nova'; 
      
      if (isAdmin) {
          if (extractedCNPJ === cleanRequiredCNPJ) {
              determinedLocation = 'Caratinga';
          }
      } else {
          determinedLocation = currentUser.location || 'Caratinga';
      }

      const matchedCategory = categories.find(c => 
          c.name.toLowerCase() === rawData.suggested_category?.toLowerCase()
      ) || categories.find(c => c.is_default) || categories[0];

      updateItem(nextItem.id, { 
          status: 'saving', 
          establishment: rawData.establishment,
          total_amount: rawData.total_amount,
          date: rawData.date,
          category_id: matchedCategory.id,
          location: determinedLocation,
          extractedCNPJ: extractedCNPJ
      });

      const { data: insertedData, error } = await supabase.from('receipts').insert({
        establishment: rawData.establishment || 'Desconhecido',
        date: rawData.date || new Date().toISOString(),
        total_amount: rawData.total_amount || 0,
        cnpj: extractedCNPJ,
        receipt_number: rawData.receipt_number,
        payment_method: rawData.payment_method,
        category_id: matchedCategory.id,
        items: rawData.items || [],
        image_url: mainImage,
        location: determinedLocation,
        user_id: currentUser.id,
        access_key: rawData.access_key || null,
      }).select().single();

      if (error) throw error;

      if (rawData.access_key) {
        try {
          const { linkSingleReceipt } = await import('../services/sefazService');
          await linkSingleReceipt(rawData.access_key, insertedData.id, determinedLocation);
        } catch (linkErr) {
          console.error('Erro ao vincular com SEFAZ:', linkErr);
        }
      }

      updateItem(nextItem.id, { 
          status: 'success', 
          dbId: insertedData.id 
      });

      if (mode === 'camera') {
        showCameraToast('success', `${rawData.establishment} — R$ ${rawData.total_amount?.toFixed(2)} salvo!`);
      }
      notificationService.notifyReceiptSaved(rawData.establishment || 'Nota');

    } catch (error: any) {
      console.error(`Erro ao processar ${nextItem.file.name}:`, error);
      if (mode === 'camera') {
        removeItem(nextItem.id);
        showCameraToast('error', 'Erro ao processar — tente tirar outra foto', 4000);
      } else {
        updateItem(nextItem.id, { 
            status: 'error', 
            errorMsg: error.message || "Falha desconhecida",
            establishment: "Erro no Processamento" 
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditSave = async () => {
      if (!editingItem || !editingItem.dbId) return;

      // Se for admin editando, valida o CNPJ como antes.
      // Se for funcionário, não precisa validar CNPJ vs Localização pois ele está travado na localização dele.
      if (isAdmin && editingItem.location === 'Caratinga') {
          const cleanRequired = REQUIRED_CNPJ.replace(/\D/g, '');
          const currentCNPJ = editingItem.extractedCNPJ || '';
          
          if (currentCNPJ !== cleanRequired) {
              const confirm = window.confirm(`O CNPJ lido (${currentCNPJ || 'nenhum'}) não bate com o da firma de Caratinga (${cleanRequired}). Deseja salvar mesmo assim?`);
              if (!confirm) return;
          }
      }

      setIsSavingEdit(true);
      try {
          const { error } = await supabase.from('receipts').update({
              establishment: editingItem.establishment,
              date: editingItem.date,
              total_amount: editingItem.total_amount,
              category_id: editingItem.category_id,
              location: editingItem.location
          }).eq('id', editingItem.dbId);

          if (error) throw error;
          
          updateItem(editingItem.id, {
              establishment: editingItem.establishment,
              date: editingItem.date,
              total_amount: editingItem.total_amount,
              category_id: editingItem.category_id,
              location: editingItem.location
          });
          setEditingItem(null);
      } catch (e) {
          alert("Erro ao salvar alterações.");
      } finally {
          setIsSavingEdit(false);
      }
  };

  const retryItem = (id: string) => {
      updateItem(id, { status: 'waiting', errorMsg: undefined });
  };

  const deleteItem = async (item: QueueItem) => {
      if (item.dbId) {
          await supabase.from('receipts').delete().eq('id', item.dbId);
      }
      setQueue(prev => prev.filter(i => i.id !== item.id));
  };

  // --- RENDERIZADORES ---

  // 1. EDIT MODAL
  if (editingItem) {
      return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex items-center justify-between p-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">Corrigir Nota</h3>
                      <button onClick={() => setEditingItem(null)} className="text-gray-500 hover:text-gray-800">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-4 overflow-y-auto space-y-4">
                      {/* Preview Image */}
                       <div className="h-40 w-full bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200">
                            {editingItem.imagePreview ? (
                                <img src={editingItem.imagePreview} className="h-full object-contain" alt="Nota" />
                            ) : (
                                <ImageIcon className="text-gray-400" />
                            )}
                        </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Estabelecimento</label>
                        <input 
                            type="text" 
                            value={editingItem.establishment || ''} 
                            onChange={(e) => setEditingItem({...editingItem, establishment: e.target.value})}
                            className="w-full border-b border-gray-300 focus:border-brand-500 outline-none py-1 font-medium"
                        />
                      </div>

                      {/* Seletor de Unidade - BLOQUEADO SE NÃO FOR ADMIN */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Unidade / Empresa</label>
                        {isAdmin ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingItem({...editingItem, location: 'Caratinga'})}
                                    className={clsx("flex-1 py-2 text-xs font-medium rounded-lg border", editingItem.location === 'Caratinga' ? "bg-brand-50 border-brand-500 text-brand-700" : "bg-white border-gray-200 text-gray-600")}
                                >
                                    Caratinga
                                </button>
                                <button
                                    onClick={() => setEditingItem({...editingItem, location: 'Ponte Nova'})}
                                    className={clsx("flex-1 py-2 text-xs font-medium rounded-lg border", editingItem.location === 'Ponte Nova' ? "bg-brand-50 border-brand-500 text-brand-700" : "bg-white border-gray-200 text-gray-600")}
                                >
                                    Ponte Nova
                                </button>
                            </div>
                        ) : (
                            <div className="w-full p-2 bg-gray-100 text-gray-500 text-sm rounded-lg border border-gray-200 flex items-center gap-2">
                                <MapPin size={16} />
                                {editingItem.location} (Fixo)
                            </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                         <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
                            <input 
                                type="date" 
                                value={editingItem.date || ''} 
                                onChange={(e) => setEditingItem({...editingItem, date: e.target.value})}
                                className="w-full border-b border-gray-300 focus:border-brand-500 outline-none py-1"
                            />
                         </div>
                         <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Total (R$)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                value={editingItem.total_amount || 0} 
                                onChange={(e) => setEditingItem({...editingItem, total_amount: parseFloat(e.target.value)})}
                                className="w-full border-b border-gray-300 focus:border-brand-500 outline-none py-1 font-bold text-brand-600"
                            />
                         </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">Categoria</label>
                        <div className="grid grid-cols-2 gap-2">
                             {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setEditingItem({...editingItem, category_id: cat.id})}
                                    className={clsx(
                                        "text-xs px-2 py-2 rounded-md border transition-colors text-left truncate",
                                        editingItem.category_id === cat.id 
                                            ? "bg-brand-50 border-brand-500 text-brand-700 font-medium" 
                                            : "bg-white border-gray-200 text-gray-600"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: cat.color}}></div>
                                        <span className="truncate">{cat.name}</span>
                                    </div>
                                </button>
                             ))}
                        </div>
                      </div>
                  </div>
                  <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                      <button 
                        onClick={() => {
                            if (confirm("Descartar esta nota?")) {
                                deleteItem(editingItem);
                                setEditingItem(null);
                            }
                        }}
                        className="px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg font-medium"
                      >
                          Excluir
                      </button>
                      <button 
                        onClick={handleEditSave}
                        disabled={isSavingEdit}
                        className="flex-1 bg-brand-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-sm"
                      >
                          {isSavingEdit ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                          Salvar
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // 2. CAMERA MODE
  // ATENÇÃO: z-index 100 para ficar acima do menu inferior (z-50)
  if (mode === 'camera') {
      return (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col">
              {/* Top Bar */}
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                  <button onClick={() => { if (queue.length > 0) { finishCameraSession(); } else { closeCameraOverlay(); closeOverlay('camera'); } }} className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform">
                      <X size={22} />
                  </button>
                  <div className="text-white font-medium flex items-center gap-2">
                       <span className="bg-brand-600 px-2 py-0.5 rounded text-xs">Modo Burst</span>
                       {queue.length > 0 && (
                         <span className="flex items-center gap-1">
                           {queue.filter(i => i.status === 'success').length > 0 && (
                             <span className="text-green-400">{queue.filter(i => i.status === 'success').length} salvas</span>
                           )}
                           {queue.some(i => i.status === 'processing' || i.status === 'saving' || i.status === 'waiting') && (
                             <Loader2 className="animate-spin text-white/70" size={14} />
                           )}
                         </span>
                       )}
                  </div>
                  <button onClick={finishCameraSession} className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-semibold">
                      Concluir
                  </button>
              </div>

              {/* Video Feed */}
              <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                   <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover"
                   />
                   <canvas ref={canvasRef} className="hidden" />
                   
                   {/* Grid Overlay */}
                   <div className="absolute inset-0 pointer-events-none opacity-20">
                       <div className="w-full h-1/3 border-b border-white"></div>
                       <div className="w-full h-1/3 border-b border-white top-1/3 absolute"></div>
                       <div className="h-full w-1/3 border-r border-white left-0 absolute top-0"></div>
                       <div className="h-full w-1/3 border-r border-white left-1/3 absolute top-0"></div>
                   </div>

                   {/* Flash Effect */}
                   <div className={clsx("absolute inset-0 bg-white pointer-events-none transition-opacity duration-150", flashEffect ? "opacity-80" : "opacity-0")}></div>

                   {/* Camera Toast */}
                   {cameraToast && (
                     <div className={clsx(
                       "absolute bottom-4 left-4 right-4 p-3 rounded-xl backdrop-blur-md flex items-center gap-3 z-20 transition-all animate-fade-in shadow-lg",
                       cameraToast.type === 'success' && "bg-green-500/90 text-white",
                       cameraToast.type === 'error' && "bg-red-500/90 text-white",
                       cameraToast.type === 'processing' && "bg-white/20 text-white"
                     )}>
                       {cameraToast.type === 'processing' && <Loader2 className="animate-spin shrink-0" size={18} />}
                       {cameraToast.type === 'success' && <CheckCircle className="shrink-0" size={18} />}
                       {cameraToast.type === 'error' && <AlertTriangle className="shrink-0" size={18} />}
                       <span className="text-sm font-medium leading-tight">{cameraToast.message}</span>
                     </div>
                   )}
              </div>

              {/* Bottom Bar (Shutter) */}
              <div className="h-32 bg-black flex items-center justify-center relative pb-safe-bottom">
                  {/* Gallery/Prev Thumbnail (Optional placeholder) */}
                  <div className="absolute left-6 bottom-10">
                      {queue.length > 0 && queue[queue.length-1].imagePreview && (
                          <div className="w-12 h-12 rounded-lg border-2 border-white overflow-hidden relative">
                              <img src={queue[queue.length-1].imagePreview} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                {queue[queue.length-1].status === 'processing' || queue[queue.length-1].status === 'saving' ? (
                                  <Loader2 className="animate-spin text-white" size={16} />
                                ) : queue[queue.length-1].status === 'success' ? (
                                  <CheckCircle className="text-green-400" size={16} />
                                ) : (
                                  <span className="text-white text-xs font-bold">{queue.filter(i => i.status === 'success').length || queue.length}</span>
                                )}
                              </div>
                          </div>
                      )}
                  </div>

                  <button 
                    onClick={takePhoto}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
                  >
                      <div className="w-16 h-16 bg-white rounded-full"></div>
                  </button>
              </div>
          </div>
      );
  }

  // 3. QUEUE / SUMMARY LIST
  if (mode === 'queue' || mode === 'summary') {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header da Fila */}
        <div className="bg-white p-6 shadow-sm z-10 sticky top-0 border-b border-gray-100">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold text-gray-900">
                    Processando Notas
                </h2>
                {isProcessing && <span className="text-xs text-brand-600 font-medium animate-pulse flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> IA trabalhando...</span>}
                {isQueueFinished && <span className="text-xs text-green-600 font-bold flex items-center gap-1"><Check size={14} /> Concluído</span>}
            </div>
            
            {/* Barra de Progresso */}
            <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden mb-1">
                <div 
                    className={clsx("h-full transition-all duration-500 ease-out", isQueueFinished ? "bg-green-500" : "bg-brand-600")}
                    style={{ width: `${progressPercent}%` }}
                ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
                 <span>{processedCount + errorCount} de {totalCount}</span>
                 <span>{Math.round(progressPercent)}%</span>
            </div>
        </div>

        {/* Lista da Fila */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
            {queue.map((item) => (
                <div 
                    key={item.id}
                    className={clsx(
                        "bg-white p-3 rounded-xl border shadow-sm flex items-center gap-3 transition-all relative overflow-hidden",
                        item.status === 'processing' || item.status === 'saving' ? "border-brand-300 ring-1 ring-brand-100" : "border-gray-100",
                        item.status === 'error' ? "border-red-200 bg-red-50" : ""
                    )}
                >
                    {/* Preview Image Thumb */}
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                        {item.imagePreview ? (
                            <img src={item.imagePreview} className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex items-center justify-center h-full"><FileText size={20} className="text-gray-300"/></div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className={clsx("text-sm font-medium truncate", item.status === 'error' ? "text-red-700" : "text-gray-900")}>
                            {item.status === 'success' ? (item.establishment || "Estabelecimento") : (item.status === 'error' ? "Erro na leitura" : "Processando...")}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                             {item.status === 'success' && (
                                 <span className="font-bold text-brand-600">R$ {item.total_amount?.toFixed(2)}</span>
                             )}
                             <span className="text-gray-400">
                                {item.status === 'waiting' && 'Na fila...'}
                                {(item.status === 'processing' || item.status === 'saving') && 'Lendo...'}
                                {item.status === 'error' && (item.errorMsg || 'Falha')}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                         {item.status === 'success' && (
                             <button 
                                onClick={() => setEditingItem(item)}
                                className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
                             >
                                 <Edit2 size={18} />
                             </button>
                         )}
                         {item.status === 'error' && (
                             <button 
                                onClick={() => retryItem(item.id)}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                             >
                                 <RotateCcw size={18} />
                             </button>
                         )}
                         {(item.status === 'processing' || item.status === 'saving') && (
                             <Loader2 size={18} className="text-brand-500 animate-spin" />
                         )}
                         {item.status === 'waiting' && (
                             <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                         )}
                    </div>
                </div>
            ))}

            {/* Empty State in Queue */}
            {queue.length === 0 && (
                 <div className="text-center text-gray-400 py-10">
                     <p>Nenhuma nota na fila.</p>
                 </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-gray-100 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             {isQueueFinished ? (
                 <div className="animate-in slide-in-from-bottom-2 fade-in space-y-3">
                     <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2">
                        <CheckCircle size={16} />
                        <span className="font-medium">Processamento finalizado!</span>
                     </div>
                     <button 
                        onClick={onSaved}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-500/30 hover:bg-green-700 flex items-center justify-center gap-2 transform active:scale-95 transition-all text-lg"
                    >
                        <Save size={24} />
                        Salvar e Finalizar
                    </button>
                    <button 
                        onClick={() => setMode('upload')}
                        className="w-full text-center text-gray-500 text-sm font-medium hover:text-brand-600 py-1"
                    >
                        Adicionar mais notas
                    </button>
                 </div>
             ) : (
                <div className="flex gap-3">
                    <button 
                        onClick={() => setMode('upload')}
                        className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-50 rounded-xl transition-colors border border-gray-200"
                    >
                        Adicionar Mais
                    </button>
                    <button 
                        onClick={onSaved}
                        className="flex-1 bg-gray-100 text-gray-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                        disabled={true}
                    >
                        <Loader2 size={20} className="animate-spin" />
                        Processando...
                    </button>
                </div>
             )}
        </div>
      </div>
    );
  }

  // 4. MODO: UPLOAD (Inicial)
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-brand-100 rounded-full opacity-20 blur-3xl"></div>
      <div className="absolute bottom-[-50px] right-[-50px] w-60 h-60 bg-brand-200 rounded-full opacity-20 blur-3xl"></div>

      <div className="w-full max-w-sm space-y-6 z-10">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Adicionar Despesas</h2>
            <p className="text-gray-500 text-sm mt-2">Escolha como deseja enviar seus comprovantes.</p>
            {!isAdmin && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 border border-brand-100 rounded-full text-xs text-brand-700">
                    <MapPin size={12} />
                    <span>Salvando em: <strong>{currentUser.location}</strong></span>
                </div>
            )}
        </div>

        {/* Inputs Ocultos */}
        <input 
            type="file" 
            multiple 
            accept="image/*,application/pdf" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFilesSelect}
            onClick={handleInputFocus} // Ativa modo câmera (esconde menu)
        />

        {/* Botão Câmera Direta (Custom WebRTC) */}
        <button 
            onClick={startCamera}
            className="w-full bg-brand-600 text-white p-6 rounded-2xl shadow-xl shadow-brand-500/30 hover:bg-brand-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <Camera size={32} className="mb-1" />
          <span className="font-bold text-lg">Câmera Rápida</span>
          <span className="text-xs text-brand-100 opacity-80">Tirar múltiplas fotos sequenciais</span>
        </button>

        <div className="flex items-center gap-4 text-gray-300">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-xs font-medium uppercase">ou</span>
            <div className="h-px bg-gray-200 flex-1"></div>
        </div>

        {/* Botão Upload em Massa */}
        <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-white border border-gray-200 hover:border-brand-300 hover:bg-gray-50 p-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 text-gray-700 shadow-sm"
        >
           <Upload size={20} />
           <span className="font-semibold">Upload de Arquivos</span>
        </button>
        
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 items-start mt-4">
            <Zap size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-700 leading-tight">
                Dica: No modo Câmera Rápida, as fotos começam a ser processadas pela IA assim que você as tira, economizando seu tempo.
            </p>
        </div>
      </div>
    </div>
  );
};