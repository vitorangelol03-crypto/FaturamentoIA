import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Download, Search, FileText, Eye, AlertCircle, CheckCircle, X, Clock, Filter, XCircle, Calendar, Tag, ArrowLeftRight } from 'lucide-react';
import { User, SefazNote, SefazDocZip, Category } from '../types';
import { syncSefazNotes, getSefazNotes, saveSefazNote, getLastNSU, updateLastNSU, linkReceiptsToSefazNotes, getLinkedReceiptImages } from '../services/sefazService';
import { generateDanfePDF, generateSefazReportPDF } from '../services/pdfService';
import { clsx } from 'clsx';

interface SefazMonitorProps {
  currentUser: User;
  categories: Category[];
}

type PeriodOption = 'all' | 'current_month' | 'last_month' | 'custom';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': [
    'supermercado', 'supermerc', 'mercado', 'mercearia', 'mercear', 'mini mercado', 'minimercado',
    'açougue', 'acougue', 'casa de carnes', 'carnes', 'frigorifico', 'frigorific',
    'padaria', 'panificadora', 'panificacao', 'panificação', 'confeitaria', 'doceria', 'doces',
    'restaurante', 'rest.', 'lanchonete', 'lanch', 'pizzaria', 'pizza', 'hamburgueria', 'burger',
    'churrascaria', 'churrasc', 'sushi', 'japonesa', 'comida', 'refeicao', 'refeição',
    'food', 'aliment', 'alimentacao', 'alimentação', 'generos alimenticios',
    'hortifruti', 'hortifrutigranjeiro', 'frutas', 'verduras', 'legumes', 'sacolao', 'sacolão',
    'cereais', 'cerealist', 'grãos', 'graos',
    'bebidas', 'distribuidora de bebidas', 'dist. de bebidas', 'distrib. bebidas', 'adega', 'cervejaria',
    'laticinio', 'lacticinio', 'laticinios', 'leite', 'queijo',
    'sorvete', 'sorveteria', 'gelato', 'acai', 'açaí',
    'atacado', 'atacadão', 'atacadao', 'atacadista', 'assai', 'assaí', 'makro', 'macro',
    'bretas', 'epa', 'bahamas', 'mineirão', 'mineirao', 'superbom', 'supernosso',
    'dia %', 'pao de acucar', 'pão de açúcar', 'carrefour', 'extra', 'big', 'maxxi',
    'bar e ', 'bar do ', 'bar da ', 'boteco', 'cantina', 'cafeteria', 'cafe', 'café',
    'rotisserie', 'emporio', 'empório', 'delicatessen', 'delicat', 'quitanda', 'armazem', 'armazém',
    'frios', 'embutidos', 'salgados', 'pastel', 'pastelaria', 'tapioca', 'coxinha',
    'nutricao', 'nutrição', 'natural', 'naturais', 'diet', 'integral', 'organico', 'orgânico',
    'biscoito', 'chocolate', 'bomboniere', 'guloseima', 'bala',
    'agua mineral', 'água mineral', 'engarrafamento',
    'prod. alimenticio', 'industria de alimento', 'ind. aliment',
    'cesta basica', 'cesta básica',
  ],
  'Transporte': [
    'combustivel', 'combustível', 'combustiveis', 'combustíveis',
    'posto', 'posto de', 'auto posto', 'rede de postos',
    'gasolina', 'diesel', 'etanol', 'gnv', 'glp',
    'lubrificante', 'lubrific', 'oleo', 'óleo', 'filtro',
    'auto peças', 'autopeças', 'auto pecas', 'autopecas', 'pecas automotivas', 'peças automotivas',
    'pneu', 'pneus', 'borracharia', 'borracheiro', 'recauchutagem', 'recapagem',
    'oficina', 'mecanica', 'mecânica', 'funilaria', 'lanternagem', 'pintura automotiva',
    'estacionamento', 'parking', 'garagem',
    'pedagio', 'pedágio', 'rodovia',
    'uber', 'transporte', 'frete', 'mudanca', 'mudança', 'transportadora', 'logistica', 'logística',
    'shell', 'ipiranga', 'petrobrás', 'petrobras', 'br distribuidora',
    'ale combustiveis', 'ale combustíveis', 'raizen', 'raízen',
    'lava jato', 'lavacao', 'lavação', 'lava car', 'lava rapido', 'lava rápido',
    'retifica', 'retífica', 'radiador', 'escapamento', 'suspensao', 'suspensão', 'freio',
    'automotivo', 'automotiva', 'veicular', 'automovel', 'automóvel',
    'moto peças', 'moto pecas', 'motopecas', 'motopeças',
    'concessionaria', 'concessionária', 'revenda de veiculos', 'revenda de veículos',
    'locadora', 'rent a car', 'aluguel de veiculos', 'aluguel de veículos',
    'bateria', 'baterias', 'acumulador',
    'seguro auto', 'seguro veicular',
    'despachante', 'detran', 'licenciamento',
  ],
  'Saúde': [
    'farmacia', 'farmácia', 'farma', 'pharma',
    'drogaria', 'droga', 'drog.', 'drogasil', 'drogaraia', 'droga raia', 'pacheco', 'venancio',
    'hospital', 'hosp.', 'santa casa', 'pronto socorro',
    'clinica', 'clínica', 'clin.', 'consultorio', 'consultório',
    'laboratorio', 'laboratório', 'lab.', 'analises clinicas', 'análises clínicas', 'exame',
    'medic', 'medicina', 'médic',
    'saude', 'saúde', 'wellness',
    'dental', 'odonto', 'odontologia', 'dentista', 'ortodont', 'implante',
    'otica', 'óptica', 'optica', 'ótica', 'lente', 'oculos', 'óculos',
    'fisioterapia', 'fisio', 'pilates', 'rpg',
    'psicolog', 'terapia', 'terapeut',
    'nutri', 'nutricionista',
    'ortopedia', 'ortoped', 'protese', 'prótese',
    'veterinario', 'veterinária', 'vet.', 'pet shop', 'petshop', 'pet center', 'clinica vet',
    'perfumaria', 'cosmetico', 'cosmético', 'higiene', 'beleza', 'estetica', 'estética',
    'manipulacao', 'manipulação', 'homeopatia',
    'material hospitalar', 'cirurgico', 'cirúrgico', 'descartaveis', 'descartáveis',
    'equipamento medico', 'equipamento médico', 'aparelho auditivo',
    'plano de saude', 'plano de saúde', 'unimed', 'amil', 'sulamerica',
  ],
  'Moradia': [
    'material de construção', 'material de construcao', 'mat. const', 'mat const',
    'construcao', 'construção', 'construtora',
    'ferragem', 'ferragista', 'ferragens', 'parafuso', 'ferreteria',
    'elétrica', 'eletrica', 'eletric', 'fio', 'cabo', 'disjuntor', 'tomada',
    'hidraulica', 'hidráulica', 'hidrául', 'encanamento', 'cano', 'tubo',
    'tintas', 'tinta', 'pintura', 'verniz', 'suvinil', 'coral', 'lukscolor',
    'madeira', 'madeireira', 'serraria', 'compensado', 'mdf',
    'cimento', 'argamassa', 'concreto', 'areia', 'brita', 'pedra', 'cal',
    'telha', 'telhado', 'cobertura', 'calha',
    'ceramica', 'cerâmica', 'piso', 'revestimento', 'azulejo', 'porcelanato',
    'vidracaria', 'vidraçaria', 'vidro', 'espelho', 'box',
    'serralheria', 'metalurgica', 'metalúrgica', 'solda', 'portao', 'portão', 'grade',
    'imobiliaria', 'imobiliária', 'aluguel', 'condominio', 'condomínio',
    'energia', 'cemig', 'eletropaulo', 'copel', 'celpe', 'light',
    'agua', 'água', 'saneamento', 'copasa', 'sabesp',
    'gás', 'gas', 'gas de cozinha', 'ultragaz', 'liquigas', 'nacional gas',
    'leroy', 'leroy merlin', 'telhanorte', 'c&c', 'tumelero', 'cassol',
    'moveis', 'móveis', 'mobilia', 'mobília', 'colchao', 'colchão',
    'eletrodomestico', 'eletrodoméstico', 'geladeira', 'fogao', 'fogão', 'microondas',
    'decoracao', 'decoração', 'decor', 'cortina', 'persiana', 'tapete',
    'limpeza', 'produto de limpeza', 'detergente', 'desinfetante', 'vassoura',
    'jardim', 'jardinagem', 'paisagismo', 'planta', 'flores', 'floricultura',
    'dedetizacao', 'dedetização', 'controle de pragas',
    'chaveiro', 'fechadura', 'cadeado',
    'impermeabilizacao', 'impermeabilização',
  ],
  'Lazer': [
    'entretenimento', 'diversao', 'diversão',
    'cinema', 'teatro', 'show', 'ingresso', 'evento',
    'parque', 'zoologico', 'zoológico', 'aquario', 'aquário',
    'hotel', 'pousada', 'hostel', 'hospedagem', 'resort', 'airbnb',
    'turismo', 'viagem', 'agencia de viagem', 'agência de viagem', 'excursao', 'excursão',
    'clube', 'associacao', 'associação', 'recreacao', 'recreação',
    'academia', 'fitness', 'crossfit', 'musculacao', 'musculação', 'natacao', 'natação',
    'esporte', 'esportivo', 'decathlon', 'centauro', 'netshoes',
    'brinquedo', 'brinquedos', 'toy', 'game', 'jogo', 'jogos',
    'instrumento musical', 'musica', 'música', 'violao', 'violão', 'guitarra',
    'camping', 'pesca', 'aventura', 'trilha',
    'streaming', 'netflix', 'spotify', 'assinatura digital',
    'bar e rest', 'happy hour', 'balada', 'casa noturna',
  ],
  'Educação': [
    'escola', 'colegio', 'colégio', 'inst. educ', 'instituicao de ensino', 'instituição de ensino',
    'faculdade', 'universidade', 'univ.', 'centro universitario', 'centro universitário',
    'curso', 'cursos', 'treinamento', 'capacitacao', 'capacitação',
    'papelaria', 'papel', 'caderno', 'caneta', 'material escolar',
    'livraria', 'livro', 'livros', 'editora', 'grafica', 'gráfica', 'impressao', 'impressão',
    'educacao', 'educação', 'ensino', 'pedagogia',
    'apostila', 'didatico', 'didático',
    'creche', 'berçario', 'bercario', 'jardim de infancia', 'jardim de infância',
    'auto escola', 'autoescola', 'cfc', 'centro de formacao', 'centro de formação',
    'idioma', 'lingua', 'língua', 'ingles', 'inglês', 'espanhol',
    'informatica', 'informática', 'computacao', 'computação', 'programacao', 'programação',
    'xerox', 'copiadora', 'reprografia', 'encadernacao', 'encadernação',
  ],
  'Vestuário': [
    'roupa', 'roupas', 'vestuario', 'vestuário', 'vest.',
    'calcado', 'calçado', 'calçados', 'calcados', 'sapato', 'sapatos', 'sandalia', 'sandália',
    'tenis', 'tênis', 'bota', 'botas', 'sapataria',
    'moda', 'modas', 'fashion', 'boutique',
    'confeccao', 'confecção', 'confeccoes', 'confecções', 'costura', 'alfaiate', 'atelier', 'ateliê',
    'textil', 'têxtil', 'tecido', 'tecidos', 'aviamento', 'armarinho', 'retrosaria',
    'magazine', 'renner', 'riachuelo', 'cea', 'c&a', 'marisa', 'hering', 'zara',
    'loja de roupas', 'lojas de roupa', 'malha', 'malhas', 'camiseta', 'camisaria',
    'jeans', 'calcas', 'calças',
    'intima', 'íntima', 'lingerie', 'meia', 'meias', 'cueca', 'pijama',
    'esportivo', 'uniforme', 'uniformes', 'fardamento',
    'relojoaria', 'relogio', 'relógio', 'joalheria', 'joia', 'jóia', 'bijuteria', 'bijoux',
    'acessorio', 'acessório', 'bolsa', 'bolsas', 'cinto', 'carteira',
    'otica', 'ótica',
    'lavanderia', 'tinturaria', 'passadoria',
  ],
  'Tecnologia': [
    'informatica', 'informática', 'computador', 'notebook', 'laptop',
    'celular', 'smartphone', 'telefone', 'telecom', 'telecomunicacao', 'telecomunicação',
    'eletronico', 'eletrônico', 'eletronicos', 'eletrônicos', 'componente',
    'impressora', 'cartucho', 'toner', 'suprimento',
    'software', 'sistema', 'tecnologia', 'tech', 'ti ',
    'internet', 'provedor', 'banda larga', 'fibra',
    'camera', 'câmera', 'foto', 'fotografia',
    'som', 'audio', 'áudio', 'caixa de som',
    'tv', 'televisao', 'televisão', 'monitor', 'tela',
    'kabum', 'pichau', 'terabyte',
    'assistencia tecnica', 'assistência técnica', 'conserto', 'reparo',
    'tablet', 'ipad', 'apple', 'samsung', 'motorola', 'xiaomi', 'lg ',
    'cabo', 'adaptador', 'carregador', 'fonte', 'bateria',
    'seguranca eletronica', 'segurança eletrônica', 'alarme', 'cerca eletrica', 'cerca elétrica',
  ],
  'Serviços': [
    'servico', 'serviço', 'servicos', 'serviços', 'prestacao de servico', 'prestação de serviço',
    'contabilidade', 'contabil', 'contábil', 'contador', 'escritorio contabil', 'escritório contábil',
    'advocacia', 'advogado', 'jurídico', 'juridico', 'escritorio de advocacia',
    'consultoria', 'assessoria', 'consultores',
    'engenharia', 'arquitetura', 'projeto',
    'marketing', 'publicidade', 'propaganda', 'agencia', 'agência', 'comunicacao', 'comunicação',
    'seguros', 'seguradora', 'corretora de seguros', 'corretor',
    'cartorio', 'cartório', 'tabeliao', 'tabelião', 'registro',
    'correios', 'sedex', 'pac',
    'banco', 'financeira', 'credito', 'crédito', 'emprestimo', 'empréstimo',
    'cobranca', 'cobrança',
    'limpeza', 'conservacao', 'conservação', 'manutencao', 'manutenção',
    'seguranca', 'segurança', 'vigilancia', 'vigilância', 'monitoramento',
    'entrega', 'delivery', 'motoboy', 'courier',
    'salao', 'salão', 'barbearia', 'cabeleireiro', 'cabelereira',
    'fotocopia', 'fotocópia', 'digitacao', 'digitação',
  ],
  'Agropecuária': [
    'agropecuaria', 'agropecuária', 'agro', 'agric', 'agricultura', 'agronegocio', 'agronegócio',
    'pecuaria', 'pecuária', 'gado', 'bovino', 'suino', 'suíno', 'avicola', 'avícola',
    'veterinario', 'veterinária', 'vet ',
    'racao', 'ração', 'nutricao animal', 'nutrição animal', 'sal mineral',
    'semente', 'sementes', 'muda', 'mudas', 'viveiro',
    'adubo', 'fertilizante', 'defensivo', 'herbicida', 'inseticida', 'fungicida', 'pesticida',
    'implemento', 'trator', 'maquinas agricolas', 'máquinas agrícolas',
    'irrigacao', 'irrigação',
    'cooperativa', 'coop.', 'coopat', 'cooperag',
    'laticinio', 'leite', 'ordenha',
    'selaria', 'arreio', 'equino', 'cavalo',
    'cerca', 'arame', 'mourão', 'mourao', 'estaca',
    'silagem', 'feno', 'pastagem', 'capim',
    'curral', 'estabulo', 'estábulo', 'aviario', 'aviário', 'granja',
    'pet shop', 'petshop', 'pet center', 'canil', 'animal',
  ],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categorizeBySuplierName(emitenteName: string, categories: Category[]): Category | null {
  if (!emitenteName) return null;
  const nameLower = emitenteName.toLowerCase();
  const nameNormalized = normalizeText(emitenteName);

  let bestMatch: { catName: string; priority: number } | null = null;

  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.length === 0) continue;
    for (const kw of keywords) {
      const kwNormalized = normalizeText(kw);
      if (nameLower.includes(kw) || nameNormalized.includes(kwNormalized)) {
        const priority = kw.length;
        if (!bestMatch || priority > bestMatch.priority) {
          bestMatch = { catName, priority };
        }
      }
    }
  }

  if (bestMatch) {
    const found = categories.find(c => c.name.toLowerCase() === bestMatch!.catName.toLowerCase());
    if (found) return found;
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

  const defaultLocation = currentUser.location || 'Caratinga';
  const accessibleLocations: string[] = currentUser.sefaz_access && currentUser.sefaz_access.length > 0
    ? currentUser.sefaz_access
    : [defaultLocation];
  const canSwitchLocation = accessibleLocations.length > 1;

  const [activeLocation, setActiveLocation] = useState<string>(
    accessibleLocations.includes(defaultLocation) ? defaultLocation : accessibleLocations[0]
  );

  useEffect(() => {
    if (!accessibleLocations.includes(activeLocation)) {
      setActiveLocation(accessibleLocations[0]);
    }
  }, [accessibleLocations.join(',')]);

  const switchLocation = () => {
    const currentIdx = accessibleLocations.indexOf(activeLocation);
    const nextIdx = (currentIdx + 1) % accessibleLocations.length;
    setActiveLocation(accessibleLocations[nextIdx]);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [notesData, nsu] = await Promise.all([
        getSefazNotes(activeLocation),
        getLastNSU(activeLocation),
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
  }, [activeLocation]);

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
      const currentNSU = await getLastNSU(activeLocation);
      const result = await syncSefazNotes(currentNSU, activeLocation);

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
            await saveSefazNote(parsed, activeLocation);
            savedCount++;
          } catch (saveErr: any) {
            console.error('Erro ao salvar nota:', saveErr);
          }
        }
      }

      await updateLastNSU(result.ultNSU, activeLocation);
      setMaxNSU(result.maxNSU);
      setLastSyncTime(new Date().toLocaleString('pt-BR'));
      setSuccessMsg(`Sincronização concluída! ${savedCount} documento(s) processado(s). NSU: ${result.ultNSU}`);
      await loadData();

      try {
        const linkResult = await linkReceiptsToSefazNotes(activeLocation);
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

  const getPeriodLabel = (): string => {
    const now = new Date();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    if (periodFilter === 'current_month') {
      return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    }
    if (periodFilter === 'last_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${monthNames[prev.getMonth()]} ${prev.getFullYear()}`;
    }
    if (periodFilter === 'custom') {
      const from = dateStart || '...';
      const to = dateEnd || '...';
      return `${from} a ${to}`;
    }
    return 'Todos os períodos';
  };

  const handleDownloadReport = async () => {
    if (filteredNotes.length === 0) {
      alert('Nenhuma nota para incluir no relatório.');
      return;
    }
    const receiptIds = filteredNotes
      .filter(n => n.receipt_id)
      .map(n => n.receipt_id!);
    let linkedImages: Map<string, string> | undefined;
    if (receiptIds.length > 0) {
      try {
        linkedImages = await getLinkedReceiptImages(receiptIds);
      } catch (e) {
        console.error('Erro ao buscar imagens dos recibos:', e);
      }
    }
    generateSefazReportPDF(filteredNotes, categories, activeLocation, getPeriodLabel(), categorySummary, linkedImages);
  };

  const handleDownloadSinglePDF = async (note: SefazNote) => {
    let imageUrl: string | undefined;
    if (note.receipt_id) {
      try {
        const images = await getLinkedReceiptImages([note.receipt_id]);
        imageUrl = images.get(note.receipt_id);
      } catch (e) {
        console.error('Erro ao buscar imagem do recibo vinculado:', e);
      }
    }
    generateDanfePDF(note, imageUrl);
  };

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
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText size={16} className="text-brand-600 flex-shrink-0" />
          <h2 className="text-sm font-bold text-gray-800 truncate">SEFAZ {activeLocation}</h2>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{notes.length} notas</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canSwitchLocation && (
            <button
              onClick={switchLocation}
              className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 active:scale-95 transition-all"
              title={`Alternar para ${accessibleLocations.find(l => l !== activeLocation)}`}
            >
              <ArrowLeftRight size={18} />
            </button>
          )}
          <button
            onClick={handleDownloadReport}
            disabled={filteredNotes.length === 0}
            className={clsx(
              "p-2 rounded-lg transition-all",
              filteredNotes.length === 0
                ? "text-gray-300 cursor-not-allowed"
                : "text-brand-600 hover:bg-brand-50 active:scale-95"
            )}
            title="Baixar relatório PDF"
          >
            <Download size={18} />
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={clsx(
              "p-2 rounded-lg transition-all",
              syncing
                ? "text-gray-400 cursor-not-allowed"
                : "text-brand-600 hover:bg-brand-50 active:scale-95"
            )}
            title="Sincronizar com SEFAZ"
          >
            <RefreshCw size={18} className={clsx(syncing && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-700 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400"><X size={12} /></button>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
          <span className="text-xs text-green-700 flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-400"><X size={12} /></button>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {[
          { key: 'current_month' as PeriodOption, label: 'Este mês' },
          { key: 'last_month' as PeriodOption, label: 'Mês passado' },
          { key: 'custom' as PeriodOption, label: 'Período' },
          { key: 'all' as PeriodOption, label: 'Todos' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setPeriodFilter(opt.key)}
            className={clsx(
              "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors",
              periodFilter === opt.key
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            )}
          >
            {opt.label}
          </button>
        ))}
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
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar emitente, CNPJ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
        />
      </div>

      {filteredNotes.length > 0 && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">Categorias</span>
            <span className="text-xs font-bold text-brand-600">{formatCurrency(totalFiltered)}</span>
          </div>
          <div className="space-y-1">
            {categorySummary.map(item => (
              <div key={item.category.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.category.color }} />
                <span className="text-[11px] text-gray-600 flex-1 truncate">{item.category.name}</span>
                <span className="text-[10px] text-gray-400">{item.count}</span>
                <span className="text-[11px] font-semibold text-gray-700 min-w-[70px] text-right">{formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <RefreshCw size={20} className="animate-spin mb-2" />
          <span className="text-xs">Carregando...</span>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <FileText size={28} className="mb-2 opacity-40" />
          <span className="text-xs font-medium">Nenhuma nota encontrada</span>
          <span className="text-[10px] mt-1">Toque no ícone de sync para buscar</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotes.map((note, idx) => {
            const noteCat = getCategoryForNote(note);
            return (
              <div
                key={note.id || idx}
                onClick={() => setViewingXml(note)}
                className="bg-white rounded-lg border border-gray-100 px-3 py-2.5 space-y-1.5 active:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs text-gray-800 truncate">
                      {note.emitente_nome || 'Emitente não identificado'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {noteCat && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                        style={{ backgroundColor: noteCat.color + '18', color: noteCat.color }}
                      >
                        {noteCat.name}
                      </span>
                    )}
                    {getStatusBadge(note.status)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <div className="flex items-center gap-3">
                    <span>{formatDate(note.data_emissao)}</span>
                    {note.numero_nota && <span>Nº {note.numero_nota}</span>}
                    {note.receipt_id ? (
                      <CheckCircle size={10} className="text-green-500" />
                    ) : (
                      <AlertCircle size={10} className="text-amber-400" />
                    )}
                  </div>
                  {note.valor_total !== undefined && note.valor_total !== null && (
                    <span className="font-bold text-sm text-gray-800">{formatCurrency(note.valor_total)}</span>
                  )}
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
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => { handleDownloadSinglePDF(viewingXml); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
              >
                <Download size={14} /> Baixar PDF
              </button>
              <button
                onClick={() => setViewingXml(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
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
