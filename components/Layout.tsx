import React from 'react';
import { Home, PlusCircle, FileText, Settings as SettingsIcon, MapPin } from 'lucide-react';
import { clsx } from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  onTabChange: (tab: string) => void;
  selectedLocation: string;
  onLocationChange: (loc: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentTab, onTabChange, selectedLocation, onLocationChange }) => {
  return (
    <div className="flex flex-col min-h-screen w-full max-w-md mx-auto bg-white shadow-xl relative">
      
      {/* Header com Seletor de Empresa */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-brand-600">
           <div className="bg-brand-600 text-white p-1.5 rounded-lg">
             <FileText size={18} />
           </div>
           <span className="font-bold text-lg tracking-tight">SmartReceipts</span>
        </div>
        
        <div className="relative">
            <div className="flex items-center bg-gray-100 rounded-full p-1 pl-3 gap-2">
                <MapPin size={14} className="text-gray-500" />
                <select 
                    value={selectedLocation}
                    onChange={(e) => onLocationChange(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-700 outline-none appearance-none pr-2 cursor-pointer"
                >
                    <option value="all">Todas as Unidades</option>
                    <option value="Caratinga">Caratinga</option>
                    <option value="Ponte Nova">Ponte Nova</option>
                </select>
            </div>
        </div>
      </header>

      {/* 
        Main Content Area 
        - pb-32 garante espaço para o menu (80px) + margem extra
      */}
      <main className="flex-1 w-full pb-32 bg-gray-50">
        {children}
      </main>

      {/* 
        Bottom Navigation 
        - position: fixed (requisito do usuário)
        - bottom: 0
        - z-index: 50
      */}
      <nav className="bottom-nav fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-200 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] h-[calc(70px+env(safe-area-inset-bottom))] z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => onTabChange('dashboard')}
          className={clsx("flex flex-col items-center gap-1 p-2 transition-colors flex-1", currentTab === 'dashboard' ? "text-brand-600" : "text-gray-400")}
        >
          <Home size={24} strokeWidth={currentTab === 'dashboard' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Início</span>
        </button>

        <button 
          onClick={() => onTabChange('receipts')}
          className={clsx("flex flex-col items-center gap-1 p-2 transition-colors flex-1", currentTab === 'receipts' ? "text-brand-600" : "text-gray-400")}
        >
          <FileText size={24} strokeWidth={currentTab === 'receipts' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Notas</span>
        </button>

        <button 
          onClick={() => onTabChange('add')}
          className="flex flex-col items-center justify-end pb-2 relative z-10 -mt-8 flex-1"
        >
          <div className={clsx(
            "p-4 rounded-full shadow-lg shadow-brand-500/40 transform transition-transform active:scale-95 border-4 border-white",
            currentTab === 'add' ? "bg-brand-700" : "bg-brand-600 text-white"
          )}>
            <PlusCircle size={32} className="text-white" />
          </div>
          <span className={clsx("text-[10px] font-medium mt-1", currentTab === 'add' ? "text-brand-600" : "text-gray-500")}>Adicionar</span>
        </button>

        <button 
          onClick={() => onTabChange('settings')}
          className={clsx("flex flex-col items-center gap-1 p-2 transition-colors flex-1", currentTab === 'settings' ? "text-brand-600" : "text-gray-400")}
        >
          <SettingsIcon size={24} strokeWidth={currentTab === 'settings' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Ajustes</span>
        </button>
      </nav>
    </div>
  );
};