import React from 'react';
import { Home, PlusCircle, FileText, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentTab, onTabChange }) => {
  return (
    <div className="flex flex-col min-h-screen w-full max-w-md mx-auto bg-white shadow-xl relative">
      {/* 
        Main Content Area 
        - padding-bottom adicionado via CSS class 'main-content-area' (definido no index.html) ou via classe tailwind abaixo
        - pb-28 garante espaço para o menu (80px) + margem extra
      */}
      <main className="flex-1 w-full pb-32">
        {children}
      </main>

      {/* 
        Bottom Navigation 
        - position: fixed (requisito do usuário)
        - bottom: 0
        - z-index: 50 (alto, mas menor que modais e câmera full screen)
        - padding-bottom para safe-area do iOS
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