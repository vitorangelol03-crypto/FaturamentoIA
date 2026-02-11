import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Download, Search, FileText, Eye, AlertCircle, CheckCircle, X, Clock, Filter, XCircle, Calendar, Tag } from 'lucide-react';
import { User, SefazNote, SefazDocZip, Category } from '../types';
import { syncSefazNotes, getSefazNotes, saveSefazNote, getLastNSU, updateLastNSU, linkReceiptsToSefazNotes } from '../services/sefazService';
import { generateDanfePDF } from '../services/pdfService';
import { clsx } from 'clsx';

interface SefazMonitorProps {
  currentUser: User;
  categories: Category[];
}

type PeriodOption = 'all' | 'current_month' | 'last_month' | 'custom';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': ['supermercado', 'mercado', 'mercearia', 'açougue', 'padaria', 'restaurante', 'lanchonete', 'pizzaria', 'bar ', 'food', 'aliment', 'hortifruti', 'frutas', 'verduras', 'cereais', 'bebidas', 'distribuidora de bebidas', 'frigorifico', 'laticinio', 'doces', 'confeitaria', 'sorvete', 'atacado', 'atacadão', 'assai', 'bretas', 'epa', 'abc supermercado', 'bahamas', 'mineirão'],
  'Transporte': ['combustivel', 'combustível', 'posto', 'gasolina', 'diesel', 'etanol', 'lubrificante', 'auto peças', 'autopeças', 'pneu', 'borracharia', 'oficina', 'mecanica', 'mecânica', 'estacionamento', 'pedagio', 'pedágio', 'uber', 'transporte', 'frete', 'shell', 'ipiranga', 'petrobrás', 'petrobras', 'br distribuidora', 'ale combustiveis'],
  'Saúde': ['farmacia', 'farmácia', 'drogaria', 'hospital', 'clinica', 'clínica', 'laboratorio', 'laboratório', 'medic', 'saude', 'saúde', 'dental', 'odonto', 'otica', 'óptica', 'droga', 'farma'],
  'Moradia': ['material de construção', 'construcao', 'construção', 'ferragem', 'ferragista', 'elétrica', 'eletrica', 'hidraulica', 'hidráulica', 'tintas', 'madeira', 'cimento', 'telha', 'imobiliaria', 'aluguel', 'condominio', 'energia', 'agua', 'água', 'gás', 'gas', 'leroy', 'telhanorte'],
  'Lazer': ['entretenimento', 'cinema', 'teatro', 'parque', 'hotel', 'pousada', 'turismo', 'viagem', 'resort', 'clube', 'academia', 'esporte', 'livraria', 'livro', 'brinquedo', 'game', 'jogo'],
  'Educação': ['escola', 'faculdade', 'universidade', 'curso', 'papelaria', 'livraria', 'educacao', 'educação', 'ensino', 'treinamento', 'apostila', 'material escolar'],
  'Vestuário': ['roupa', 'vestuario', 'vestuário', 'calcado', 'calçado', 'sapato', 'tenis', 'tênis', 'moda', 'confeccao', 'confecção', 'textil', 'têxtil', 'loja de roupas', 'magazine', 'renner', 'riachuelo', 'cea'],
  'Outros': [],
};

function categorizeBySuplierName(emitenteName: string, categories: Category[]): Category | null {
  if (!emitenteName) return null;
  const nameLower = emitenteName.toLowerCase();

  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.length === 0) continue;
    for (const kw of keywords) {
      if (nameLower.includes(kw)) {
        const found = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (found) return found;
      }
    }
  }
  return null;
}

export const SefazMonitor: React.FC<SefazMonitorProps> = ({ currentUser, categories }) => {
  const [notes, setNotes] = useState<SefazNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastNSU, setLastNSU] = useState('000000000000000');
  const [maxNSU, setMaxNSU] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [viewingXml, setViewingXml] = useState<SefazNote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodOption>('current_month');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const userLocation = currentUser.location || 'Caratinga';

  const loadData = async () => {
    setLoading(true);
    try {
      const [notesData, nsu] = await Promise.all([
        getSefazNotes(userLocation),
        getLastNSU(userLocation),
      ]);
      setNotes(notesData);
      setLastNSU(nsu);
    } catch (err: any) {
      console.error('Erro ao carregar dados SEFAZ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const parseResNFe = (doc: SefazDocZip): Partial<SefazNote> | null => {
    const json = doc.json;
    if (!json?.resNFe) return null;
    const r = json.resNFe;
    return {
      chave_acesso: r.chNFe || '',
      emitente_cnpj: r.CNPJ || '',
      emitente_nome: r.xNome || '',
      data_emissao: r.dhEmi || '',
      valor_total: r.vNF ? parseFloat(r.vNF) : undefined,
      status: r.cSitNFe === '1' ? 'ativa' : r.cSitNFe === '2' ? 'cancelada' : r.cSitNFe === '3' ? 'denegada' : 'desconhecido',
      nsu: doc.nsu,
      xml_completo: doc.xml,
    };
  };

  const parseNfeProc = (doc: SefazDocZip): Partial<SefazNote> | null => {
    const json = doc.json;
    if (!json?.nfeProc) return null;
    const nfe = json.nfeProc?.NFe?.infNFe || json.nfeProc?.nfeProc?.NFe?.infNFe;
    if (!nfe) {
      return {
        chave_acesso: json.nfeProc?.protNFe?.infProt?.chNFe || '',
        nsu: doc.nsu,
        xml_completo: doc.xml,
        status: 'ativa',
      };
    }
    const ide = nfe.ide || {};
    const emit = nfe.emit || {};
    const dest = nfe.dest || {};
    const total = nfe.total?.ICMSTot || {};
    const prot = json.nfeProc?.protNFe?.infProt || {};

    return {
      chave_acesso: prot.chNFe || '',
      numero_nota: ide.nNF || '',
      serie: ide.serie || '',
      data_emissao: ide.dhEmi || '',
      emitente_nome: emit.xNome || '',
      emitente_cnpj: emit.CNPJ || '',
      destinatario_cnpj: dest.CNPJ || '',
      valor_total: total.vNF ? parseFloat(total.vNF) : undefined,
      status: prot.cStat === '100' ? 'ativa' : 'cancelada',
      nsu: doc.nsu,
      xml_completo: doc.xml,
    };
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const currentNSU = await getLastNSU(userLocation);
      const result = await syncSefazNotes(currentNSU, userLocation);

      if (result.cStat === '137' || result.cStat === '656') {
        setSuccessMsg('Nenhum documento novo encontrado na SEFAZ.');
        setLastSyncTime(new Date().toLocaleString('pt-BR'));
        setSyncing(false);
        return;
      }

      if (result.cStat !== '138') {
        setError(`SEFAZ retornou: ${result.cStat} - ${result.xMotivo}`);
        setSyncing(false);
        return;
      }

      let savedCount = 0;
      for (const doc of result.documents) {
        let parsed: Partial<SefazNote> | null = null;

        if (doc.schema?.includes('resNFe')) {
          parsed = parseResNFe(doc);
        } else if (doc.schema?.includes('procNFe') || doc.json?.nfeProc) {
          parsed = parseNfeProc(doc);
        } else if (doc.json?.resEvento || doc.schema?.includes('resEvento')) {
          continue;
        } else {
          parsed = {
            chave_acesso: doc.nsu,
            nsu: doc.nsu,
            xml_completo: doc.xml,
            status: 'desconhecido',
          };
        }

        if (parsed && parsed.chave_acesso) {
          const cat = categorizeBySuplierName(parsed.emitente_nome || '', categories);
          if (cat) {
            parsed.category_id = cat.id;
          }
          try {
            await saveSefazNote(parsed, userLocation);
            savedCount++;
          } catch (saveErr: any) {
            console.error('Erro ao salvar nota:', saveErr);
          }
        }
      }

      await updateLastNSU(result.ultNSU, userLocation);
      setMaxNSU(result.maxNSU);
      setLastSyncTime(new Date().toLocaleString('pt-BR'));
      setSuccessMsg(`Sincronização concluída! ${savedCount} documento(s) processado(s). NSU: ${result.ultNSU}`);
      await loadData();

      try {
        const linkResult = await linkReceiptsToSefazNotes(userLocation);
        if (linkResult.linked > 0) {
          setSuccessMsg(prev => `${prev} | ${linkResult.linked} nota(s) vinculada(s) automaticamente.`);
          await loadData();
        }
      } catch (linkErr) {
        console.error('Erro ao vincular notas:', linkErr);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar com SEFAZ.');
    } finally {
      setSyncing(false);
    }
  };

  const getDateRange = (period: PeriodOption): { start: string; end: string } | null => {
    const now = new Date();
    if (period === 'current_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    if (period === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    if (period === 'custom' && dateStart) {
      return { start: dateStart, end: dateEnd || '9999-12-31' };
    }
    return null;
  };

  const filteredNotes = useMemo(() => {
    const range = getDateRange(periodFilter);
    return notes.filter(note => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = note.emitente_nome?.toLowerCase().includes(q);
        const matchChave = note.chave_acesso?.toLowerCase().includes(q);
        const matchCnpj = note.emitente_cnpj?.includes(q);
        if (!matchName && !matchChave && !matchCnpj) return false;
      }
      if (range && note.data_emissao) {
        const noteDate = note.data_emissao.slice(0, 10);
        if (noteDate < range.start) return false;
        if (noteDate > range.end) return false;
      }
      return true;
    });
  }, [notes, searchQuery, periodFilter, dateStart, dateEnd]);

  const totalFiltered = useMemo(() => {
    return filteredNotes.reduce((sum, n) => sum + (n.valor_total || 0), 0);
  }, [filteredNotes]);

  const getCategoryForNote = (note: SefazNote): Category | null => {
    if (note.category_id) {
      return categories.find(c => c.id === note.category_id) || null;
    }
    return categorizeBySuplierName(note.emitente_nome || '', categories);
  };

  const categorySummary = useMemo(() => {
    const map = new Map<string, { category: Category; total: number; count: number }>();
    for (const note of filteredNotes) {
      const cat = getCategoryForNote(note);
      const catName = cat?.name || 'Outros';
      const catObj = cat || categories.find(c => c.name === 'Outros') || { id: '0', name: 'Outros', color: '#6B7280' };
      const existing = map.get(catName);
      if (existing) {
        existing.total += note.valor_total || 0;
        existing.count += 1;
      } else {
        map.set(catName, { category: catObj, total: note.valor_total || 0, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredNotes, categories]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ativa':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700"><CheckCircle size={10} />Ativa</span>;
      case 'cancelada':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700"><XCircle size={10} />Cancelada</span>;
      case 'denegada':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700"><AlertCircle size={10} />Denegada</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600"><Clock size={10} />Desconhecido</span>;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr.slice(0, 10);
    }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const truncateChave = (chave?: string) => {
    if (!chave) return '-';
    if (chave.length > 20) return chave.slice(0, 10) + '...' + chave.slice(-10);
    return chave;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FileText size={20} className="text-brand-600" />
          Monitor SEFAZ - {userLocation}
        </h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm",
            syncing
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-brand-600 text-white hover:bg-brand-700 active:scale-95"
          )}
        >
          <RefreshCw size={16} className={clsx(syncing && "animate-spin")} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-1 shadow-sm">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Último NSU: <strong className="text-gray-700">{lastNSU}</strong></span>
          {maxNSU && <span>Max NSU: <strong className="text-gray-700">{maxNSU}</strong></span>}
        </div>
        {lastSyncTime && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Clock size={10} /> Última sync: {lastSyncTime}
          </div>
        )}
        <div className="text-xs text-gray-500">
          Total de notas: <strong className="text-gray-700">{notes.length}</strong>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700">{error}</div>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-700">{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-green-400 hover:text-green-600">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-gray-400 flex-shrink-0" />
        <div className="flex gap-1 flex-1 overflow-x-auto">
          {[
            { key: 'current_month' as PeriodOption, label: 'Este mês' },
            { key: 'last_month' as PeriodOption, label: 'Mês passado' },
            { key: 'custom' as PeriodOption, label: 'Personalizado' },
            { key: 'all' as PeriodOption, label: 'Todos' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriodFilter(opt.key)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                periodFilter === opt.key
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {periodFilter === 'custom' && (
        <div className="flex gap-2 bg-gray-50 p-3 rounded-xl">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase">De</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Até</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {(dateStart || dateEnd) && (
            <button
              onClick={() => { setDateStart(''); setDateEnd(''); }}
              className="self-end mb-0.5 text-xs text-red-400 hover:text-red-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por emitente, CNPJ ou chave..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
        />
      </div>

      {filteredNotes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
              <Tag size={12} /> Gastos por Categoria
            </span>
            <span className="text-sm font-bold text-brand-600">{formatCurrency(totalFiltered)}</span>
          </div>
          <div className="space-y-1.5">
            {categorySummary.map(item => (
              <div key={item.category.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.category.color }} />
                <span className="text-xs text-gray-700 flex-1 truncate">{item.category.name}</span>
                <span className="text-[10px] text-gray-400">{item.count}x</span>
                <span className="text-xs font-semibold text-gray-800 min-w-[80px] text-right">{formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <RefreshCw size={24} className="animate-spin mb-2" />
          <span className="text-sm">Carregando notas...</span>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <FileText size={32} className="mb-2 opacity-40" />
          <span className="text-sm font-medium">Nenhuma nota encontrada</span>
          <span className="text-xs mt-1">Clique em "Sincronizar" para buscar notas da SEFAZ</span>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note, idx) => {
            const noteCat = getCategoryForNote(note);
            return (
              <div key={note.id || idx} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-800 truncate">
                      {note.emitente_nome || 'Emitente não identificado'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {note.emitente_cnpj ? `CNPJ: ${note.emitente_cnpj}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {noteCat && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: noteCat.color + '20', color: noteCat.color }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: noteCat.color }} />
                        {noteCat.name}
                      </span>
                    )}
                    {getStatusBadge(note.status)}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-600">
                  {note.numero_nota && (
                    <span>Nº <strong>{note.numero_nota}</strong>{note.serie ? `/${note.serie}` : ''}</span>
                  )}
                  <span>{formatDate(note.data_emissao)}</span>
                  {note.valor_total !== undefined && note.valor_total !== null && (
                    <span className="font-bold text-brand-600">{formatCurrency(note.valor_total)}</span>
                  )}
                </div>

                <div className="text-[10px] text-gray-400 font-mono">
                  {truncateChave(note.chave_acesso)}
                </div>

                {note.nsu && (
                  <div className="text-[10px] text-gray-400">
                    NSU: {note.nsu}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                  {note.receipt_id ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg">
                      <CheckCircle size={12} /> Vinculada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg">
                      <AlertCircle size={12} /> Sem recibo
                    </span>
                  )}
                  <button
                    onClick={() => setViewingXml(note)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
                  >
                    <Eye size={12} /> Detalhes
                  </button>
                  <button
                    onClick={() => generateDanfePDF(note)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <Download size={12} /> Baixar PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewingXml && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800 text-sm">Detalhes da Nota</h3>
              <button onClick={() => setViewingXml(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Emitente</label>
                <p className="text-sm text-gray-800">{viewingXml.emitente_nome || '-'}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">CNPJ Emitente</label>
                <p className="text-sm text-gray-800">{viewingXml.emitente_cnpj || '-'}</p>
              </div>
              {(() => {
                const detailCat = getCategoryForNote(viewingXml);
                return detailCat ? (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Categoria</label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: detailCat.color }} />
                      <span className="text-sm font-medium text-gray-800">{detailCat.name}</span>
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Número</label>
                  <p className="text-sm text-gray-800">{viewingXml.numero_nota || '-'}{viewingXml.serie ? ` / Série ${viewingXml.serie}` : ''}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Data Emissão</label>
                  <p className="text-sm text-gray-800">{formatDate(viewingXml.data_emissao)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Valor Total</label>
                  <p className="text-sm font-bold text-brand-600">{formatCurrency(viewingXml.valor_total)}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Status</label>
                  <div className="mt-0.5">{getStatusBadge(viewingXml.status)}</div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Chave de Acesso</label>
                <p className="text-xs text-gray-700 font-mono break-all">{viewingXml.chave_acesso}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">NSU</label>
                <p className="text-sm text-gray-800">{viewingXml.nsu || '-'}</p>
              </div>
              {viewingXml.xml_completo && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">XML</label>
                  <pre className="text-[10px] text-gray-600 bg-gray-50 rounded-lg p-2 mt-1 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                    {viewingXml.xml_completo}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setViewingXml(null)}
                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
