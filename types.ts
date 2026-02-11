export interface User {
  id: string;
  full_name: string;
  username: string;
  role?: 'admin' | 'user';
  status?: 'pending' | 'active' | 'rejected';
  location?: 'Caratinga' | 'Ponte Nova';
  sefaz_access?: string[];
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  is_default?: boolean;
  user_id?: string;
}

export interface Receipt {
  id: string;
  establishment: string;
  date: string;
  total_amount: number;
  category_id: string;
  receipt_number?: string;
  cnpj?: string;
  location?: string; // 'Caratinga' | 'Ponte Nova'
  payment_method?: string;
  items: ReceiptItem[];
  image_url?: string; 
  user_id?: string;
  created_at: string;
  source?: 'internal' | 'external'; // internal = App Upload, external = SEFAZ Import
  access_key?: string; // Chave de acesso da NFe (44 dígitos)
}

export type ViewMode = 'list' | 'grid' | 'compact';

export type PeriodFilter = 'current_month' | 'last_month' | 'last_3_months' | 'year' | 'custom';

export interface FilterState {
  period: PeriodFilter;
  customStartDate?: string;
  customEndDate?: string;
  categories: string[];
  searchQuery: string;
}

export interface SefazNote {
  id?: string;
  chave_acesso: string;
  numero_nota?: string;
  serie?: string;
  data_emissao?: string;
  emitente_nome?: string;
  emitente_cnpj?: string;
  destinatario_cnpj?: string;
  valor_total?: number;
  xml_completo?: string;
  status?: string;
  nsu?: string;
  location?: string;
  created_at?: string;
  updated_at?: string;
  receipt_id?: string;
  category_id?: string;
}

export interface SefazSyncResult {
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  documents: SefazDocZip[];
}

export interface SefazDocZip {
  xml: string;
  json: any;
  nsu: string;
  schema: string;
}