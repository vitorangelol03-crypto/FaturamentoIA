// In a production app, these should be environment variables.
// Per request, they are included in the code.

export const SUPABASE_URL = "https://cgyozwznlqakopbhejub.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneW96d3pubHFha29wYmhlanViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDA4MjksImV4cCI6MjA4NTYxNjgyOX0.uxJGbuj1O7c9ZieckjkeQKhrXrD9B3QQwnyWfP1mlis";

// CNPJ Obrigatório para validação das notas (Apenas números)
export const REQUIRED_CNPJ = "11802464000138";

export const SEFAZ_CONFIG = {
  CNPJ: '11802464000138',
  UF_CODE: '31',
  AMBIENTE: '1',
};

export const DEFAULT_CATEGORIES = [
  { id: '1', name: 'Alimentação', color: '#EF4444' },
  { id: '2', name: 'Transporte', color: '#3B82F6' },
  { id: '3', name: 'Saúde', color: '#10B981' },
  { id: '4', name: 'Moradia', color: '#F59E0B' },
  { id: '5', name: 'Lazer', color: '#8B5CF6' },
  { id: '6', name: 'Educação', color: '#EC4899' },
  { id: '7', name: 'Vestuário', color: '#6366F1' },
  { id: '8', name: 'Outros', color: '#6B7280' },
];