import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { Check, X, Shield, RefreshCw, User as UserIcon, Calendar, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export const AdminPanel: React.FC = () => {
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const users = await authService.getPendingUsers();
            setPendingUsers(users);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const handleApprove = async (id: string) => {
        setActionLoading(id);
        try {
            await authService.approveUser(id);
            setPendingUsers(prev => prev.filter(u => u.id !== id));
        } catch (e) {
            alert('Erro ao aprovar.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        if (!confirm('Tem certeza que deseja rejeitar e remover este usuário?')) return;
        setActionLoading(id);
        try {
            await authService.rejectUser(id);
            setPendingUsers(prev => prev.filter(u => u.id !== id));
        } catch (e) {
            alert('Erro ao rejeitar.');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="p-4 bg-gray-50 min-h-full">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-brand-700">
                        <div className="p-2 bg-brand-50 rounded-lg">
                            <Shield size={24} />
                        </div>
                        <h2 className="text-xl font-bold">Painel Administrativo</h2>
                    </div>
                    <button onClick={fetchPending} className="p-2 text-gray-400 hover:text-brand-600 transition-colors">
                        <RefreshCw size={20} className={clsx(loading && "animate-spin")} />
                    </button>
                </div>
                <p className="text-gray-500 text-sm">Gerencie solicitações de novos usuários para Caratinga e Ponte Nova.</p>
            </div>

            <div className="space-y-4">
                <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide ml-1">
                    Solicitações Pendentes ({pendingUsers.length})
                </h3>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-brand-500" size={32} />
                    </div>
                ) : pendingUsers.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                        <UserIcon size={48} className="mx-auto mb-2 opacity-20" />
                        <p>Nenhuma solicitação pendente no momento.</p>
                    </div>
                ) : (
                    pendingUsers.map(user => (
                        <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                                        <UserIcon size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{user.full_name}</h4>
                                        <p className="text-sm text-gray-500">@{user.username}</p>
                                    </div>
                                </div>
                                <span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-full border border-yellow-100">
                                    PENDENTE
                                </span>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex gap-3 mt-4 pt-3 border-t border-gray-50">
                                <button 
                                    onClick={() => handleReject(user.id)}
                                    disabled={actionLoading === user.id}
                                    className="flex-1 py-2 bg-white border border-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {actionLoading === user.id ? <Loader2 size={16} className="animate-spin"/> : <X size={16} />}
                                    Rejeitar
                                </button>
                                <button 
                                    onClick={() => handleApprove(user.id)}
                                    disabled={actionLoading === user.id}
                                    className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm shadow-brand-200 flex items-center justify-center gap-2"
                                >
                                    {actionLoading === user.id ? <Loader2 size={16} className="animate-spin"/> : <Check size={16} />}
                                    Aprovar
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};