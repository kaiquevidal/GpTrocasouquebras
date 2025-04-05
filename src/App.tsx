import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Navbar from './components/Navbar';
import LancamentoForm from './components/LancamentoForm';
import LancamentoFormValidado from './components/LancamentoFormValidado';
import HistoricoLancamentos from './components/HistoricoLancamentos';
import EditarLancamento from './components/EditarLancamento';
import { supabase } from './lib/supabaseClient';
import { useEffect, useState } from 'react';
import { AppUser } from './types/user';

// Componente para proteger rotas que exigem autenticação
function RequireAuth({ children }: { children: JSX.Element }) {
  const [checando, setChecando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  
  useEffect(() => {
    const verificarAutenticacao = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAutenticado(!!user);
      setChecando(false);
    };
    
    verificarAutenticacao();
    
    // Ouvir mudanças de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAutenticado(!!session?.user);
        setChecando(false);
      }
    );
    
    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);
  
  // Mostrar indicador de carregamento enquanto verifica
  if (checando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Redirecionar para login se não estiver autenticado
  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

// Componente para proteger rotas que exigem perfil de admin
function RequireAdmin({ children }: { children: JSX.Element }) {
  const [checando, setChecando] = useState(true);
  const [usuario, setUsuario] = useState<AppUser | null>(null);
  
  useEffect(() => {
    const verificarAdmin = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          setChecando(false);
          return;
        }
        
        const userData: AppUser = {
          id: user.id,
          email: user.email || '',
          nome: user.user_metadata?.nome || '',
          matricula: user.user_metadata?.matricula || '',
          perfil: user.user_metadata?.perfil || 'usuario'
        };
        
        setUsuario(userData);
        setChecando(false);
      } catch (error) {
        console.error('Erro ao verificar perfil de admin:', error);
        setChecando(false);
      }
    };
    
    verificarAdmin();
  }, []);
  
  // Mostrar indicador de carregamento enquanto verifica
  if (checando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Redirecionar para home se não for admin
  if (!usuario || usuario.perfil !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

// Rotas protegidas para usuários autenticados
const rotasProtegidas = [
  {
    path: '/',
    element: <Home />
  },
  {
    path: '/lancamento',
    element: <LancamentoForm />
  },
  {
    path: '/lancamento-validado',
    element: <LancamentoFormValidado />
  },
  {
    path: '/editar/:id',
    element: <EditarLancamento />
  },
  {
    path: '/historico',
    element: <HistoricoLancamentos />
  }
];

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          {/* Rotas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rotas protegidas por autenticação */}
          {rotasProtegidas.map((rota) => (
            <Route key={rota.path} path={rota.path} element={
              <RequireAuth>
                <>
                  <Navbar />
                  {rota.element}
                </>
              </RequireAuth>
            } />
          ))}
          
          {/* Rotas protegidas por perfil admin */}
          <Route path="/admin" element={
            <RequireAdmin>
              <>
                <Navbar />
                <Admin />
              </>
            </RequireAdmin>
          } />
          
          {/* Rota de fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
