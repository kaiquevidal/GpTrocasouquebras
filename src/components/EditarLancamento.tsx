import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { AppUser } from '../types/user';

// Tipagem para produto
interface Produto {
  id: string;
  nome: string;
  codigo: string;
  capacidade?: string;
}

// Tipagem para um item do lançamento a ser editado
interface Item {
  id: string;
  produto_id: string;
  produto?: Produto;
  quantidade: number;
  motivo: string;
  tipo_operacao: 'quebra' | 'troca';
  fotos: string[];
  // Para itens novos que serão adicionados
  arquivos_novos?: File[];
  // Flag para marcar itens que serão removidos
  remover?: boolean;
}

// Tipagem para os dados gerais do lançamento
interface Lancamento {
  id: string;
  observacoes: string;
  data_hora: string;
  status: string;
  usuario_id: string;
  itens: Item[];
}

// Componente para edição de lançamento
export default function EditarLancamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Estados para armazenar dados
  const [lancamento, setLancamento] = useState<Lancamento | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [usuario, setUsuario] = useState<AppUser | null>(null);
  
  // Estados para formulário
  const [observacoes, setObservacoes] = useState('');
  
  // Estados para novo item
  const [novoItem, setNovoItem] = useState({
    produto_id: '',
    quantidade: 1,
    motivo: '',
    tipo_operacao: 'quebra' as 'quebra' | 'troca',
    arquivos_novos: [] as File[]
  });
  
  // Estados de feedback ao usuário
  const [loading, setLoading] = useState(true);
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  
  // Referência para input de arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Carregar dados ao montar o componente
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
        
        // 3. Verificar se o ID foi fornecido
        if (!id) {
          throw new Error('ID do lançamento não fornecido');
        }
        
        // 4. Buscar o lançamento
        const { data: lancamentoData, error: lancamentoError } = await supabase
          .from('lancamentos')
          .select('id, observacoes, data_hora, status, usuario_id')
          .eq('id', id)
          .single();
        
        if (lancamentoError) {
          throw new Error('Lançamento não encontrado');
        }
        
        // 5. Verificar permissões (apenas proprietário ou admin)
        if (lancamentoData.usuario_id !== userData.id && userData.perfil !== 'admin') {
          throw new Error('Você não tem permissão para editar este lançamento');
        }
        
        // 6. Verificar status (apenas pendente pode ser editado)
        if (lancamentoData.status !== 'pendente') {
          throw new Error('Apenas lançamentos pendentes podem ser editados');
        }
        
        // 7. Buscar itens do lançamento
        const { data: itensData, error: itensError } = await supabase
          .from('itens')
          .select(`
            id, 
            produto_id,
            quantidade, 
            motivo, 
            tipo_operacao,
            fotos,
            produto:produtos (
              id, 
              nome, 
              codigo, 
              capacidade
            )
          `)
          .eq('lancamento_id', id);
        
        if (itensError) {
          throw new Error('Erro ao buscar itens do lançamento');
        }
        
        // 8. Buscar produtos disponíveis
        const { data: produtosData, error: produtosError } = await supabase
          .from('produtos')
          .select('id, nome, codigo, capacidade')
          .order('nome');
        
        if (produtosError) {
          throw new Error('Erro ao buscar produtos');
        }
        
        // 9. Atualizar estados
        setLancamento({
          ...lancamentoData,
          itens: itensData || []
        });
        setObservacoes(lancamentoData.observacoes);
        setProdutos(produtosData || []);
        
        // Registrar log de acesso ao editor
        registrarLog('acessar_editor', id);
        
      } catch (error) {
        console.error('Erro:', error);
        setErro(error.message || 'Ocorreu um erro ao carregar os dados.');
        
        // Redirecionar para o histórico após alguns segundos
        setTimeout(() => {
          navigate('/historico');
        }, 5000);
      } finally {
        setLoading(false);
      }
    };
    
    carregarDados();
  }, [id, navigate]);
  
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
   * Atualiza os dados de um item existente
   */
  const atualizarItem = (itemId: string, campo: string, valor: any) => {
    if (!lancamento) return;
    
    setLancamento({
      ...lancamento,
      itens: lancamento.itens.map(item => 
        item.id === itemId 
          ? { ...item, [campo]: valor } 
          : item
      )
    });
  };
  
  /**
   * Marca um item para remoção
   */
  const marcarParaRemocao = (itemId: string) => {
    if (!lancamento) return;
    
    setLancamento({
      ...lancamento,
      itens: lancamento.itens.map(item => 
        item.id === itemId 
          ? { ...item, remover: !item.remover } 
          : item
      )
    });
  };
  
  /**
   * Adiciona um novo item ao lançamento
   */
  const adicionarNovoItem = () => {
    if (!lancamento) return;
    
    // Validações básicas
    if (!novoItem.produto_id) {
      setErro('Selecione um produto');
      return;
    }
    
    if (novoItem.quantidade <= 0) {
      setErro('A quantidade deve ser maior que zero');
      return;
    }
    
    if (!novoItem.motivo) {
      setErro('Informe o motivo');
      return;
    }
    
    // Encontrar o produto selecionado
    const produtoSelecionado = produtos.find(p => p.id === novoItem.produto_id);
    if (!produtoSelecionado) {
      setErro('Produto não encontrado');
      return;
    }
    
    // ID temporário para manipulação no frontend
    const tempId = `temp_${Date.now()}`;
    
    // Adicionar o novo item à lista
    setLancamento({
      ...lancamento,
      itens: [
        ...lancamento.itens,
        {
          id: tempId,
          produto_id: novoItem.produto_id,
          produto: produtoSelecionado,
          quantidade: novoItem.quantidade,
          motivo: novoItem.motivo,
          tipo_operacao: novoItem.tipo_operacao,
          fotos: [],
          arquivos_novos: [...novoItem.arquivos_novos]
        }
      ]
    });
    
    // Limpar o formulário de novo item
    setNovoItem({
      produto_id: '',
      quantidade: 1,
      motivo: '',
      tipo_operacao: 'quebra',
      arquivos_novos: []
    });
    
    // Limpar o input de arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Limpar mensagem de erro e mostrar confirmação
    setErro(null);
    setMensagem('Item adicionado. Lembre-se de salvar as alterações.');
    
    // Limpar mensagem após 3 segundos
    setTimeout(() => {
      setMensagem(null);
    }, 3000);
  };
  
  /**
   * Manipula o upload de arquivos para novo item
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Verificar tamanho máximo (3MB por arquivo)
      const tamanhoMaximo = 3 * 1024 * 1024; // 3MB em bytes
      const arquivosValidos = Array.from(files).filter(file => {
        if (file.size > tamanhoMaximo) {
          setErro(`Arquivo ${file.name} excede o tamanho máximo de 3MB`);
          return false;
        }
        return true;
      });
      
      // Verificar tipo de arquivo (apenas imagens)
      const tiposPermitidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const arquivosImagem = arquivosValidos.filter(file => {
        if (!tiposPermitidos.includes(file.type)) {
          setErro(`Arquivo ${file.name} não é uma imagem válida`);
          return false;
        }
        return true;
      });
      
      setNovoItem(prev => ({ 
        ...prev, 
        arquivos_novos: arquivosImagem
      }));
    }
  };
  
  /**
   * Salva todas as alterações no lançamento
   */
  const salvarAlteracoes = async () => {
    if (!lancamento || !usuario) return;
    
    try {
      setLoadingAcao(true);
      setErro(null);
      
      // 1. Verificar se há pelo menos um item após remoções
      const itensAposRemocao = lancamento.itens.filter(item => !item.remover);
      if (itensAposRemocao.length === 0) {
        throw new Error('O lançamento deve ter pelo menos um item');
      }
      
      // 2. Atualizar dados do lançamento
      const { error: updateLancamentoError } = await supabase
        .from('lancamentos')
        .update({ 
          observacoes: observacoes 
        })
        .eq('id', lancamento.id);
      
      if (updateLancamentoError) {
        throw new Error('Erro ao atualizar dados do lançamento');
      }
      
      // 3. Processar exclusões de itens
      const itensParaRemover = lancamento.itens.filter(item => item.remover && !item.id.startsWith('temp_'));
      for (const item of itensParaRemover) {
        const { error: deleteItemError } = await supabase
          .from('itens')
          .delete()
          .eq('id', item.id);
        
        if (deleteItemError) {
          throw new Error(`Erro ao remover item: ${item.id}`);
        }
      }
      
      // 4. Processar atualizações de itens existentes
      const itensParaAtualizar = lancamento.itens.filter(item => 
        !item.remover && !item.id.startsWith('temp_')
      );
      
      for (const item of itensParaAtualizar) {
        const { error: updateItemError } = await supabase
          .from('itens')
          .update({
            quantidade: item.quantidade,
            motivo: item.motivo,
            tipo_operacao: item.tipo_operacao
          })
          .eq('id', item.id);
        
        if (updateItemError) {
          throw new Error(`Erro ao atualizar item: ${item.id}`);
        }
      }
      
      // 5. Processar novos itens
      const itensNovos = lancamento.itens.filter(item => 
        !item.remover && item.id.startsWith('temp_')
      );
      
      for (const item of itensNovos) {
        // a. Fazer upload dos arquivos, se houver
        let fotosUrls: string[] = [];
        
        if (item.arquivos_novos && item.arquivos_novos.length > 0) {
          for (const arquivo of item.arquivos_novos) {
            const fileExt = arquivo.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
            const filePath = `${usuario.id}/${lancamento.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('fotos-lancamentos')
              .upload(filePath, arquivo, {
                cacheControl: '3600',
                upsert: false
              });
            
            if (uploadError) {
              throw new Error(`Erro ao fazer upload do arquivo: ${arquivo.name}`);
            }
            
            // Obter URL pública
            const { data: urlData } = supabase.storage
              .from('fotos-lancamentos')
              .getPublicUrl(filePath);
            
            fotosUrls.push(urlData.publicUrl);
          }
        }
        
        // b. Inserir o novo item
        const { error: insertItemError } = await supabase
          .from('itens')
          .insert({
            lancamento_id: lancamento.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            motivo: item.motivo,
            tipo_operacao: item.tipo_operacao,
            fotos: fotosUrls
          });
        
        if (insertItemError) {
          throw new Error(`Erro ao adicionar novo item`);
        }
      }
      
      // 6. Registrar log da edição
      await registrarLog('editar', lancamento.id);
      
      // 7. Mostrar mensagem de sucesso e redirecionar
      setMensagem('Lançamento atualizado com sucesso!');
      
      setTimeout(() => {
        navigate('/historico');
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      setErro(error.message || 'Ocorreu um erro ao salvar as alterações.');
    } finally {
      setLoadingAcao(false);
    }
  };
  
  /**
   * Cancela a edição e volta para o histórico
   */
  const cancelarEdicao = () => {
    navigate('/historico');
  };
  
  // Se estiver carregando, mostrar spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Se ocorreu um erro fatal (sem dados), mostrar mensagem
  if (!lancamento) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
          <h2 className="font-medium">Erro ao carregar lançamento</h2>
          <p>{erro || 'Não foi possível carregar os dados do lançamento.'}</p>
          <p className="mt-2">Redirecionando para o histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Editar Lançamento</h1>
      
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
      
      {/* Dados do lançamento */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome/Descrição do Grupo
          </label>
          <input
            type="text"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Quebras semanais da linha 01"
          />
        </div>
        
        {/* Informações do lançamento */}
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Informações do Lançamento</h3>
          <p className="text-sm text-gray-600">
            <strong>Data/Hora:</strong> {new Date(lancamento.data_hora).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Status:</strong> {lancamento.status.charAt(0).toUpperCase() + lancamento.status.slice(1)}
          </p>
        </div>
      </div>
      
      {/* Lista de itens existentes */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Itens do Lançamento</h2>
        
        {lancamento.itens.length === 0 ? (
          <p className="text-gray-600 text-center py-4">Nenhum item cadastrado.</p>
        ) : (
          <div className="space-y-4">
            {lancamento.itens.map(item => (
              <div 
                key={item.id} 
                className={`border rounded-md p-4 ${
                  item.remover 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {item.produto?.nome || 'Produto não encontrado'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Código: {item.produto?.codigo || 'N/A'}
                    </p>
                  </div>
                  <button
                    onClick={() => marcarParaRemocao(item.id)}
                    className={`px-3 py-1 text-sm rounded ${
                      item.remover 
                        ? 'bg-gray-300 text-gray-700 hover:bg-gray-400' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {item.remover ? 'Restaurar' : 'Remover'}
                  </button>
                </div>
                
                {!item.remover && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Operação
                      </label>
                      <select
                        value={item.tipo_operacao}
                        onChange={(e) => atualizarItem(item.id, 'tipo_operacao', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="quebra">Quebra</option>
                        <option value="troca">Troca</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(e) => atualizarItem(item.id, 'quantidade', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Motivo
                      </label>
                      <input
                        type="text"
                        value={item.motivo}
                        onChange={(e) => atualizarItem(item.id, 'motivo', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
                
                {/* Fotos do item */}
                {item.fotos && item.fotos.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Fotos existentes:</p>
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
                
                {/* Novas fotos (para itens novos) */}
                {item.arquivos_novos && item.arquivos_novos.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Novas fotos a serem enviadas:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {item.arquivos_novos.map((arquivo, index) => (
                        <div key={index} className="h-24 w-full rounded-md bg-gray-100 flex items-center justify-center text-gray-500 text-sm overflow-hidden">
                          {arquivo.type.startsWith('image/') ? (
                            <img 
                              src={URL.createObjectURL(arquivo)} 
                              alt={`Nova foto ${index + 1}`} 
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-center px-2">
                              {arquivo.name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {item.remover && (
                  <div className="mt-3 p-2 bg-red-100 text-red-700 text-sm rounded-md">
                    Este item será removido ao salvar as alterações.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Formulário para adicionar novo item */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Adicionar Novo Item</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produto
            </label>
            <select
              value={novoItem.produto_id}
              onChange={(e) => setNovoItem(prev => ({ ...prev, produto_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um produto</option>
              {produtos.map(produto => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome} - {produto.codigo} {produto.capacidade ? `(${produto.capacidade})` : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Operação
            </label>
            <select
              value={novoItem.tipo_operacao}
              onChange={(e) => setNovoItem(prev => ({ 
                ...prev, 
                tipo_operacao: e.target.value as 'quebra' | 'troca' 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="quebra">Quebra</option>
              <option value="troca">Troca</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantidade
            </label>
            <input
              type="number"
              min="1"
              value={novoItem.quantidade}
              onChange={(e) => setNovoItem(prev => ({ 
                ...prev, 
                quantidade: parseInt(e.target.value) || 1 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo da {novoItem.tipo_operacao === 'quebra' ? 'Quebra' : 'Troca'}
            </label>
            <input
              type="text"
              value={novoItem.motivo}
              onChange={(e) => setNovoItem(prev => ({ ...prev, motivo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Quebra durante transporte"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fotos (opcional - máx. 3MB por arquivo)
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            {novoItem.arquivos_novos.length > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                {novoItem.arquivos_novos.length} {novoItem.arquivos_novos.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}
              </p>
            )}
          </div>
        </div>
        
        <button
          type="button"
          onClick={adicionarNovoItem}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Adicionar Item
        </button>
      </div>
      
      {/* Ações finais */}
      <div className="flex justify-end space-x-4 mb-8">
        <button
          onClick={cancelarEdicao}
          disabled={loadingAcao}
          className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
        >
          Cancelar
        </button>
        
        <button
          onClick={salvarAlteracoes}
          disabled={loadingAcao}
          className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loadingAcao ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Salvando...
            </span>
          ) : (
            'Salvar Alterações'
          )}
        </button>
      </div>
    </div>
  );
} 