// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabaseClient';
import { AppUser } from '../types/user';

// Interface para o item de lançamento
interface Item {
  id: string;
  produto: {
    id: string;
    nome: string;
    codigo: string;
    capacidade?: string;
  };
  quantidade: number;
  motivo: string;
  fotos: string[]; // URLs das fotos
  tipo_operacao?: string;
}

// Interface para o lançamento
interface Lancamento {
  id: string;
  usuario_id: string;
  data_hora: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  observacoes: string;
  itens?: Item[];
}

// Interface para o modal de confirmação
interface ModalConfirmacao {
  visivel: boolean;
  tipo: 'excluir' | 'exportar' | '';
  lancamentoId: string;
  titulo: string;
  mensagem: string;
}

/**
 * Componente que exibe o histórico de lançamentos do usuário
 */
export default function HistoricoLancamentos() {
  const navigate = useNavigate();
  
  // Estado para armazenar os lançamentos
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  
  // Estado para controlar o lançamento expandido (detalhes)
  const [lancamentoExpandido, setLancamentoExpandido] = useState<string | null>(null);
  
  // Estados para feedback ao usuário
  const [loading, setLoading] = useState(true);
  const [loadingAcao, setLoadingAcao] = useState<{[key: string]: boolean}>({});
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  
  // Estado para o usuário autenticado
  const [usuario, setUsuario] = useState<AppUser | null>(null);
  
  // Estado para o modal de confirmação
  const [modalConfirmacao, setModalConfirmacao] = useState<ModalConfirmacao>({
    visivel: false,
    tipo: '',
    lancamentoId: '',
    titulo: '',
    mensagem: ''
  });
  
  // Estado para filtro de período
  const [filtro, setFiltro] = useState({
    dataInicial: '',
    dataFinal: '',
    aplicado: false
  });

  // Verificar autenticação e buscar lançamentos
  useEffect(() => {
    const carregarDados = async () => {
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
        
        // 3. Buscar lançamentos do usuário
        await buscarLancamentos(userData);
        
      } catch (error) {
        console.error('Erro:', error);
        setErro('Ocorreu um erro ao carregar os lançamentos. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };
    
    carregarDados();
  }, [navigate]);
  
  /**
   * Busca os lançamentos do usuário com filtros opcionais
   */
  const buscarLancamentos = async (userData: AppUser, comFiltros = false) => {
    try {
      setLoading(true);
      setErro(null);
      
      let query = supabase
        .from('lancamentos')
        .select(`
          id,
          usuario_id,
          data_hora,
          status,
          observacoes
        `)
        .eq('usuario_id', userData.id)
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
      
      const { data: lancamentosData, error: lancamentosError } = await query;
      
      if (lancamentosError) {
        throw new Error('Erro ao buscar lançamentos');
      }
      
      setLancamentos(lancamentosData || []);
      
      // Atualizar estado do filtro
      if (comFiltros) {
        setFiltro(prev => ({ ...prev, aplicado: true }));
      }
      
    } catch (error) {
      console.error('Erro ao buscar lançamentos:', error);
      setErro('Ocorreu um erro ao buscar os lançamentos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Carrega os itens de um lançamento específico
   */
  const carregarDetalhesLancamento = async (lancamentoId: string) => {
    // Se já está expandido, colapsar
    if (lancamentoId === lancamentoExpandido) {
      setLancamentoExpandido(null);
      return;
    }
    
    try {
      setLancamentoExpandido(lancamentoId);
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: true }));
      
      // Buscar os itens relacionados ao lançamento e suas informações de produto
      const { data, error } = await supabase
        .from('itens')
        .select(`
          id,
          quantidade,
          motivo,
          fotos,
          tipo_operacao,
          produto:produtos (
            id,
            nome,
            codigo,
            capacidade
          )
        `)
        .eq('lancamento_id', lancamentoId);
      
      if (error) {
        throw error;
      }
      
      // Atualizar o lançamento com seus itens
      setLancamentos(prevLancamentos => 
        prevLancamentos.map(lanc => 
          lanc.id === lancamentoId 
            ? { ...lanc, itens: data || [] } 
            : lanc
        )
      );
      
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      setErro('Erro ao carregar os detalhes do lançamento');
    } finally {
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: false }));
    }
  };
  
  /**
   * Abre o modal de confirmação para exclusão
   */
  const confirmarExclusao = (lancamentoId: string) => {
    const lancamento = lancamentos.find(l => l.id === lancamentoId);
    if (!lancamento) return;
    
    setModalConfirmacao({
      visivel: true,
      tipo: 'excluir',
      lancamentoId,
      titulo: 'Excluir Lançamento',
      mensagem: `Tem certeza que deseja excluir o lançamento "${lancamento.observacoes}"? Esta ação não poderá ser desfeita.`
    });
  };
  
  /**
   * Exclui um lançamento
   */
  const excluirLancamento = async () => {
    const { lancamentoId } = modalConfirmacao;
    
    try {
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: true }));
      
      // 1. Verificar se o lançamento existe e é do usuário atual
      const { data: lancamentoData, error: lancamentoError } = await supabase
        .from('lancamentos')
        .select('usuario_id, status')
        .eq('id', lancamentoId)
        .single();
      
      if (lancamentoError) {
        throw new Error('Lançamento não encontrado');
      }
      
      // 2. Verificar permissões
      if (lancamentoData.usuario_id !== usuario?.id && usuario?.perfil !== 'admin') {
        throw new Error('Você não tem permissão para excluir este lançamento');
      }
      
      if (lancamentoData.status !== 'pendente') {
        throw new Error('Apenas lançamentos pendentes podem ser excluídos');
      }
      
      // 3. Registrar log da ação
      await registrarLog('excluir', lancamentoId);
      
      // 4. Excluir o lançamento (as RLS policies cuidarão da segurança)
      const { error: deleteError } = await supabase
        .from('lancamentos')
        .delete()
        .eq('id', lancamentoId);
      
      if (deleteError) {
        throw deleteError;
      }
      
      // 5. Atualizar UI removendo o lançamento da lista
      setLancamentos(prev => prev.filter(l => l.id !== lancamentoId));
      
      // 6. Fechar modal e mostrar mensagem de sucesso
      setModalConfirmacao({ visivel: false, tipo: '', lancamentoId: '', titulo: '', mensagem: '' });
      setMensagem('Lançamento excluído com sucesso!');
      
      // Limpar mensagem após 3 segundos
      setTimeout(() => {
        setMensagem(null);
      }, 3000);
      
    } catch (error) {
      console.error('Erro ao excluir lançamento:', error);
      setErro(`Erro ao excluir lançamento: ${error.message}`);
    } finally {
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: false }));
    }
  };
  
  /**
   * Navega para a página de edição de lançamento
   */
  const editarLancamento = (lancamentoId: string) => {
    navigate(`/editar/${lancamentoId}`);
  };
  
  /**
   * Registra um log de ação no sistema
   */
  const registrarLog = async (tipoAcao: string, alvoId: string) => {
    if (!usuario) return;
    
    try {
      await supabase
        .from('logs')
        .insert({
          usuario_id: usuario.id,
          tipo_acao: tipoAcao,
          alvo_id: alvoId,
          data_hora: new Date().toISOString()
        });
    } catch (error) {
      console.error('Erro ao registrar log:', error);
      // Não interromper o fluxo principal se o log falhar
    }
  };
  
  /**
   * Aplica filtros de data na busca de lançamentos
   */
  const aplicarFiltros = async () => {
    if (!usuario) return;
    
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
    
    await buscarLancamentos(usuario, true);
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
    
    if (usuario) {
      await buscarLancamentos(usuario, false);
    }
  };
  
  /**
   * Exporta um lançamento para CSV
   */
  const exportarParaCSV = async (lancamentoId: string) => {
    try {
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: true }));
      
      const lancamento = lancamentos.find(l => l.id === lancamentoId);
      if (!lancamento) {
        throw new Error('Lançamento não encontrado');
      }
      
      // Se o lançamento não tem itens carregados, carregar eles primeiro
      if (!lancamento.itens) {
        await carregarDetalhesLancamento(lancamentoId);
        return; // Retornar e esperar o usuário clicar novamente após carregar
      }
      
      if (!lancamento.itens?.length) {
        throw new Error('Este lançamento não possui itens para exportar');
      }
      
      // Registrar log de exportação
      await registrarLog('exportar', lancamentoId);
      
      // Preparar dados para CSV
      const dadosCSV = [
        // Cabeçalho
        [
          'ID do Lançamento',
          'Código do Produto', 
          'Nome do Produto', 
          'Capacidade (ml)', 
          'Quantidade', 
          'Motivo', 
          'Tipo de Operação', 
          'Data/Hora do Lançamento',
          'Status'
        ]
      ];
      
      // Adicionar linhas de dados
      lancamento.itens.forEach(item => {
        dadosCSV.push([
          lancamento.id,
          item.produto.codigo,
          item.produto.nome,
          item.produto.capacidade || 'N/A',
          item.quantidade.toString(),
          item.motivo,
          item.tipo_operacao === 'troca' ? 'Troca' : 'Quebra',
          format(new Date(lancamento.data_hora), "dd/MM/yyyy HH:mm"),
          lancamento.status.charAt(0).toUpperCase() + lancamento.status.slice(1)
        ]);
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
      let filename = `lancamento_${lancamento.id}_`;
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
      
      setMensagem('Lançamento exportado com sucesso!');
      setTimeout(() => {
        setMensagem(null);
      }, 3000);
      
    } catch (error) {
      console.error('Erro ao exportar lançamento:', error);
      setErro(`Erro ao exportar lançamento: ${error.message}`);
    } finally {
      setLoadingAcao(prev => ({ ...prev, [lancamentoId]: false }));
    }
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
          await carregarDetalhesLancamento(lancamento.id);
        }
      }
      
      // Verificar novamente se todos os lançamentos têm itens
      const temTodosDetalhes = lancamentos.every(l => l.itens);
      if (!temTodosDetalhes) {
        throw new Error('Não foi possível carregar todos os detalhes. Tente novamente.');
      }
      
      // Registrar log de exportação em massa
      await registrarLog('exportar_todos', 'multiplos');
      
      // Preparar dados para CSV
      const dadosCSV = [
        // Cabeçalho
        [
          'ID do Lançamento',
          'Observações',
          'Data/Hora',
          'Status',
          'Código do Produto', 
          'Nome do Produto', 
          'Capacidade (ml)', 
          'Quantidade', 
          'Motivo', 
          'Tipo de Operação'
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
            lancamento.status.charAt(0).toUpperCase() + lancamento.status.slice(1),
            item.produto.codigo,
            item.produto.nome,
            item.produto.capacidade || 'N/A',
            item.quantidade.toString(),
            item.motivo,
            item.tipo_operacao === 'troca' ? 'Troca' : 'Quebra'
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
      let filename = `lancamentos_`;
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
  
  /**
   * Retorna a cor de fundo baseada no status
   */
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'aprovado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rejeitado':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };
  
  /**
   * Fecha o modal de confirmação
   */
  const fecharModal = () => {
    setModalConfirmacao({ visivel: false, tipo: '', lancamentoId: '', titulo: '', mensagem: '' });
  };

  // Se estiver carregando, mostrar spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Histórico de Lançamentos</h1>
      
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
      
      {/* Lista vazia */}
      {!loading && lancamentos.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600">
            {filtro.aplicado 
              ? 'Nenhum lançamento encontrado no período selecionado.' 
              : 'Você ainda não possui lançamentos registrados.'}
          </p>
          <button
            onClick={() => navigate('/lancamento')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Criar Novo Lançamento
          </button>
        </div>
      )}
      
      {/* Lista de lançamentos */}
      {lancamentos.length > 0 && (
        <div className="space-y-6">
          {lancamentos.map(lancamento => (
            <div key={lancamento.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Cabeçalho do lançamento */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-wrap justify-between items-start mb-2">
                  <div className="mb-2 md:mb-0">
                    <p className="text-sm text-gray-500">{formatarData(lancamento.data_hora)}</p>
                    <h2 className="text-lg font-medium text-gray-900">{lancamento.observacoes}</h2>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(lancamento.status)}`}>
                    {lancamento.status.charAt(0).toUpperCase() + lancamento.status.slice(1)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => carregarDetalhesLancamento(lancamento.id)}
                    disabled={loadingAcao[lancamento.id]}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center disabled:opacity-50"
                  >
                    {loadingAcao[lancamento.id] ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                        <span>Carregando...</span>
                      </>
                    ) : (
                      <>
                        <span>{lancamento.id === lancamentoExpandido ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
                        <svg
                          className={`ml-1 h-4 w-4 transition-transform ${
                            lancamento.id === lancamentoExpandido ? 'transform rotate-180' : ''
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
                  
                  {/* Ações - visíveis apenas para lançamentos pendentes */}
                  {lancamento.status === 'pendente' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => editarLancamento(lancamento.id)}
                        disabled={loadingAcao[lancamento.id]}
                        className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => confirmarExclusao(lancamento.id)}
                        disabled={loadingAcao[lancamento.id]}
                        className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                  
                  {/* Botão de exportar - visível para todos os lançamentos */}
                  <button
                    onClick={() => exportarParaCSV(lancamento.id)}
                    disabled={loadingAcao[lancamento.id]}
                    className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200 disabled:opacity-50 ml-2"
                  >
                    Exportar CSV
                  </button>
                </div>
              </div>
              
              {/* Detalhes do lançamento (itens) */}
              {lancamento.id === lancamentoExpandido && (
                <div className="p-4 bg-gray-50">
                  {!lancamento.itens ? (
                    <div className="flex justify-center p-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : lancamento.itens.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center">Nenhum item encontrado neste lançamento.</p>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="text-md font-medium text-gray-700 mb-2">Itens do Lançamento</h3>
                      
                      {lancamento.itens.map(item => (
                        <div key={item.id} className="border border-gray-200 rounded-md p-3">
                          <div className="flex flex-wrap justify-between">
                            <div className="mb-2 md:mb-0">
                              <h4 className="font-medium text-gray-900">{item.produto.nome}</h4>
                              <p className="text-sm text-gray-600">Código: {item.produto.codigo}</p>
                              <p className="text-sm text-gray-600">Quantidade: {item.quantidade}</p>
                              <p className="text-sm text-gray-600">Motivo: {item.motivo}</p>
                              <p className="text-sm text-gray-600">
                                Tipo: {item.tipo_operacao === 'troca' ? 'Troca' : 'Quebra'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Fotos do item */}
                          {item.fotos && item.fotos.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-700 mb-2">Fotos:</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {item.fotos.map((foto, index) => (
                                  <a 
                                    key={index} 
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
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Botão para criar novo lançamento */}
      <div className="mt-8 text-center">
        <button
          onClick={() => navigate('/lancamento')}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Criar Novo Lançamento
        </button>
      </div>
      
      {/* Modal de confirmação */}
      {modalConfirmacao.visivel && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-3">{modalConfirmacao.titulo}</h3>
            <p className="text-gray-600 mb-6">{modalConfirmacao.mensagem}</p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              
              {modalConfirmacao.tipo === 'excluir' && (
                <button
                  onClick={excluirLancamento}
                  disabled={loadingAcao[modalConfirmacao.lancamentoId]}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {loadingAcao[modalConfirmacao.lancamentoId] ? 'Excluindo...' : 'Excluir'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 