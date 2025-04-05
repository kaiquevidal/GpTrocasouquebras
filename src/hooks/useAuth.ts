// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getUserProfile, signOut } from '../services/authService';
import { AppUser } from '../types/user';

/**
 * Hook para gerenciar autenticação do usuário
 * 
 * @param redirectTo Rota para redirecionamento caso não tenha sessão ativa
 * @returns Objeto com usuário atual, função de logout e estado de carregamento
 */
export function useAuth(redirectTo = '/login') {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Função para realizar logout
  const logout = async () => {
    const { error } = await signOut();
    if (!error) {
      setUser(null);
      navigate(redirectTo);
    }
    return { error };
  };

  // Carrega o usuário atual na montagem do componente
  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true);
        
        // Verifica se o usuário tem sessão ativa
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData?.session) {
          // Sem sessão: redirecionar para login
          setUser(null);
          navigate(redirectTo);
          return;
        }
        
        // Obter perfil completo do usuário a partir dos metadados
        const userProfile = await getUserProfile();
        setUser(userProfile);
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setUser(null);
        navigate(redirectTo);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
    
    // Inscrever-se em mudanças de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        const userProfile = await getUserProfile();
        setUser(userProfile);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        navigate(redirectTo);
      }
    });

    // Limpar listener ao desmontar
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [navigate, redirectTo]);

  return { user, loading, logout };
} 