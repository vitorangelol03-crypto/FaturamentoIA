import React, { useState, useMemo } from 'react';
import { Receipt, Category, PeriodFilter } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, AreaChart, Area } from 'recharts';
import { clsx } from 'clsx';
import { ArrowUpRight, CreditCard, PieChart as PieChartIcon } from 'lucide-react';

interface DashboardProps {
  receipts: Receipt[];
  categories: Category[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#EF4444'];

export const Dashboard: React.FC<DashboardProps> = ({ receipts, categories }) => {
  const [period, setPeriod] = useState<PeriodFilter>('current_month');

  // Filter Logic specific to Dashboard
  const filteredReceipts = useMemo(() => {
    const now = new Date();
    return receipts.filter(r => {
      const rDate = new Date(r.date + 'T12:00:00'); // Ensure TZ consistency
      
      if (period === 'current_month') {
        return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
      } else if (period === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return rDate.getMonth() === lastMonth.getMonth() && rDate.getFullYear() === lastMonth.getFullYear();
      } else if (period === 'last_3_months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return rDate >= threeMonthsAgo;
      } else if (period === 'year') {
        return rDate.getFullYear() === now.getFullYear();
      }
      return true; // custom/all
    });
  }, [receipts, period]);

  // 1. Calculate Summary
  const totalSpent = filteredReceipts.reduce((acc, r) => acc + Number(r.total_amount), 0);
  const noteCount = filteredReceipts.length;
  const average = noteCount ? totalSpent / noteCount : 0;

  // 2. Prepare Data for Pie Chart (By Category)
  const categoryMap = new Map<string, { name: string; color: string; value: number }>();
  filteredReceipts.forEach(r => {
    const name = r.category_name || categories.find(c => c.id === r.category_id)?.name || 'Outros';
    const color = r.category_color || categories.find(c => c.id === r.category_id)?.color || '#6B7280';
    const existing = categoryMap.get(name);
    if (existing) {
      existing.value += Number(r.total_amount);
    } else {
      categoryMap.set(name, { name, color, value: Number(r.total_amount) });
    }
  });
  const categoryData = Array.from(categoryMap.values())
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // 3. Prepare Data for Area Chart (Over Time)
  const sortedReceipts = [...filteredReceipts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const timeMap = new Map<string, number>();
  sortedReceipts.forEach(r => {
      const d = r.date; 
      timeMap.set(d, (timeMap.get(d) || 0) + Number(r.total_amount));
  });
  
  const timeData = Array.from(timeMap.entries()).map(([date, amount]) => ({
      date: new Date(date+'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      amount
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percent = totalSpent > 0 ? ((data.value / totalSpent) * 100).toFixed(1) : '0';
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-md rounded-lg text-sm z-50">
          <p className="font-semibold mb-1" style={{color: data.payload.color}}>{data.name}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-gray-900 font-bold">R$ {Number(data.value).toFixed(2)}</p>
            <p className="text-xs text-gray-500">({percent}%)</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <div className="flex bg-gray-200 p-1 rounded-lg overflow-x-auto max-w-full">
             <button 
                onClick={() => setPeriod('current_month')}
                className={clsx("text-[10px] font-medium px-2 py-1 rounded-md transition-all whitespace-nowrap", period === 'current_month' ? "bg-white shadow text-brand-600" : "text-gray-500")}
            >
                Este Mês
            </button>
            <button 
                onClick={() => setPeriod('last_month')}
                className={clsx("text-[10px] font-medium px-2 py-1 rounded-md transition-all whitespace-nowrap", period === 'last_month' ? "bg-white shadow text-brand-600" : "text-gray-500")}
            >
                Mês Passado
            </button>
            <button 
                onClick={() => setPeriod('last_3_months')}
                className={clsx("text-[10px] font-medium px-2 py-1 rounded-md transition-all whitespace-nowrap", period === 'last_3_months' ? "bg-white shadow text-brand-600" : "text-gray-500")}
            >
                3 Meses
            </button>
             <button 
                onClick={() => setPeriod('custom')}
                className={clsx("text-[10px] font-medium px-2 py-1 rounded-md transition-all whitespace-nowrap", period === 'custom' ? "bg-white shadow text-brand-600" : "text-gray-500")}
            >
                Geral
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-2 text-gray-500 mb-1">
            <CreditCard size={16} />
            <span className="text-xs uppercase font-semibold">Total Gasto</span>
          </div>
          <p className="text-xl font-bold text-gray-900">R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <div className="flex items-center space-x-2 text-gray-500 mb-1">
            <PieChartIcon size={16} />
            <span className="text-xs uppercase font-semibold">Qtd. Notas</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{noteCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 col-span-2">
           <div className="flex items-center space-x-2 text-gray-500 mb-1">
            <ArrowUpRight size={16} />
            <span className="text-xs uppercase font-semibold">Ticket Médio</span>
          </div>
          <p className="text-xl font-bold text-gray-900">R$ {average.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Gastos por Categoria</h3>
        <div className="h-64 w-full">
            {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem dados neste período</div>
            )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
            {categoryData.map((c, i) => {
                const percent = totalSpent > 0 ? ((c.value / totalSpent) * 100).toFixed(1) : '0';
                return (
                    <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                        <div className="flex items-center min-w-0">
                            <span className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: c.color }}></span>
                            <span className="truncate">{c.name}</span>
                        </div>
                        <span className="font-semibold text-gray-400 ml-2">{percent}%</span>
                    </div>
                );
            })}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolução Temporal</h3>
        <div className="h-48 w-full">
        {timeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeData}>
                    <defs>
                        <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{fontSize: 10}} interval="preserveStartEnd" />
                    <YAxis hide />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="amount" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorAmt)" />
                </AreaChart>
            </ResponsiveContainer>
        ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem dados neste período</div>
        )}
        </div>
      </div>
    </div>
  );
};