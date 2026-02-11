import { supabase } from '../services/supabaseClient';
import { SefazNote, SefazSyncResult } from '../types';

class SefazApiError extends Error {
  errorCode: string;
  constructor(message: string, errorCode: string = 'unknown') {
    super(message);
    this.errorCode = errorCode;
    this.name = 'SefazApiError';
  }
}

async function handleSefazResponse(response: Response): Promise<any> {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new SefazApiError(
      err.error || err.details || `Erro HTTP ${response.status}`,
      err.errorCode || 'unknown'
    );
  }
  return response.json();
}

export { SefazApiError };

export async function syncSefazNotes(ultNSU: string, location: string = 'Caratinga'): Promise<SefazSyncResult> {
  const response = await fetch('/api/sefaz-monitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync', ultNSU, location }),
  });

  return handleSefazResponse(response);
}

export async function consultarChave(chave: string, location: string = 'Caratinga'): Promise<SefazSyncResult> {
  const response = await fetch('/api/sefaz-monitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'consultaChave', chave, location }),
  });

  return handleSefazResponse(response);
}

export async function consultarNSU(nsu: string, location: string = 'Caratinga'): Promise<SefazSyncResult> {
  const response = await fetch('/api/sefaz-monitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'consultaNSU', nsu, location }),
  });

  return handleSefazResponse(response);
}

export async function getSefazNotes(location: string = 'Caratinga'): Promise<SefazNote[]> {
  const { data, error } = await supabase
    .from('sefaz_notes')
    .select('*')
    .eq('location', location)
    .order('data_emissao', { ascending: false });

  if (error) throw error;
  return (data || []) as SefazNote[];
}

export async function saveSefazNote(note: Partial<SefazNote>, location: string = 'Caratinga'): Promise<void> {
  const noteWithLocation = { ...note, location };
  const { error } = await supabase
    .from('sefaz_notes')
    .upsert(noteWithLocation, { onConflict: 'chave_acesso' });

  if (error) throw error;
}

export async function getLastNSU(location: string = 'Caratinga'): Promise<string> {
  const { data, error } = await supabase
    .from('sefaz_sync_control')
    .select('ultimo_nsu')
    .eq('location', location)
    .limit(1)
    .single();

  if (error || !data) return '000000000000000';
  return data.ultimo_nsu || '000000000000000';
}

export async function updateLastNSU(nsu: string, location: string = 'Caratinga'): Promise<void> {
  const { data } = await supabase
    .from('sefaz_sync_control')
    .select('id')
    .eq('location', location)
    .limit(1)
    .single();

  if (data) {
    await supabase
      .from('sefaz_sync_control')
      .update({ ultimo_nsu: nsu })
      .eq('id', data.id);
  } else {
    await supabase
      .from('sefaz_sync_control')
      .insert({ ultimo_nsu: nsu, location });
  }
}

export async function linkReceiptsToSefazNotes(location: string = 'Caratinga'): Promise<{ linked: number }> {
  const { data: unlinkedNotes, error: notesError } = await supabase
    .from('sefaz_notes')
    .select('id, chave_acesso, receipt_id')
    .eq('location', location)
    .is('receipt_id', null);

  const { data: receipts, error: receiptsError } = await supabase
    .from('receipts')
    .select('id, access_key')
    .eq('location', location)
    .not('access_key', 'is', null)
    .neq('access_key', '');

  if (receiptsError || !receipts) return { linked: 0 };

  const receiptMap = new Map<string, string>();
  for (const r of receipts) {
    if (r.access_key) {
      receiptMap.set(r.access_key.replace(/\D/g, ''), r.id);
    }
  }

  let linkedCount = 0;

  if (unlinkedNotes && unlinkedNotes.length > 0) {
    for (const note of unlinkedNotes) {
      const cleanChave = note.chave_acesso?.replace(/\D/g, '') || '';
      const matchedReceiptId = receiptMap.get(cleanChave);
      if (matchedReceiptId) {
        const { error } = await supabase
          .from('sefaz_notes')
          .update({ receipt_id: matchedReceiptId })
          .eq('id', note.id);
        if (!error) linkedCount++;
      }
    }
  }

  const { data: linkedNotes } = await supabase
    .from('sefaz_notes')
    .select('id, receipt_id')
    .eq('location', location)
    .not('receipt_id', 'is', null);

  if (linkedNotes && linkedNotes.length > 0) {
    const linkedReceiptIds = [...new Set(linkedNotes.map(n => n.receipt_id).filter(Boolean))];
    const { data: existingReceipts } = await supabase
      .from('receipts')
      .select('id')
      .in('id', linkedReceiptIds);

    const existingIds = new Set((existingReceipts || []).map(r => r.id));

    for (const note of linkedNotes) {
      if (note.receipt_id && !existingIds.has(note.receipt_id)) {
        await supabase
          .from('sefaz_notes')
          .update({ receipt_id: null })
          .eq('id', note.id);
      }
    }
  }

  return { linked: linkedCount };
}

export async function getLinkedReceiptImages(receiptIds: string[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  if (!receiptIds.length) return imageMap;

  const { data, error } = await supabase
    .from('receipts')
    .select('id, image_url')
    .in('id', receiptIds)
    .not('image_url', 'is', null);

  if (!error && data) {
    for (const r of data) {
      if (r.image_url) {
        imageMap.set(r.id, r.image_url);
      }
    }
  }
  return imageMap;
}

export async function linkSingleReceipt(accessKey: string, receiptId: string, location: string): Promise<boolean> {
  if (!accessKey) return false;
  const cleanKey = accessKey.replace(/\D/g, '');

  const { data, error } = await supabase
    .from('sefaz_notes')
    .update({ receipt_id: receiptId })
    .eq('chave_acesso', cleanKey)
    .eq('location', location);

  return !error;
}
