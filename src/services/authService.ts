import { supabase } from '../lib/supabaseClient';
import { AppUser, UserProfile } from '../types/user';

interface SignUpData {
  email: string;
  password: string;
  nome: string;
  matricula: string;
}

interface SignInData {
  email: string;
  password: string;
}

/**
 * Registra um novo usuário e salva nome e matrícula como metadata
 */
export const signUp = async ({ email, password, nome, matricula }: SignUpData) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome,
          matricula,
          perfil: 'usuario' as UserProfile // Por padrão, novos usuários são criados como 'usuario'
        }
      }
    });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return { data: null, error };
  }
};

/**
 * Autentica um usuário existente
 */
export const signIn = async ({ email, password }: SignInData) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro ao autenticar usuário:', error);
    return { data: null, error };
  }
};

/**
 * Desconecta o usuário atual
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    return { error: null };
  } catch (error) {
    console.error('Erro ao desconectar usuário:', error);
    return { error };
  }
};

/**
 * Converte os dados do usuário do Supabase para o formato AppUser
 */
export const getUserProfile = async (): Promise<AppUser | null> => {
  const { data, error } = await supabase.auth.getUser();
  
  if (error || !data.user) {
    return null;
  }
  
  const metadata = data.user.user_metadata;
  
  return {
    id: data.user.id,
    email: data.user.email || '',
    nome: metadata?.nome || '',
    matricula: metadata?.matricula || '',
    perfil: metadata?.perfil || 'usuario'
  };
}; 