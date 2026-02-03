import { supabase } from './supabaseClient';
import { User } from '../types';

// Utilitário simples de Hash SHA-256 para não enviar senha plana
export async function hashPassword(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const authService = {
  async register(fullName: string, username: string, passwordPlain: string): Promise<{ user?: User; error?: string }> {
    try {
      // Verificar se usuário já existe
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existing) {
        return { error: 'Este login já está em uso.' };
      }

      const passwordHash = await hashPassword(passwordPlain);

      const { data, error } = await supabase
        .from('users')
        .insert({
          full_name: fullName,
          username: username,
          password: passwordHash
        })
        .select('id, full_name, username')
        .single();

      if (error) throw error;
      return { user: data };
    } catch (e: any) {
      console.error(e);
      return { error: e.message || 'Erro ao criar conta.' };
    }
  },

  async login(username: string, passwordPlain: string): Promise<{ user?: User; error?: string }> {
    try {
      const passwordHash = await hashPassword(passwordPlain);

      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, username')
        .eq('username', username)
        .eq('password', passwordHash)
        .single();

      if (error || !data) {
        return { error: 'Login ou senha incorretos.' };
      }

      return { user: data };
    } catch (e: any) {
      return { error: 'Erro de conexão ou credenciais inválidas.' };
    }
  }
};