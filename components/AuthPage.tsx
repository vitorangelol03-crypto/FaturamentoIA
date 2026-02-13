import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';
import { FileText, Loader2, User as UserIcon, Lock, ArrowRight, UserPlus, Clock } from 'lucide-react';
import { clsx } from 'clsx';

interface AuthPageProps {
  onLogin: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { user, error } = await authService.login(username, password);
        if (error) setError(error);
        else if (user) onLogin(user);
      } else {
        if (!fullName) {
            setError("Nome completo é obrigatório.");
            setLoading(false);
            return;
        }
        const { success, error } = await authService.register(fullName, username, password);
        if (error) {
            setError(error);
        } else if (success) {
            setRegisterSuccess(true);
            setFullName('');
            setUsername('');
            setPassword('');
        }
      }
    } catch (err) {
      setError("Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  // Tela de Sucesso Pós-Cadastro
  if (registerSuccess) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Cadastro Recebido!</h2>
                <p className="text-gray-500 text-sm mb-6">
                    Sua conta foi criada e está <strong>aguardando aprovação</strong> do administrador. 
                    <br/><br/>
                    Você poderá fazer login assim que seu cadastro for liberado.
                </p>
                <button 
                    onClick={() => { setRegisterSuccess(false); setIsLogin(true); }}
                    className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition-colors"
                >
                    Voltar para Login
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-brand-100 rounded-full opacity-30 blur-3xl"></div>
        <div className="absolute bottom-[-100px] left-[-100px] w-80 h-80 bg-brand-200 rounded-full opacity-30 blur-3xl"></div>

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden z-10">
            {/* Header */}
            <div className="bg-brand-600 p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-lg rounded-2xl mb-4 text-white shadow-lg">
                    <FileText size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">NotasCD</h1>
                <p className="text-brand-100 text-sm">Gestão inteligente de notas fiscais</p>
            </div>

            {/* Form */}
            <div className="p-8">
                <div className="flex gap-4 mb-6 bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => { setIsLogin(true); setError(''); }}
                        className={clsx("flex-1 py-2 text-sm font-medium rounded-md transition-all", isLogin ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                    >
                        Entrar
                    </button>
                    <button 
                        onClick={() => { setIsLogin(false); setError(''); }}
                        className={clsx("flex-1 py-2 text-sm font-medium rounded-md transition-all", !isLogin ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                    >
                        Criar Conta
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                         <div className="space-y-1 animate-in slide-in-from-top-2 fade-in">
                            <label className="text-xs font-semibold text-gray-500 ml-1">Nome Completo</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    required={!isLogin}
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="Seu nome"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-gray-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 ml-1">Login</label>
                        <div className="relative">
                            <UserPlus className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                required
                                value={username}
                                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                placeholder="usuario.login"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-gray-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 ml-1">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-gray-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg font-medium border border-red-100 flex items-center gap-2 animate-in fade-in">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"></span>
                            {error}
                        </div>
                    )}

                    {!isLogin && (
                        <div className="text-[10px] text-gray-400 text-center px-2">
                            Novos cadastros requerem aprovação do administrador.
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? "Acessar Sistema" : "Solicitar Cadastro")}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>
            </div>
            
            <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                <p className="text-xs text-gray-400">Ambiente Seguro • NotasCD v1.3</p>
            </div>
        </div>
    </div>
  );
};