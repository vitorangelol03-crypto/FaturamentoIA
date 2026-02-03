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
  async register(fullName: string, username: string, passwordPlain: string): Promise<{ success?: boolean; error?: string }> {
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

      // Insere como 'pending' por padrão (definido no banco ou explícito aqui)
      const { error } = await supabase
        .from('users')
        .insert({
          full_name: fullName,
          username: username,
          password: passwordHash,
          status: 'pending',
          role: 'user'
        });

      if (error) throw error;
      
      return { success: true };
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
        .select('id, full_name, username, role, status')
        .eq('username', username)
        .eq('password', passwordHash)
        .single();

      if (error || !data) {
        return { error: 'Login ou senha incorretos.' };
      }

      if (data.status !== 'active') {
          return { error: 'Sua conta ainda está em análise pelo administrador.' };
      }

      // Cast para o tipo User compatível
      const user: User = {
          id: data.id,
          full_name: data.full_name,
          username: data.username,
          role: data.role as 'admin' | 'user',
          status: data.status as 'active' | 'pending' | 'rejected'
      };

      return { user };
    } catch (e: any) {
      return { error: 'Erro de conexão ou credenciais inválidas.' };
    }
  },

  // --- ADMIN FUNCTIONS ---

  async getPendingUsers(): Promise<User[]> {
      const { data, error } = await supabase
          .from('users')
          .select('id, full_name, username, status, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as User[];
  },

  async approveUser(userId: string): Promise<void> {
      const { error } = await supabase
          .from('users')
          .update({ status: 'active' })
          .eq('id', userId);
      if (error) throw error;
  },

  async rejectUser(userId: string): Promise<void> {
      // Opção A: Apenas marcar como rejected
      // const { error } = await supabase.from('users').update({ status: 'rejected' }).eq('id', userId);
      
      // Opção B: Deletar o registro para liberar o username
      const { error } = await supabase.from('users').delete().eq('id', userId);
      
      if (error) throw error;
  }
};