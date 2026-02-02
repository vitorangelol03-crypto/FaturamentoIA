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
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white shadow-2xl relative">
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>

      <nav className="h-20 bg-white border-t border-gray-200 flex items-center justify-around px-2 pb-2 absolute bottom-0 w-full z-50">
        <button 
          onClick={() => onTabChange('dashboard')}
          className={clsx("flex flex-col items-center gap-1 p-2 transition-colors", currentTab === 'dashboard' ? "text-brand-600" : "text-gray-400")}
        >
          <Home size={24} strokeWidth={currentTab === 'dashboard' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Início</span>
        </button>

        <button 
          onClick={() => onTabChange('receipts')}
          className={clsx("flex flex-col items-center gap-1 p-2 transition-colors", currentTab === 'receipts' ? "text-brand-600" : "text-gray-400")}
        >
          <FileText size={24} strokeWidth={currentTab === 'receipts' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Notas</span>
        </button>

        <button 
          onClick={() => onTabChange('add')}
          className="flex flex-col items-center -mt-6"
        >
          <div className="bg-brand-600 text-white p-4 rounded-full shadow-lg shadow-brand-500/40 transform transition-transform active:scale-95">
            <PlusCircle size={32} />
          </div>
          <span className="text-[10px] font-medium text-gray-500 mt-1">Adicionar</span>
        </button>

        <button 
          onClick={() => onTabChange('settings')}
          className={clsx("flex flex-col items-center gap-1 p-2 transition-colors", currentTab === 'settings' ? "text-brand-600" : "text-gray-400")}
        >
          <SettingsIcon size={24} strokeWidth={currentTab === 'settings' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Ajustes</span>
        </button>
      </nav>
    </div>
  );
};
