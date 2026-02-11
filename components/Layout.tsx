import React from 'react';
import { Home, Plus, FileText, Settings as SettingsIcon, MapPin, Shield, Radio } from 'lucide-react';
import { clsx } from 'clsx';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  onTabChange: (tab: string) => void;
  selectedLocation: string;
  onLocationChange: (loc: string) => void;
  currentUser?: User | null;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={clsx(
      "flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition-all duration-200 flex-1 relative",
      active
        ? "text-brand-600"
        : "text-gray-400 active:text-gray-500"
    )}
  >
    <div className={clsx(
      "flex items-center justify-center w-10 h-8 rounded-full transition-all duration-200",
      active && "bg-brand-50"
    )}>
      {icon}
    </div>
    <span className={clsx(
      "text-[10px] leading-tight transition-all duration-200",
      active ? "font-semibold text-brand-600" : "font-medium text-gray-400"
    )}>
      {label}
    </span>
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ children, currentTab, onTabChange, selectedLocation, onLocationChange, currentUser }) => {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.username === 'zoork22';
  const hasSefaz = isAdmin && (currentUser?.location === 'Caratinga' || currentUser?.location === 'Ponte Nova');

  return (
    <div className="flex flex-col min-h-screen w-full max-w-md mx-auto bg-white shadow-xl relative">
      
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-brand-600">
           <div className="bg-brand-600 text-white p-1.5 rounded-lg">
             <FileText size={18} />
           </div>
           <span className="font-bold text-lg tracking-tight">NotasCD</span>
        </div>
        
        <div className="relative">
            <div className={clsx("flex items-center bg-gray-100 rounded-full p-1 pl-3 gap-2", !isAdmin && "bg-brand-50 border border-brand-100")}>
                <MapPin size={14} className={clsx(!isAdmin ? "text-brand-500" : "text-gray-500")} />
                {isAdmin ? (
                    <select 
                        value={selectedLocation}
                        onChange={(e) => onLocationChange(e.target.value)}
                        className="bg-transparent text-xs font-semibold text-gray-700 outline-none appearance-none pr-2 cursor-pointer"
                    >
                        <option value="all">Todas as Unidades</option>
                        <option value="Caratinga">Caratinga</option>
                        <option value="Ponte Nova">Ponte Nova</option>
                    </select>
                ) : (
                    <span className="text-xs font-bold text-brand-700 pr-3 py-0.5">
                        {currentUser?.location || 'Caratinga'}
                    </span>
                )}
            </div>
        </div>
      </header>

      <main className="flex-1 w-full pb-28 bg-gray-50">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-lg border-t border-gray-200/80 flex items-end justify-around px-1 pb-[env(safe-area-inset-bottom)] z-50 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ height: 'calc(68px + env(safe-area-inset-bottom))' }}
      >
        <NavItem
          icon={<Home size={22} strokeWidth={currentTab === 'dashboard' ? 2.5 : 1.8} />}
          label="Início"
          active={currentTab === 'dashboard'}
          onClick={() => onTabChange('dashboard')}
        />

        <NavItem
          icon={<FileText size={22} strokeWidth={currentTab === 'receipts' ? 2.5 : 1.8} />}
          label="Notas"
          active={currentTab === 'receipts'}
          onClick={() => onTabChange('receipts')}
        />

        <button
          onClick={() => onTabChange('add')}
          className="flex flex-col items-center justify-end relative -mt-4 px-2 flex-1"
        >
          <div className={clsx(
            "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transform transition-all duration-200 active:scale-95 border-[3px] border-white",
            currentTab === 'add'
              ? "bg-brand-700 shadow-brand-500/30"
              : "bg-gradient-to-br from-brand-500 to-brand-600 shadow-brand-500/25"
          )}>
            <Plus size={28} className="text-white" strokeWidth={2.5} />
          </div>
          <span className={clsx(
            "text-[10px] mt-0.5 leading-tight",
            currentTab === 'add' ? "font-semibold text-brand-600" : "font-medium text-gray-400"
          )}>
            Novo
          </span>
        </button>

        {isAdmin && (
          <NavItem
            icon={<Shield size={22} strokeWidth={currentTab === 'admin' ? 2.5 : 1.8} />}
            label="Admin"
            active={currentTab === 'admin'}
            onClick={() => onTabChange('admin')}
          />
        )}

        {hasSefaz && (
          <NavItem
            icon={<Radio size={22} strokeWidth={currentTab === 'sefaz' ? 2.5 : 1.8} />}
            label="SEFAZ"
            active={currentTab === 'sefaz'}
            onClick={() => onTabChange('sefaz')}
          />
        )}

        {isAdmin && (
          <NavItem
            icon={<SettingsIcon size={22} strokeWidth={currentTab === 'settings' ? 2.5 : 1.8} />}
            label="Ajustes"
            active={currentTab === 'settings'}
            onClick={() => onTabChange('settings')}
          />
        )}
      </nav>
    </div>
  );
};