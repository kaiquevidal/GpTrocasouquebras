// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { AppUser } from '../types/user';

export default function Home() {
  const [usuario, setUsuario] = useState<AppUser | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [lancamentosPendentes, setLancamentosPendentes] = useState<number>(0);
  
  // Buscar informações do usuário e estatísticas ao montar o componente
  useEffect(() => {
    const buscarDados = async () => {
      try {
        setCarregando(true);
        
        // 1. Buscar usuário atual
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) throw authError;
        if (!user) return;
        
        // Extrair metadados do usuário
        const userData: AppUser = {
          id: user.id,
          email: user.email || '',
          nome: user.user_metadata?.nome || '',
          matricula: user.user_metadata?.matricula || '',
          perfil: user.user_metadata?.perfil || 'usuario'
        };
        
        setUsuario(userData);
        
        // 2. Buscar estatísticas (depende do perfil do usuário)
        if (userData.perfil === 'admin') {
          // Admin: quantidade de lançamentos pendentes
          const { count, error: countError } = await supabase
            .from('lancamentos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pendente');
          
          if (!countError) {
            setLancamentosPendentes(count || 0);
          }
        } else {
          // Usuário comum: seus próprios lançamentos pendentes
          const { count, error: countError } = await supabase
            .from('lancamentos')
            .select('*', { count: 'exact', head: true })
            .eq('usuario_id', user.id)
            .eq('status', 'pendente');
          
          if (!countError) {
            setLancamentosPendentes(count || 0);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setCarregando(false);
      }
    };
    
    buscarDados();
  }, []);
  
  // Se estiver carregando, mostrar spinner
  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Bem-vindo, {usuario?.nome || 'Usuário'}!
          </h1>
          <p className="text-gray-600 mb-6">
            Sistema de Gestão de Quebras e Trocas de Produtos
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card para novo lançamento */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-blue-800 mb-3">
                Registrar Nova Quebra/Troca
              </h2>
              <p className="text-gray-600 mb-4">
                Registre quebras ou trocas de produtos com fotos e motivos.
              </p>
              <div className="mt-2 flex space-x-4">
                <Link
                  to="/lancamento"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Formulário Simples
                </Link>
                <Link
                  to="/lancamento-validado"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Formulário Validado
                </Link>
              </div>
            </div>
            
            {/* Card para histórico */}
            <div className="bg-green-50 border border-green-100 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-800 mb-3">
                Ver Histórico de Lançamentos
              </h2>
              <p className="text-gray-600 mb-4">
                Consulte seus lançamentos anteriores e o status de aprovação.
              </p>
              <Link
                to="/historico"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
              >
                Ver Histórico
              </Link>
            </div>
            
            {/* Card para lançamentos pendentes (somente para admin) */}
            {usuario?.perfil === 'admin' && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-6 md:col-span-2">
                <h2 className="text-xl font-semibold text-yellow-800 mb-3">
                  Aprovar Lançamentos
                </h2>
                <p className="text-gray-600 mb-4">
                  Você tem {lancamentosPendentes} lançamento(s) pendente(s) para aprovação.
                </p>
                <Link
                  to="/admin"
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition"
                >
                  Painel de Administração
                </Link>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Como usar o sistema
          </h2>
          
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-gray-900">1. Registre quebras e trocas</h3>
              <p className="text-gray-600">
                Utilize o formulário para registrar produtos quebrados ou trocados, incluindo 
                quantidade, motivo e fotos.
              </p>
            </div>
            
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-gray-900">2. Visualize o histórico</h3>
              <p className="text-gray-600">
                Acompanhe todos os seus lançamentos e veja o status de aprovação de cada um.
              </p>
            </div>
            
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-gray-900">3. Aguarde aprovação</h3>
              <p className="text-gray-600">
                Seus lançamentos serão analisados pela administração e poderão ser aprovados ou rejeitados.
              </p>
            </div>
            
            {usuario?.perfil === 'admin' && (
              <div className="border-l-4 border-yellow-500 pl-4">
                <h3 className="font-medium text-gray-900">4. Aprovação (Administradores)</h3>
                <p className="text-gray-600">
                  Como administrador, você pode aprovar ou rejeitar lançamentos e visualizar estatísticas.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 