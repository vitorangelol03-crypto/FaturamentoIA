import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { Check, X, Shield, RefreshCw, User as UserIcon, Loader2, Users, UserCog, Key, Trash2, Ban, Search, Save, Edit, MapPin } from 'lucide-react';
import { clsx } from 'clsx';

type AdminTab = 'pending' | 'manage';

export const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('pending');
    
    // Data States
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Action States
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal States
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [passwordUser, setPasswordUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pending, all] = await Promise.all([
                authService.getPendingUsers(),
                authService.getAllUsers()
            ]);
            setPendingUsers(pending);
            setAllUsers(all);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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

    // --- Filter Users ---
    const filteredUsers = allUsers.filter(u => 
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-4 bg-gray-50 min-h-full">
            
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
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={clsx("flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2", activeTab === 'pending' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                    >
                        <UserIcon size={16} />
                        Aprovações 
                        {pendingUsers.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingUsers.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('manage')}
                        className={clsx("flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2", activeTab === 'manage' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                    >
                        <Users size={16} />
                        Gestão de Usuários
                    </button>
                </div>
            </div>

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