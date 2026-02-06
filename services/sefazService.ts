import { supabase } from '../services/supabaseClient';
import { SefazNote, SefazSyncResult } from '../types';

export async function syncSefazNotes(ultNSU: string): Promise<SefazSyncResult> {
  const response = await fetch('/api/sefaz-monitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync', ultNSU }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.details || `Erro HTTP ${response.status}`);
  }

  return response.json();
}

export async function consultarChave(chave: string): Promise<SefazSyncResult> {
  const response = await fetch('/api/sefaz-monitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'consultaChave', chave }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.details || `Erro HTTP ${response.status}`);
  }

  return response.json();
}

export async function consultarNSU(nsu: string): Promise<SefazSyncResult> {
  const response = await fetch('/api/sefaz-monitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'consultaNSU', nsu }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.details || `Erro HTTP ${response.status}`);
  }

  return response.json();
}

export async function getSefazNotes(): Promise<SefazNote[]> {
  const { data, error } = await supabase
    .from('sefaz_notes')
    .select('*')
    .eq('location', 'Caratinga')
    .order('data_emissao', { ascending: false });

  if (error) throw error;
  return (data || []) as SefazNote[];
}

export async function saveSefazNote(note: Partial<SefazNote>): Promise<void> {
  const noteWithLocation = { ...note, location: 'Caratinga' };
  const { error } = await supabase
    .from('sefaz_notes')
    .upsert(noteWithLocation, { onConflict: 'chave_acesso' });

  if (error) throw error;
}

export async function getLastNSU(): Promise<string> {
  const { data, error } = await supabase
    .from('sefaz_sync_control')
    .select('ultimo_nsu')
    .eq('location', 'Caratinga')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return '000000000000000';
  return data.ultimo_nsu || '000000000000000';
}

export async function updateLastNSU(nsu: string): Promise<void> {
  const { data } = await supabase
    .from('sefaz_sync_control')
    .select('id')
    .eq('location', 'Caratinga')
    .limit(1)
    .single();

  if (data) {
    await supabase
      .from('sefaz_sync_control')
      .update({ ultimo_nsu: nsu, updated_at: new Date().toISOString() })
      .eq('id', data.id);
  } else {
    await supabase
      .from('sefaz_sync_control')
      .insert({ ultimo_nsu: nsu, location: 'Caratinga', updated_at: new Date().toISOString() });
  }
}
