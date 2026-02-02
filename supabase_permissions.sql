-- Execute este script no SQL Editor do Supabase para garantir que as funções de apagar funcionem

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar conflitos (opcional, mas recomendado se já houver tentativas anteriores)
DROP POLICY IF EXISTS "Enable all access for anon" ON public.receipts;
DROP POLICY IF EXISTS "Enable all access for anon" ON public.categories;

-- Criar políticas permissivas para a role 'anon' (público)
-- ATENÇÃO: Isso permite que qualquer pessoa com a chave API anon manipule os dados.
-- Ideal para demos/protótipos. Em produção, use autenticação.

CREATE POLICY "Enable all access for anon"
ON public.receipts
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for anon"
ON public.categories
FOR ALL
TO anon
USING (true)
WITH CHECK (true);