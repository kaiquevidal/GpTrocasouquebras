// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { supabase } from '../lib/supabaseClient';
import { AppUser } from '../types/user';

// Interface para usuário de lançamento
interface UsuarioLancamento {
  id: string;
  nome: string;
  email: string;
  matricula: string;
}

// Interface para o item de lançamento
interface Item {
  id: string;
  lancamento_id: string;
  produto: {
    id: string;
    nome: string;
    codigo: string;
  };
  quantidade: number;
  motivo: string;
  fotos: string[]; // URLs das fotos
}

// Interface para o lançamento
interface Lancamento {
  id: string;
  usuario_id: string;
  data_hora: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  observacoes: string;
  itens?: Item[];
  usuario?: UsuarioLancamento;
}

/**
 * Componente de painel de administração para aprovação de lançamentos
 */
export default function Admin() {
  const navigate = useNavigate();
  
  // Estados para os lançamentos pendentes
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  
  // Estado para o lançamento em aprovação
  const [lancamentoEmAprovacao, setLancamentoEmAprovacao] = useState<string | null>(null);
  const [observacaoAprovacao, setObservacaoAprovacao] = useState('');
  
  // Estados para feedback ao usuário
  const [loading, setLoading] = useState(true);
  const [loadingAcao, setLoadingAcao] = useState<{[key: string]: boolean}>({});
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  
  // Estado para o usuário autenticado
  const [usuario, setUsuario] = useState<AppUser | null>(null);
  
  // Armazenar usuários em cache para evitar buscas duplicadas
  const [usuariosCache, setUsuariosCache] = useState<{[key: string]: UsuarioLancamento}>({});
  
  // Estado para filtro de período
  const [filtro, setFiltro] = useState({
    dataInicial: '',
    dataFinal: '',
    aplicado: false
  });

  // Verificar autenticação e buscar lançamentos pendentes
  useEffect(() => {
    const verificarAdmin = async () => {
      try {
        setLoading(true);
        setErro(null);
        
        // 1. Verificar autenticação
        const { data: authData, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          throw new Error('Erro ao verificar autenticação');
        }
        
        if (!authData?.user) {
          navigate('/login');
          return;
        }
        
        // 2. Obter metadados do usuário
        const userData: AppUser = {
          id: authData.user.id,
          email: authData.user.email || '',
          nome: authData.user.user_metadata?.nome || '',
          matricula: authData.user.user_metadata?.matricula || '',
          perfil: authData.user.user_metadata?.perfil || 'usuario'
        };
        
        setUsuario(userData);
        
        // 3. Verificar se o usuário é admin
        if (userData.perfil !== 'admin') {
          setErro('Acesso negado. Você não tem permissão para acessar esta página.');
          setTimeout(() => {
            navigate('/');
          }, 3000);
          return;
        }
        
        // 4. Buscar lançamentos pendentes
        await buscarLancamentosPendentes();
        
      } catch (error) {
        console.error('Erro:', error);
        setErro('Ocorreu um erro ao carregar o painel de administração. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };
    
    verificarAdmin();
  }, [navigate]);
  
  /**
   * Busca lançamentos com status "pendente" e filtros opcionais
   */
  const buscarLancamentosPendentes = async (comFiltros = false) => {
    try {
      setLoading(true);
      
      // Iniciar a query
      let query = supabase
        .from('lancamentos')
        .select(`
          id,
          usuario_id,
          data_hora,
          status,
          observacoes
        `)
        .eq('status', 'pendente')
        .order('data_hora', { ascending: false });
      
      // Aplicar filtros de data se fornecidos
      if (comFiltros && filtro.dataInicial && filtro.dataFinal) {
        // Ajustar dataFinal para incluir o fim do dia
        const dataFinalAjustada = new Date(filtro.dataFinal);
        dataFinalAjustada.setHours(23, 59, 59, 999);
        
        query = query
          .gte('data_hora', new Date(filtro.dataInicial).toISOString())
          .lte('data_hora', dataFinalAjustada.toISOString());
      }
      
      // Executar a query
      const { data: lancamentosData, error: lancamentosError } = await query;
      
      if (lancamentosError) {
        throw lancamentosError;
      }
      
      // Preparar cache de usuários já conhecidos
      const usuariosIds = lancamentosData?.map(l => l.usuario_id) || [];
      const usuariosUnicos = [...new Set(usuariosIds)];
      const usuariosCacheTmp = { ...usuariosCache };
      
      // Buscar informações dos usuários que ainda não estão em cache
      const usuariosParaBuscar = usuariosUnicos.filter(id => !usuariosCacheTmp[id]);
      
      if (usuariosParaBuscar.length > 0) {
        for (const userId of usuariosParaBuscar) {
          try {
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
            
            if (!userError && userData?.user) {
              const metadata = userData.user.user_metadata || {};
              
              usuariosCacheTmp[userId] = {
                id: userId,
                nome: metadata.nome || 'Usuário Desconhecido',
                email: userData.user.email || '',
                matricula: metadata.matricula || ''
              };
            }
          } catch (error) {
            console.error(`Erro ao buscar usuário ${userId}:`, error);
            // Criar um usuário placeholder para não tentar buscar novamente
            usuariosCacheTmp[userId] = {
              id: userId,
              nome: 'Usuário Desconhecido',
              email: '',
              matricula: ''
            };
          }
        }
        
        // Atualizar cache de usuários
        setUsuariosCache(usuariosCacheTmp);
      }
      
      // Associar usuários aos lançamentos
      const lancamentosComUsuarios = lancamentosData?.map(lancamento => ({
        ...lancamento,
        usuario: usuariosCacheTmp[lancamento.usuario_id] || null
      })) || [];
      
      setLancamentos(lancamentosComUsuarios);
      
      // Atualizar estado do filtro
      if (comFiltros) {
        setFiltro(prev => ({ ...prev, aplicado: true }));
      }
    } catch (error) {
      console.error('Erro ao buscar lançamentos pendentes:', error);
      setErro('Erro ao buscar lançamentos pendentes. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Aplica filtros de data na busca de lançamentos
   */
  const aplicarFiltros = async () => {
    if (!filtro.dataInicial || !filtro.dataFinal) {
      setErro('Por favor, preencha ambas as datas para filtrar');
      return;
    }
    
    // Validar datas
    const dataInicial = new Date(filtro.dataInicial);
    const dataFinal = new Date(filtro.dataFinal);
    
    if (dataFinal < dataInicial) {
      setErro('A data final não pode ser anterior à data inicial');
      return;
    }
    
    await buscarLancamentosPendentes(true);
  };
  
  /**
   * Limpa os filtros aplicados
   */
  const limparFiltros = async () => {
    setFiltro({
      dataInicial: '',
      dataFinal: '',
      aplicado: false
    });
    
    await buscarLancamentosPendentes(false);
  };
  
  /**
   * Exporta todos os lançamentos visíveis para CSV
   */
  const exportarTodosParaCSV = async () => {
    try {
      setLoading(true);
      
      if (lancamentos.length === 0) {
        throw new Error('Não há lançamentos para exportar');
      }
      
      // Verificar se precisamos carregar detalhes para todos os lançamentos
      const lancamentosSemDetalhes = lancamentos.filter(l => !l.itens);
      if (lancamentosSemDetalhes.length > 0) {
        // Se houver muitos lançamentos sem detalhes, informar ao usuário
        if (lancamentosSemDetalhes.length > 5) {
          setMensagem('Carregando detalhes dos lançamentos. Isso pode levar alguns instantes...');
        }
        
        // Carregar detalhes para todos os lançamentos
        for (const lancamento of lancamentosSemDetalhes) {
          await expandirLancamento(lancamento.id);
        }
      }
      
      // Verificar novamente se todos os lançamentos têm itens
      const temTodosDetalhes = lancamentos.every(l => l.itens);
      if (!temTodosDetalhes) {
        throw new Error('Não foi possível carregar todos os detalhes. Tente novamente.');
      }
      
      // Preparar dados para CSV
      const dadosCSV = [
        // Cabeçalho
        [
          'ID do Lançamento',
          'Observações',
          'Data/Hora',
          'Status',
          'Usuário',
          'Matrícula',
          'Código do Produto', 
          'Nome do Produto',
          'Quantidade', 
          'Motivo',
          'Fotos (Quantidade)'
        ]
      ];
      
      // Adicionar linhas de dados
      lancamentos.forEach(lancamento => {
        if (!lancamento.itens?.length) return;
        
        lancamento.itens.forEach(item => {
          dadosCSV.push([
            lancamento.id,
            lancamento.observacoes,
            format(new Date(lancamento.data_hora), "dd/MM/yyyy HH:mm"),
            'Pendente',
            lancamento.usuario?.nome || 'Desconhecido',
            lancamento.usuario?.matricula || 'Desconhecido',
            item.produto.codigo,
            item.produto.nome,
            item.quantidade.toString(),
            item.motivo,
            (item.fotos?.length || 0).toString()
          ]);
        });
      });
      
      // Converter dados para string CSV
      const csvContent = dadosCSV.map(row => 
        row.map(cell => 
          // Escapar células que contêm vírgulas, aspas ou quebras de linha
          /[,"\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
        ).join(',')
      ).join('\n');
      
      // Criar blob e link para download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Nome do arquivo baseado no filtro, se aplicado
      let filename = `lancamentos_pendentes_`;
      if (filtro.aplicado) {
        const dataInicialFormatada = format(new Date(filtro.dataInicial), "ddMMyyyy");
        const dataFinalFormatada = format(new Date(filtro.dataFinal), "ddMMyyyy");
        filename += `${dataInicialFormatada}_a_${dataFinalFormatada}`;
      } else {
        filename += `completo`;
      }
      filename += `_${format(new Date(), 'ddMMyyyy_HHmm')}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setMensagem('Lançamentos exportados com sucesso!');
      setTimeout(() => {
        setMensagem(null);
      }, 3000);
      
    } catch (error) {
      console.error('Erro ao exportar lançamentos:', error);
      setErro(`Erro ao exportar lançamentos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Carrega os itens de um lançamento específico
   */
  const expandirLancamento = async (lancamentoId: string) => {
    // Se já está expandido, colapsar
    if (lancamentoId === lancamentoEmAprovacao) {
      setLancamentoEmAprovacao(null);
      setObservacaoAprovacao('');
      return;
    }
    
    try {
      setLancamentoEmAprovacao(lancamentoId);
      setObservacaoAprovacao('');
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: true }));
      
      // Buscar os itens relacionados ao lançamento
      const { data: itensData, error: itensError } = await supabase
        .from('itens')
        .select(`
          id,
          lancamento_id,
          quantidade,
          motivo,
          fotos,
          produto:produtos (
            id,
            nome,
            codigo
          )
        `)
        .eq('lancamento_id', lancamentoId);
      
      if (itensError) {
        throw itensError;
      }
      
      // Atualizar o lançamento com seus itens
      setLancamentos(prevLancamentos => 
        prevLancamentos.map(lanc => 
          lanc.id === lancamentoId 
            ? { ...lanc, itens: itensData || [] } 
            : lanc
        )
      );
      
    } catch (error) {
      console.error('Erro ao carregar detalhes do lançamento:', error);
      setErro('Erro ao carregar detalhes do lançamento');
    } finally {
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: false }));
    }
  };
  
  /**
   * Atualiza o status de um lançamento (aprovar/rejeitar)
   */
  const atualizarStatusLancamento = async (lancamentoId: string, novoStatus: 'aprovado' | 'rejeitado') => {
    try {
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: true }));
      setErro(null);
      
      // Atualizar o status do lançamento
      const { error } = await supabase
        .from('lancamentos')
        .update({ 
          status: novoStatus,
          observacoes_admin: observacaoAprovacao || undefined
        })
        .eq('id', lancamentoId);
      
      if (error) {
        throw error;
      }
      
      // Atualizar a lista local
      setLancamentos(prevLancamentos => 
        prevLancamentos.filter(lanc => lanc.id !== lancamentoId)
      );
      
      // Limpar lançamento em aprovação
      setLancamentoEmAprovacao(null);
      setObservacaoAprovacao('');
      
      // Mostrar mensagem de sucesso
      setMensagem(`Lançamento ${novoStatus === 'aprovado' ? 'aprovado' : 'rejeitado'} com sucesso.`);
      
      // Limpar mensagem após alguns segundos
      setTimeout(() => {
        setMensagem(null);
      }, 3000);
      
    } catch (error) {
      console.error(`Erro ao ${novoStatus === 'aprovado' ? 'aprovar' : 'rejeitar'} lançamento:`, error);
      setErro(`Erro ao ${novoStatus === 'aprovado' ? 'aprovar' : 'rejeitar'} lançamento. Tente novamente.`);
    } finally {
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: false }));
    }
  };
  
  /**
   * Baixa uma imagem específica
   */
  const baixarImagem = async (url: string, filename: string) => {
    try {
      // Usar fetch para obter os bytes da imagem
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Usar file-saver para salvar o arquivo
      saveAs(blob, filename);
    } catch (error) {
      console.error('Erro ao baixar imagem:', error);
      alert('Erro ao baixar imagem. Tente novamente.');
    }
  };
  
  /**
   * Baixa todas as imagens de um item em um arquivo zip
   */
  const baixarTodasImagens = async (item: Item) => {
    if (!item.fotos || item.fotos.length === 0) {
      alert('Este item não possui fotos.');
      return;
    }
    
    try {
      const zip = new JSZip();
      const lancamento = lancamentos.find(l => l.id === item.lancamento_id);
      const folderName = `${lancamento?.observacoes || 'Lancamento'}_${item.produto.nome}`;
      const imgFolder = zip.folder(folderName);
      
      // Download de cada imagem e adição ao zip
      for (let i = 0; i < item.fotos.length; i++) {
        const url = item.fotos[i];
        const filename = url.split('/').pop() || `imagem_${i+1}.jpg`;
        
        // Buscar a imagem
        const response = await fetch(url);
        const blob = await response.blob();
        
        // Adicionar ao zip
        imgFolder?.file(filename, blob);
      }
      
      // Gerar e baixar o arquivo zip
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${folderName}.zip`);
      
    } catch (error) {
      console.error('Erro ao criar arquivo zip:', error);
      alert('Erro ao baixar imagens. Tente novamente.');
    }
  };
  
  /**
   * Formata a data do lançamento
   */
  const formatarData = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return format(data, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return dataString;
    }
  };

  // Se estiver carregando, mostrar spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Se o usuário não for admin, mostrar mensagem de acesso negado
  if (usuario && usuario.perfil !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
          <p className="font-medium">Acesso Negado</p>
          <p>Você não tem permissão para acessar esta página.</p>
          <p className="mt-2">Redirecionando para a página inicial...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Painel de Administração</h1>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Voltar
        </button>
      </div>
      
      {/* Mensagem de erro */}
      {erro && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
          <p>{erro}</p>
        </div>
      )}
      
      {/* Mensagem de sucesso */}
      {mensagem && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md">
          <p>{mensagem}</p>
        </div>
      )}
      
      {/* Filtro por período */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium text-gray-800">Filtrar por Período</h2>
          
          {/* Botão para exportar todos */}
          {lancamentos.length > 0 && (
            <button
              onClick={exportarTodosParaCSV}
              disabled={loading}
              className="px-4 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exportando...
                </span>
              ) : (
                'Exportar Todos (CSV)'
              )}
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="dataInicial" className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              id="dataInicial"
              value={filtro.dataInicial}
              onChange={(e) => setFiltro(prev => ({ ...prev, dataInicial: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="dataFinal" className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <input
              type="date"
              id="dataFinal"
              value={filtro.dataFinal}
              onChange={(e) => setFiltro(prev => ({ ...prev, dataFinal: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={aplicarFiltros}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Carregando...' : 'Aplicar Filtro'}
            </button>
            
            {filtro.aplicado && (
              <button
                onClick={limparFiltros}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        
        {filtro.aplicado && (
          <div className="mt-3 text-sm text-gray-600">
            <p>
              Mostrando lançamentos de {filtro.dataInicial ? format(new Date(filtro.dataInicial), 'dd/MM/yyyy') : '...'} 
              {' '}até{' '}
              {filtro.dataFinal ? format(new Date(filtro.dataFinal), 'dd/MM/yyyy') : '...'}
            </p>
          </div>
        )}
      </div>
      
      <h2 className="text-xl font-semibold mb-4">Lançamentos Pendentes de Aprovação</h2>
      
      {/* Lista vazia */}
      {!loading && lancamentos.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600">Não há lançamentos pendentes de aprovação.</p>
        </div>
      )}
      
      {/* Lista de lançamentos pendentes */}
      {lancamentos.length > 0 && (
        <div className="space-y-6">
          {lancamentos.map(lancamento => (
            <div key={lancamento.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Cabeçalho do lançamento */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-wrap justify-between items-start mb-2">
                  <div className="mb-2 md:mb-0">
                    <p className="text-sm text-gray-500">{formatarData(lancamento.data_hora)}</p>
                    <h3 className="text-lg font-medium text-gray-900">{lancamento.observacoes}</h3>
                    {lancamento.usuario && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Usuário:</span> {lancamento.usuario.nome} ({lancamento.usuario.matricula})
                      </p>
                    )}
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                    Pendente
                  </div>
                </div>
                
                <button
                  onClick={() => expandirLancamento(lancamento.id)}
                  disabled={loadingAcao[lancamento.id]}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center disabled:opacity-50"
                >
                  {loadingAcao[lancamento.id] ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                      <span>Carregando...</span>
                    </>
                  ) : (
                    <>
                      <span>{lancamento.id === lancamentoEmAprovacao ? 'Ocultar detalhes' : 'Ver detalhes e aprovar'}</span>
                      <svg
                        className={`ml-1 h-4 w-4 transition-transform ${
                          lancamento.id === lancamentoEmAprovacao ? 'transform rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
              
              {/* Detalhes do lançamento (itens) e área de aprovação */}
              {lancamento.id === lancamentoEmAprovacao && (
                <div className="p-4 bg-gray-50">
                  {!lancamento.itens ? (
                    <div className="flex justify-center p-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : lancamento.itens.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center">Nenhum item encontrado neste lançamento.</p>
                  ) : (
                    <div>
                      <h3 className="text-md font-medium text-gray-700 mb-4">Itens do Lançamento</h3>
                      
                      <div className="space-y-6">
                        {lancamento.itens.map(item => (
                          <div key={item.id} className="border border-gray-200 rounded-md p-4 bg-white">
                            <div className="flex flex-wrap justify-between mb-4">
                              <div>
                                <h4 className="font-medium text-gray-900">{item.produto.nome}</h4>
                                <p className="text-sm text-gray-600">Código: {item.produto.codigo}</p>
                                <p className="text-sm text-gray-600">Quantidade: {item.quantidade}</p>
                                <p className="text-sm text-gray-600">Motivo: {item.motivo}</p>
                              </div>
                              
                              {item.fotos && item.fotos.length > 0 && (
                                <button
                                  onClick={() => baixarTodasImagens(item)}
                                  className="text-sm text-blue-600 hover:underline"
                                >
                                  Baixar todas as imagens (.zip)
                                </button>
                              )}
                            </div>
                            
                            {/* Fotos do item */}
                            {item.fotos && item.fotos.length > 0 ? (
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Fotos ({item.fotos.length}):</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {item.fotos.map((foto, index) => {
                                    const filename = foto.split('/').pop() || `imagem_${index+1}.jpg`;
                                    return (
                                      <div key={index} className="relative group">
                                        <a 
                                          href={foto} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="block"
                                        >
                                          <img 
                                            src={foto} 
                                            alt={`Foto ${index + 1}`} 
                                            className="h-24 w-full object-cover rounded-md hover:opacity-90 transition"
                                          />
                                        </a>
                                        <button
                                          onClick={() => baixarImagem(foto, filename)}
                                          className="absolute bottom-2 right-2 p-1 bg-white bg-opacity-80 rounded hover:bg-opacity-100 transition"
                                          title="Baixar imagem"
                                        >
                                          <svg className="h-4 w-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                          </svg>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">Nenhuma foto disponível para este item.</p>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {/* Área de aprovação */}
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <h3 className="text-md font-medium text-gray-700 mb-2">Aprovação do Lançamento</h3>
                        
                        <div className="mb-4">
                          <label htmlFor="observacao" className="block text-sm font-medium text-gray-700 mb-1">
                            Observações (opcional)
                          </label>
                          <textarea
                            id="observacao"
                            rows={3}
                            value={observacaoAprovacao}
                            onChange={(e) => setObservacaoAprovacao(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Digite observações adicionais..."
                          ></textarea>
                        </div>
                        
                        <div className="flex flex-wrap gap-4">
                          <button
                            onClick={() => atualizarStatusLancamento(lancamento.id, 'aprovado')}
                            disabled={loadingAcao[lancamento.id]}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                          >
                            {loadingAcao[lancamento.id] ? 'Processando...' : 'Aprovar Lançamento'}
                          </button>
                          
                          <button
                            onClick={() => atualizarStatusLancamento(lancamento.id, 'rejeitado')}
                            disabled={loadingAcao[lancamento.id]}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                          >
                            {loadingAcao[lancamento.id] ? 'Processando...' : 'Rejeitar Lançamento'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 