import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { AppUser } from '../types/user';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState<AppUser | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  
  // Verificar autenticação ao montar o componente
  useEffect(() => {
    const verificarUsuario = async () => {
      try {
        setCarregando(true);
        
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        if (!user) {
          setUsuario(null);
          setCarregando(false);
          return;
        }
        
        // Extrair metadados do usuário
        const userData: AppUser = {
          id: user.id,
          email: user.email || '',
          nome: user.user_metadata?.nome || '',
          matricula: user.user_metadata?.matricula || '',
          perfil: user.user_metadata?.perfil || 'usuario'
        };
        
        setUsuario(userData);
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        setUsuario(null);
      } finally {
        setCarregando(false);
      }
    };
    
    verificarUsuario();
    
    // Ouvir mudanças de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Extrair metadados do usuário
          const userData: AppUser = {
            id: session.user.id,
            email: session.user.email || '',
            nome: session.user.user_metadata?.nome || '',
            matricula: session.user.user_metadata?.matricula || '',
            perfil: session.user.user_metadata?.perfil || 'usuario'
          };
          
          setUsuario(userData);
        } else if (event === 'SIGNED_OUT') {
          setUsuario(null);
        }
      }
    );
    
    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);
  
  // Fazer logout
  const fazerLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };
  
  // Verificar se o link está ativo
  const isLinkAtivo = (path: string) => {
    return location.pathname === path;
  };
  
  // Função que determina o estilo dos links no menu
  const navLinkClasses = (path: string) => {
    return isLinkAtivo(path)
      ? 'px-3 py-2 rounded-md text-sm font-medium text-blue-700 bg-blue-50'
      : 'px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50';
  };
  
  // Classe para links do menu móvel
  const classeLinkMenuMobile = (path: string) => {
    return `block px-3 py-2 rounded-md text-base font-medium ${isLinkAtivo(path)
      ? 'bg-blue-700 text-white'
      : 'text-gray-300 hover:bg-blue-600 hover:text-white'
    }`;
  };
  
  // Alternar menu móvel
  const alternarMenu = () => {
    setMenuAberto(!menuAberto);
  };

  // Função para fechar o menu após clicar em um link
  const fecharMenu = () => {
    setMenuAberto(false);
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e título à esquerda */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center">
              <img 
                className="block h-8 w-auto mr-2" 
                src="/logo.png" 
                alt="Logo"
                onError={(e) => e.currentTarget.style.display = 'none'} 
              />
              <span className="text-gray-900 font-medium text-lg">
                Sistema de Quebras
              </span>
            </Link>
          </div>

          {/* Links de navegação em desktop */}
          <div className="hidden md:ml-6 md:flex md:items-center">
            {usuario && (
              <>
                <Link
                  to="/"
                  className={navLinkClasses('/')}
                >
                  Início
                </Link>
                <Link
                  to="/lancamento"
                  className={navLinkClasses('/lancamento')}
                >
                  Novo Lançamento
                </Link>
                <Link
                  to="/historico"
                  className={navLinkClasses('/historico')}
                >
                  Histórico
                </Link>
                {usuario.perfil === 'admin' && (
                  <Link
                    to="/admin"
                    className={navLinkClasses('/admin')}
                  >
                    Admin
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Avatar e menu do usuário em desktop */}
          <div className="hidden md:flex items-center">
            {usuario ? (
              <div className="ml-3 relative group">
                <div className="flex items-center">
                  <button 
                    className="p-1 rounded-full text-gray-600 hover:text-gray-900 focus:outline-none"
                    aria-label="Perfil do usuário"
                  >
                    <div className="flex items-center">
                      <div className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-semibold">
                        {usuario.nome.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="ml-2 text-sm text-gray-700">{usuario.nome}</span>
                      <svg className="ml-1 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {/* Menu dropdown */}
                  <div className="hidden group-hover:block absolute right-0 mt-16 w-48 bg-white py-1 rounded-md shadow-lg z-20">
                    <div className="block px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                      <p className="font-medium">{usuario.nome}</p>
                      <p className="text-xs text-gray-500">{usuario.email}</p>
                      <p className="text-xs text-gray-500">
                        {usuario.perfil === 'admin' ? 'Administrador' : 'Usuário'}
                      </p>
                    </div>
                    <button
                      onClick={fazerLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex space-x-2">
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Cadastre-se
                </Link>
              </div>
            )}
          </div>

          {/* Botão do menu para mobile */}
          <div className="md:hidden flex items-center">
            {usuario && (
              <button
                onClick={alternarMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
                aria-expanded="false"
              >
                <span className="sr-only">Abrir menu</span>
                {menuAberto ? (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      <div className={`md:hidden ${menuAberto ? 'block' : 'hidden'}`}>
        <div className="pt-2 pb-3 space-y-1 border-t border-gray-200">
          {usuario ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="bg-blue-600 text-white rounded-full h-10 w-10 flex items-center justify-center font-semibold">
                    {usuario.nome.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">{usuario.nome}</div>
                    <div className="text-sm text-gray-500">{usuario.email}</div>
                  </div>
                </div>
              </div>
              <Link
                to="/"
                onClick={fecharMenu}
                className={`block px-4 py-2 text-base font-medium ${
                  isLinkAtivo('/') ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Início
              </Link>
              <Link
                to="/lancamento"
                onClick={fecharMenu}
                className={`block px-4 py-2 text-base font-medium ${
                  isLinkAtivo('/lancamento') ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Novo Lançamento
              </Link>
              <Link
                to="/historico"
                onClick={fecharMenu}
                className={`block px-4 py-2 text-base font-medium ${
                  isLinkAtivo('/historico') ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Histórico
              </Link>
              {usuario.perfil === 'admin' && (
                <Link
                  to="/admin"
                  onClick={fecharMenu}
                  className={`block px-4 py-2 text-base font-medium ${
                    isLinkAtivo('/admin') ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Painel Admin
                </Link>
              )}
              <button
                onClick={() => {
                  fecharMenu();
                  fazerLogout();
                }}
                className="w-full text-left px-4 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={fecharMenu}
                className="block px-4 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={fecharMenu}
                className="block px-4 py-2 text-base font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              >
                Cadastre-se
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
} 