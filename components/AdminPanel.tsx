import React, { useEffect, useState, useRef } from 'react';
import { User, Receipt } from '../types';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { REQUIRED_CNPJ } from '../constants';
import { Check, X, Shield, RefreshCw, User as UserIcon, Loader2, Users, UserCog, Key, Trash2, Ban, Search, Save, Edit, MapPin, FileText, ExternalLink, DollarSign, Eye, Calendar, CreditCard, Tag, Maximize2, Image as ImageIcon, Clock, Activity, AlertCircle, Wifi, Globe, Smartphone, DownloadCloud, Server } from 'lucide-react';
import { clsx } from 'clsx';

type AdminTab = 'pending' | 'manage' | 'audit';

export const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('pending');
    
    // Data States
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [auditReceipts, setAuditReceipts] = useState<Receipt[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Real-time Visual States
    const [isLive, setIsLive] = useState(false);
    const [lastPacketTime, setLastPacketTime] = useState<Date | null>(null);
    const [highlightUpdate, setHighlightUpdate] = useState(false);
    const [isSimulatingSefaz, setIsSimulatingSefaz] = useState(false);
    
    // Action States
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal States
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [passwordUser, setPasswordUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
    
    // Audit View Modal
    const [viewingAuditReceipt, setViewingAuditReceipt] = useState<Receipt | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // Fetch Users (Existing)
    const fetchData = async () => {
        setLoading(true);
        try {
            const [pending, all] = await Promise.all([
                authService.getPendingUsers(),
                authService.getAllUsers()
            ]);
            setPendingUsers(pending);
            setAllUsers(all);

            // Se estiver na aba de auditoria, busca as notas também
            if (activeTab === 'audit') {
                await fetchAuditData();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Audit Data (Robust & Clean)
    const fetchAuditData = async () => {
        const targetClean = REQUIRED_CNPJ.replace(/\D/g, '');
        
        // Busca notas ordenadas por data de criação (mais recentes primeiro)
        const { data, error } = await supabase
            .from('receipts')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Filtra no cliente para garantir match exato independente da formatação no banco
            const filtered = (data as Receipt[]).filter(r => {
                const dbClean = r.cnpj?.replace(/\D/g, '') || '';
                return dbClean === targetClean;
            });
            setAuditReceipts(filtered);
            setLastPacketTime(new Date());
        }
    };

    // Real-time Subscription for Audit (SEFAZ Style)
    useEffect(() => {
        let channel: any;

        if (activeTab === 'audit') {
            fetchAuditData(); // Carga inicial
            
            // Cria canal de subscrição para tabela receipts
            channel = supabase
                .channel('audit-room')
                .on(
                    'postgres_changes', 
                    { event: 'INSERT', schema: 'public', table: 'receipts' }, 
                    (payload) => {
                        // Quando entra uma nota nova, verificamos se é do CNPJ alvo
                        const newReceipt = payload.new as Receipt;
                        const targetClean = REQUIRED_CNPJ.replace(/\D/g, '');
                        const newReceiptClean = newReceipt.cnpj?.replace(/\D/g, '') || '';

                        if (newReceiptClean === targetClean) {
                            // Atualiza a lista em tempo real adicionando a nova nota no topo
                            setAuditReceipts(prev => [newReceipt, ...prev]);
                            setLastPacketTime(new Date());
                            
                            // Visual Effects
                            setHighlightUpdate(true);
                            setTimeout(() => setHighlightUpdate(false), 2000);

                            // Sound Effect (Beep simples)
                            try {
                                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                                if (AudioContext) {
                                    const ctx = new AudioContext();
                                    const osc = ctx.createOscillator();
                                    const gain = ctx.createGain();
                                    osc.connect(gain);
                                    gain.connect(ctx.destination);
                                    osc.frequency.value = 880; // A5
                                    gain.gain.value = 0.1;
                                    osc.start();
                                    setTimeout(() => osc.stop(), 150);
                                }
                            } catch (e) { /* ignore */ }
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        setIsLive(true);
                    } else {
                        setIsLive(false);
                    }
                });
        } else {
            setIsLive(false);
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [activeTab]);

    useEffect(() => {
        fetchData();
    }, [activeTab]); 

    // --- Actions ---

    const handleApprove = async (id: string) => {
        setActionLoading(id);
        try {
            await authService.approveUser(id);
            await fetchData();
        } catch (e) {
            alert('Erro ao aprovar.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        if (!confirm('Rejeitar solicitação? O usuário não poderá logar.')) return;
        setActionLoading(id);
        try {
            await authService.rejectUser(id); // Marca como rejected
            await fetchData();
        } catch (e) {
            alert('Erro ao rejeitar.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ATENÇÃO: Isso excluirá PERMANENTEMENTE o usuário e TODAS as suas notas fiscais. Continuar?')) return;
        setActionLoading(id);
        try {
            await authService.deleteUserPermanent(id);
            await fetchData();
        } catch (e) {
            alert('Erro ao excluir usuário.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleStatus = async (user: User) => {
        const newStatus = user.status === 'active' ? 'rejected' : 'active';
        const actionName = user.status === 'active' ? 'Desativar' : 'Ativar';
        
        if (!confirm(`Deseja realmente ${actionName} o usuário ${user.full_name}?`)) return;

        setActionLoading(user.id);
        try {
            await authService.updateUserProfile(user.id, { status: newStatus });
            await fetchData();
        } catch (e) {
            alert(`Erro ao ${actionName} usuário.`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveProfile = async () => {
        if (!editingUser) return;
        setActionLoading('edit-save');
        try {
            await authService.updateUserProfile(editingUser.id, {
                full_name: editingUser.full_name,
                username: editingUser.username,
                role: editingUser.role,
                location: editingUser.location
            });
            setEditingUser(null);
            await fetchData();
        } catch (e) {
            alert("Erro ao atualizar perfil.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleSavePassword = async () => {
        if (!passwordUser || !newPassword) return;
        setActionLoading('pass-save');
        try {
            await authService.adminResetPassword(passwordUser.id, newPassword);
            setPasswordUser(null);
            setNewPassword('');
            alert("Senha alterada com sucesso.");
        } catch (e) {
            alert("Erro ao alterar senha.");
        } finally {
            setActionLoading(null);
        }
    };

    // --- SIMULAÇÃO DE INTEGRAÇÃO COM SEFAZ ---
    const simulateSefazSync = async () => {
        setIsSimulatingSefaz(true);
        
        // Simula delay de rede da API do governo
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            // Gera dados aleatórios para simular uma nota externa
            const randomAmount = (Math.random() * 5000) + 100;
            const randomEstablishments = [
                "DISTRIBUIDORA DE BEBIDAS ALFA LTDA", 
                "ATACADÃO DE MATERIAIS DE CONSTRUÇÃO", 
                "ELETRO FORNECEDORA S.A.", 
                "SERVIÇOS DE MANUTENÇÃO GLOBAL",
                "POSTO DE COMBUSTIVEL RODOVIA"
            ];
            const randomEstab = randomEstablishments[Math.floor(Math.random() * randomEstablishments.length)];
            const randomKey = Array(44).fill(0).map(() => Math.floor(Math.random() * 10)).join('');
            
            // Insere no banco como se fosse uma API externa escrevendo
            const { error } = await supabase.from('receipts').insert({
                establishment: randomEstab,
                date: new Date().toISOString(),
                total_amount: randomAmount,
                cnpj: REQUIRED_CNPJ.replace(/\D/g, ''),
                receipt_number: Math.floor(Math.random() * 99999).toString(),
                category_id: null, // Notas externas geralmente vêm sem categoria classificada
                payment_method: "Boleto Bancário",
                location: 'Caratinga', // Assume sede
                user_id: null, // Sem usuário associado pois veio da SEFAZ
                source: 'external', // MARCA COMO EXTERNA
                access_key: randomKey,
                image_url: null // Notas de API vêm sem foto, geralmente XML (simulado aqui como null)
            });

            if (error) throw error;

            // O Realtime subscription vai pegar essa inserção e atualizar a tela automaticamente
            // alert("Nota fiscal encontrada na base da SEFAZ e sincronizada!");

        } catch (e) {
            console.error(e);
            alert("Erro na sincronização simulada.");
        } finally {
            setIsSimulatingSefaz(false);
        }
    };

    // Helper to find user name by ID
    const getUserName = (userId?: string | null) => {
        if (!userId) return null;
        const u = allUsers.find(user => user.id === userId) || pendingUsers.find(user => user.id === userId);
        return u ? u.full_name : 'ID: ' + userId.slice(0,6);
    };

    // --- Filter Users ---
    const filteredUsers = allUsers.filter(u => 
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Audit Stats
    const auditTotal = auditReceipts.reduce((acc, r) => acc + Number(r.total_amount), 0);

    return (
        <div className="p-4 bg-gray-50 min-h-full relative">
            
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

            {/* --- MODAL: AUDIT DETAIL VIEW --- */}
            {viewingAuditReceipt && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-5">
                        {/* Header com distinção de origem */}
                        <div className={clsx("flex items-center justify-between p-4 border-b", viewingAuditReceipt.source === 'external' ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-100")}>
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                {viewingAuditReceipt.source === 'external' ? (
                                    <><Globe size={18} className="text-blue-600"/> Nota Fiscal Eletrônica (SEFAZ)</>
                                ) : (
                                    <><Smartphone size={18} className="text-brand-600"/> Captura via App</>
                                )}
                            </h3>
                            <button onClick={() => setViewingAuditReceipt(null)} className="text-gray-400 hover:text-gray-800">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-0">
                             <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden group cursor-zoom-in border-b border-gray-200" onClick={() => viewingAuditReceipt.image_url && setZoomedImage(viewingAuditReceipt.image_url)}>
                                {viewingAuditReceipt.image_url ? (
                                    <>
                                        <img src={viewingAuditReceipt.image_url} className="w-full h-full object-contain" alt="Nota" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                                            <span className="bg-black/50 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                                                <Maximize2 size={12} /> Ampliar
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center text-gray-400 p-6 text-center">
                                        {viewingAuditReceipt.source === 'external' ? (
                                            <>
                                                <Server size={48} className="text-blue-200 mb-2"/>
                                                <p className="text-sm font-semibold text-gray-500">Documento Digital (XML)</p>
                                                <p className="text-xs text-gray-400 mt-1">Importado automaticamente da Receita Federal</p>
                                            </>
                                        ) : (
                                            <>
                                                <ImageIcon size={32} />
                                                <span className="text-xs mt-2">Sem imagem</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Emitido Em</p>
                                        <p className="text-gray-900 font-medium">{new Date(viewingAuditReceipt.date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Valor Total</p>
                                        <p className="text-brand-600 font-bold text-lg">R$ {Number(viewingAuditReceipt.total_amount).toFixed(2)}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Estabelecimento</p>
                                        <p className="text-gray-900 font-medium">{viewingAuditReceipt.establishment}</p>
                                    </div>
                                    
                                    {/* Exibe Chave de Acesso se for externa */}
                                    {viewingAuditReceipt.access_key && (
                                        <div className="col-span-2 bg-gray-50 p-2 rounded border border-gray-200 font-mono text-[10px] break-all text-gray-600">
                                            <span className="block text-[8px] uppercase text-gray-400 font-sans font-bold mb-1">Chave de Acesso NFe</span>
                                            {viewingAuditReceipt.access_key}
                                        </div>
                                    )}

                                     <div className="col-span-2 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                        <p className="text-xs text-yellow-700 uppercase font-bold mb-1">Rastreabilidade</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-gray-500 text-xs">Origem:</span>
                                                <p className="font-medium text-gray-900 flex items-center gap-1">
                                                    {viewingAuditReceipt.source === 'external' ? <Globe size={12}/> : <Smartphone size={12}/>}
                                                    {viewingAuditReceipt.source === 'external' ? 'Importação SEFAZ' : 'App do Usuário'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 text-xs">Usuário:</span>
                                                <p className="font-medium text-gray-900">
                                                    {viewingAuditReceipt.user_id ? getUserName(viewingAuditReceipt.user_id) : <span className="text-gray-400 italic">Sistema (Auto)</span>}
                                                </p>
                                            </div>
                                            <div className="col-span-2 mt-1">
                                                <span className="text-gray-500 text-xs">CNPJ Destino:</span>
                                                <p className="font-mono text-xs bg-white px-2 py-1 rounded border border-yellow-200 text-gray-700">
                                                    {viewingAuditReceipt.cnpj || 'Não registrado'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {viewingAuditReceipt.items && viewingAuditReceipt.items.length > 0 && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Itens Extraídos</p>
                                        <ul className="text-sm space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            {viewingAuditReceipt.items.map((item, idx) => (
                                                <li key={idx} className="flex justify-between">
                                                    <span className="text-gray-700 truncate pr-2">{item.name}</span>
                                                    <span className="text-gray-900 font-medium whitespace-nowrap">
                                                        {item.totalPrice ? `R$ ${item.totalPrice.toFixed(2)}` : '-'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-brand-700">
                        <div className="p-2 bg-brand-50 rounded-lg">
                            <Shield size={24} />
                        </div>
                        <h2 className="text-xl font-bold">Administração</h2>
                    </div>
                    <button onClick={fetchData} className="p-2 text-gray-400 hover:text-brand-600 transition-colors">
                        <RefreshCw size={20} className={clsx(loading && "animate-spin")} />
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={clsx("flex-1 min-w-[100px] py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2", activeTab === 'pending' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                    >
                        <UserIcon size={14} />
                        Aprovar
                        {pendingUsers.length > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 rounded-full">{pendingUsers.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('manage')}
                        className={clsx("flex-1 min-w-[100px] py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2", activeTab === 'manage' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                    >
                        <Users size={14} />
                        Usuários
                    </button>
                    <button 
                        onClick={() => setActiveTab('audit')}
                        className={clsx("flex-1 min-w-[120px] py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2", activeTab === 'audit' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                    >
                        <Activity size={14} className={clsx(activeTab === 'audit' && "text-green-500")} />
                        Monitor SEFAZ
                    </button>
                </div>
            </div>

            {/* --- TAB: AUDIT CNPJ (SEFAZ STYLE) --- */}
            {activeTab === 'audit' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    
                    {/* Status Dashboard */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className={clsx("bg-gray-800 text-white p-4 rounded-xl shadow-md col-span-2 relative overflow-hidden transition-all duration-300", highlightUpdate && "ring-4 ring-green-400 scale-[1.01]")}>
                             <div className="absolute right-0 top-0 opacity-10">
                                 <Shield size={120} />
                             </div>
                             <div className="flex justify-between items-start relative z-10">
                                 <div>
                                     <div className="flex items-center gap-2 mb-2">
                                         {isLive ? (
                                             <span className="flex h-3 w-3 relative">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                             </span>
                                         ) : (
                                             <span className="h-3 w-3 rounded-full bg-red-500"></span>
                                         )}
                                         <p className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                                             {isLive ? 'Conexão Real-Time Ativa' : 'Desconectado'}
                                         </p>
                                     </div>
                                     <h3 className="text-2xl font-mono font-bold tracking-tight">{REQUIRED_CNPJ}</h3>
                                     <p className="text-xs text-gray-400 mt-1">Monitoramento Fiscal Contínuo</p>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-xs text-gray-400 uppercase">Total Acumulado</p>
                                     <p className={clsx("text-2xl font-bold transition-colors", highlightUpdate ? "text-white" : "text-green-400")}>
                                        R$ {auditTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                     </p>
                                     {lastPacketTime && (
                                         <p className="text-[9px] text-gray-500 mt-1 font-mono flex items-center justify-end gap-1">
                                             <Wifi size={8} />
                                             Último Pulso: {lastPacketTime.toLocaleTimeString()}
                                         </p>
                                     )}
                                 </div>
                             </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 px-1">
                         <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                            <Activity size={16} /> Transações Recentes
                            <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold">{auditReceipts.length}</span>
                        </h3>
                        
                        <div className="flex items-center gap-3">
                            {/* BOTÃO DE SIMULAÇÃO SEFAZ */}
                            <button 
                                onClick={simulateSefazSync}
                                disabled={isSimulatingSefaz}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200 transition-colors"
                            >
                                {isSimulatingSefaz ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />}
                                {isSimulatingSefaz ? 'Buscando...' : 'Sincronizar SEFAZ'}
                            </button>
                            
                            {lastPacketTime && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 animate-pulse">
                                    <Clock size={10} /> Live
                                </span>
                            )}
                        </div>
                    </div>

                    {loading && auditReceipts.length === 0 ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-brand-500" size={32} />
                        </div>
                    ) : auditReceipts.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                            <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                            <p>Aguardando transações para este CNPJ...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-xs uppercase tracking-wider text-center w-12">Origem</th>
                                            <th className="px-4 py-3 text-xs uppercase tracking-wider">Horário</th>
                                            <th className="px-4 py-3 text-xs uppercase tracking-wider">Detalhe</th>
                                            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider">Valor</th>
                                            <th className="px-4 py-3 text-center text-xs uppercase tracking-wider">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {auditReceipts.map((receipt, index) => (
                                            <tr key={receipt.id} className={clsx("hover:bg-blue-50/50 transition-colors", index === 0 && highlightUpdate && "bg-green-100 duration-1000 ease-out")}>
                                                <td className="px-4 py-3 text-center">
                                                    {receipt.source === 'external' ? (
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto" title="Nota vinda da SEFAZ">
                                                            <Globe size={14} />
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center mx-auto" title="Capturada no App">
                                                            <Smartphone size={14} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono font-medium text-gray-900">{new Date(receipt.date).toLocaleDateString('pt-BR')}</span>
                                                        <span className="text-[10px] text-gray-400">{new Date(receipt.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                     <div className="text-xs font-bold text-gray-900 truncate max-w-[140px]">{receipt.establishment}</div>
                                                     <div className="flex items-center gap-1 mt-0.5">
                                                        {receipt.user_id ? (
                                                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                <UserIcon size={8} /> {getUserName(receipt.user_id)?.split(' ')[0]}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded flex items-center gap-1">
                                                                <Server size={8} /> XML Importado
                                                            </span>
                                                        )}
                                                     </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap text-xs">
                                                    R$ {Number(receipt.total_amount).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button 
                                                        onClick={() => setViewingAuditReceipt(receipt)}
                                                        className="inline-flex items-center justify-center w-8 h-8 text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-full transition-colors"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- TAB: PENDING --- */}
            {activeTab === 'pending' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                    <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide ml-1">
                        Solicitações Pendentes
                    </h3>

                    {loading ? (
                         <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-brand-500" size={32} />
                        </div>
                    ) : pendingUsers.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                            <Check size={48} className="mx-auto mb-2 opacity-20 text-green-500" />
                            <p>Tudo limpo! Nenhuma solicitação pendente.</p>
                        </div>
                    ) : (
                        pendingUsers.map(user => (
                            <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-3">
                                        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                                            <UserIcon size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{user.full_name}</h4>
                                            <p className="text-sm text-gray-500">@{user.username}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-full border border-yellow-100">
                                            NOVO
                                        </span>
                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                            {user.location || 'Sem local'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-4 pt-3 border-t border-gray-50">
                                    <button 
                                        onClick={() => handleReject(user.id)}
                                        disabled={actionLoading === user.id}
                                        className="flex-1 py-2 bg-white border border-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <X size={16} /> Rejeitar
                                    </button>
                                    <button 
                                        onClick={() => handleApprove(user.id)}
                                        disabled={actionLoading === user.id}
                                        className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === user.id ? <Loader2 size={16} className="animate-spin"/> : <Check size={16} />} 
                                        Aprovar
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* --- TAB: MANAGE USERS --- */}
            {activeTab === 'manage' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar usuário..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 ring-brand-500 outline-none shadow-sm"
                        />
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="animate-spin text-brand-500" size={32} />
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">Nenhum usuário encontrado.</div>
                        ) : (
                            filteredUsers.map(user => (
                                <div key={user.id} className={clsx("bg-white rounded-xl shadow-sm border p-4 transition-all", user.status === 'rejected' ? "border-red-100 bg-red-50/30" : "border-gray-100")}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold", user.role === 'admin' ? "bg-brand-600" : "bg-gray-400")}>
                                                {user.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 className={clsx("font-bold", user.status === 'rejected' ? "text-red-800 line-through" : "text-gray-900")}>
                                                    {user.full_name}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-sm text-gray-500">@{user.username}</p>
                                                    {user.role === 'admin' && <span className="text-[9px] bg-brand-100 text-brand-700 px-1.5 rounded font-bold">ADMIN</span>}
                                                </div>
                                                <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md w-fit">
                                                    <MapPin size={10} />
                                                    {user.location || 'Sem local'}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-1">
                                            <button onClick={() => setEditingUser(user)} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-gray-100 rounded-lg">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => setPasswordUser(user)} className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg">
                                                <Key size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100/50">
                                         <button 
                                            onClick={() => handleToggleStatus(user)}
                                            disabled={actionLoading === user.id}
                                            className={clsx("flex-1 py-1.5 text-xs font-medium rounded-lg border flex items-center justify-center gap-1", 
                                                user.status === 'active' 
                                                ? "border-gray-200 text-gray-600 hover:bg-gray-100" 
                                                : "border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
                                            )}
                                        >
                                            {user.status === 'active' ? <><Ban size={14}/> Desativar</> : <><Check size={14}/> Ativar</>}
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(user.id)}
                                            disabled={actionLoading === user.id}
                                            className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-red-100 text-red-600 hover:bg-red-50 flex items-center justify-center gap-1"
                                        >
                                            <Trash2 size={14} /> Excluir
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* --- MODAL: EDIT USER --- */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2"><UserCog size={20}/> Editar Usuário</h3>
                            <button onClick={() => setEditingUser(null)}><X size={20} className="text-gray-400"/></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-500">Nome Completo</label>
                                <input 
                                    type="text" 
                                    value={editingUser.full_name} 
                                    onChange={e => setEditingUser({...editingUser, full_name: e.target.value})}
                                    className="w-full border rounded-lg p-2 mt-1 focus:border-brand-500 outline-none bg-white text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500">Login (Username)</label>
                                <input 
                                    type="text" 
                                    value={editingUser.username} 
                                    onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                                    className="w-full border rounded-lg p-2 mt-1 focus:border-brand-500 outline-none bg-white text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500">Função (Role)</label>
                                <select 
                                    value={editingUser.role || 'user'} 
                                    onChange={e => setEditingUser({...editingUser, role: e.target.value as 'user' | 'admin'})}
                                    className="w-full border rounded-lg p-2 mt-1 bg-white text-gray-900"
                                >
                                    <option value="user">Usuário Comum</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500">Unidade (Empresa)</label>
                                <select 
                                    value={editingUser.location || 'Caratinga'} 
                                    onChange={e => setEditingUser({...editingUser, location: e.target.value as 'Caratinga' | 'Ponte Nova'})}
                                    className="w-full border rounded-lg p-2 mt-1 bg-white text-gray-900"
                                >
                                    <option value="Caratinga">Caratinga</option>
                                    <option value="Ponte Nova">Ponte Nova</option>
                                </select>
                            </div>
                            <button 
                                onClick={handleSaveProfile}
                                disabled={actionLoading === 'edit-save'}
                                className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold mt-2 flex items-center justify-center gap-2"
                            >
                                {actionLoading === 'edit-save' ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: CHANGE PASSWORD --- */}
            {passwordUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2"><Key size={20}/> Alterar Senha</h3>
                            <button onClick={() => setPasswordUser(null)}><X size={20} className="text-gray-400"/></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">Definindo nova senha para <strong>{passwordUser.full_name}</strong>.</p>
                            <div>
                                <label className="text-xs font-semibold text-gray-500">Nova Senha</label>
                                <input 
                                    type="text" 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Digite a nova senha..."
                                    className="w-full border rounded-lg p-2 mt-1 focus:border-brand-500 outline-none font-mono bg-white text-gray-900"
                                />
                            </div>
                            <button 
                                onClick={handleSavePassword}
                                disabled={!newPassword || actionLoading === 'pass-save'}
                                className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold mt-2 flex items-center justify-center gap-2"
                            >
                                {actionLoading === 'pass-save' ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                Confirmar Nova Senha
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};