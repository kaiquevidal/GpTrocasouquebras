// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { finalizarLancamento } from '../services/lancamentoService';
import { supabase } from '../lib/supabaseClient';
import { AppUser } from '../types/user';

// Tipagem para um item da lista
interface ItemLista {
  produtoId: string;
  nomeProduto: string;
  quantidade: number;
  motivo: string;
  fotos: File[];
}

// Interface para o produto
interface Produto {
  id: string;
  nome: string;
  codigo: string;
  capacidade?: string;
}

/**
 * Componente para criar lançamentos de quebra ou troca de produtos
 */
export default function LancamentoForm() {
  const navigate = useNavigate();
  
  // Estado para os campos do formulário
  const [legendaGrupo, setLegendaGrupo] = useState('');
  const [tipoOperacao, setTipoOperacao] = useState('quebra');
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  
  // Estado para armazenar a lista de itens
  const [itens, setItens] = useState<ItemLista[]>([]);
  
  // Estados para feedback ao usuário
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);

  // Estados para produtos
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [erroProdutos, setErroProdutos] = useState<string | null>(null);
  
  // Estado para usuário autenticado
  const [usuario, setUsuario] = useState<AppUser | null>(null);
  const [carregandoUsuario, setCarregandoUsuario] = useState(true);

  // Referência para o input de arquivo (para resetá-lo)
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Verificar autenticação do usuário
  useEffect(() => {
    const verificarAutenticacao = async () => {
      try {
        setCarregandoUsuario(true);
        
        // Obter o usuário atual
        const { data, error } = await supabase.auth.getUser();
        
        if (error) {
          throw error;
        }
        
        if (!data?.user) {
          // Usuário não está autenticado
          navigate('/login');
          return;
        }
        
        // Obter metadados do usuário
        const metadata = data.user.user_metadata;
        
        setUsuario({
          id: data.user.id,
          email: data.user.email || '',
          nome: metadata?.nome || '',
          matricula: metadata?.matricula || '',
          perfil: metadata?.perfil || 'usuario'
        });
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setMensagem({ 
          tipo: 'erro', 
          texto: 'Erro ao verificar autenticação. Por favor, faça login novamente.' 
        });
        
        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } finally {
        setCarregandoUsuario(false);
      }
    };
    
    verificarAutenticacao();
  }, [navigate]);
  
  // Buscar produtos do Supabase
  useEffect(() => {
    const buscarProdutos = async () => {
      setCarregandoProdutos(true);
      setErroProdutos(null);
      
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('id, nome, codigo, capacidade')
          .order('nome');
          
        if (error) {
          throw error;
        }
        
        setProdutos(data || []);
      } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        setErroProdutos('Não foi possível carregar a lista de produtos. Por favor, tente novamente.');
      } finally {
        setCarregandoProdutos(false);
      }
    };
    
    buscarProdutos();
  }, []);
  
  /**
   * Adiciona o item atual à lista
   */
  const handleAdicionarItem = () => {
    // Validações básicas
    if (!produtoSelecionado) {
      setMensagem({ tipo: 'erro', texto: 'Selecione um produto' });
      return;
    }
    
    if (quantidade <= 0) {
      setMensagem({ tipo: 'erro', texto: 'A quantidade deve ser maior que zero' });
      return;
    }
    
    if (!motivo) {
      setMensagem({ tipo: 'erro', texto: 'Informe o motivo' });
      return;
    }
    
    // Encontrar o produto selecionado
    const produto = produtos.find(p => p.id === produtoSelecionado);
    if (!produto) {
      setMensagem({ tipo: 'erro', texto: 'Produto não encontrado' });
      return;
    }
    
    // Criar o novo item
    const novoItem: ItemLista = {
      produtoId: produto.id,
      nomeProduto: produto.nome,
      quantidade,
      motivo,
      fotos: [...fotos]
    };
    
    // Adicionar à lista
    setItens(prevItens => [...prevItens, novoItem]);
    
    // Limpar os campos do formulário
    setQuantidade(1);
    setMotivo('');
    setProdutoSelecionado('');
    setFotos([]);
    
    // Limpar o input de arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Mostrar mensagem de sucesso
    setMensagem({ tipo: 'sucesso', texto: 'Item adicionado com sucesso!' });
    
    // Limpar mensagem após 3 segundos
    setTimeout(() => {
      setMensagem(null);
    }, 3000);
  };
  
  /**
   * Finaliza o grupo e envia para o serviço
   */
  const handleFinalizarGrupo = async () => {
    if (!usuario) {
      setMensagem({ tipo: 'erro', texto: 'Você precisa estar autenticado para finalizar um grupo.' });
      return;
    }
    
    if (itens.length === 0) {
      setMensagem({ tipo: 'erro', texto: 'Adicione pelo menos um item' });
      return;
    }
    
    if (!legendaGrupo) {
      setMensagem({ tipo: 'erro', texto: 'Informe a legenda do grupo' });
      return;
    }
    
    setLoading(true);
    setMensagem(null);
    
    try {
      // Preparar itens no formato esperado pelo serviço
      const itensParaEnvio = itens.map(item => ({
        produto_id: item.produtoId,
        quantidade: item.quantidade,
        motivo: item.motivo,
        fotos: item.fotos
      }));
      
      // Chamar a função do serviço com o ID do usuário real
      const resultado = await finalizarLancamento({
        grupo: legendaGrupo,
        tipo: tipoOperacao,
        itens: itensParaEnvio,
        usuarioId: usuario.id
      });
      
      if (resultado.error) {
        throw new Error(resultado.error.message || 'Erro ao finalizar grupo');
      }
      
      // Limpar formulário e lista após sucesso
      setLegendaGrupo('');
      setTipoOperacao('quebra');
      setItens([]);
      
      // Mostrar mensagem de sucesso
      setMensagem({ tipo: 'sucesso', texto: 'Grupo finalizado com sucesso!' });
      
      // Mostrar alert de sucesso
      alert('Grupo finalizado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao finalizar grupo:', error);
      setMensagem({ tipo: 'erro', texto: error.message || 'Erro ao finalizar grupo' });
      
      // Mostrar alert de erro
      alert(`Erro ao finalizar grupo: ${error.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Manipula o upload de imagens
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFotos(Array.from(e.target.files));
    }
  };
  
  /**
   * Remove um item da lista
   */
  const handleRemoverItem = (index: number) => {
    setItens(prevItens => prevItens.filter((_, i) => i !== index));
  };
  
  // Mostrar loader enquanto verifica autenticação
  if (carregandoUsuario) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Se não houver usuário, redirecionar para login (já feito no useEffect)

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Registrar Lançamento</h2>
      
      {/* Mensagem de boas-vindas */}
      {usuario && (
        <div className="mb-6 p-3 bg-blue-50 border-l-4 border-blue-400 text-blue-700 rounded-md">
          <p>Olá, <span className="font-medium">{usuario.nome}</span>! Você está registrando um novo lançamento.</p>
        </div>
      )}
      
      {/* Mensagem de feedback */}
      {mensagem && (
        <div className={`mb-4 p-3 rounded-md ${
          mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border-l-4 border-green-500' 
          : 'bg-red-50 text-red-700 border-l-4 border-red-500'
        }`}>
          {mensagem.texto}
        </div>
      )}
      
      {/* Campos principais do lançamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="legendaGrupo" className="block text-sm font-medium text-gray-700 mb-1">
            Legenda do Grupo
          </label>
          <input
            type="text"
            id="legendaGrupo"
            value={legendaGrupo}
            onChange={(e) => setLegendaGrupo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Quebra mensal, Retorno de rota, etc."
          />
        </div>
        
        <div>
          <label htmlFor="tipoOperacao" className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Operação
          </label>
          <select
            id="tipoOperacao"
            value={tipoOperacao}
            onChange={(e) => setTipoOperacao(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="quebra">Quebra</option>
            <option value="troca">Troca</option>
          </select>
        </div>
      </div>
      
      {/* Separador */}
      <div className="border-t border-gray-200 my-6"></div>
      
      <h3 className="text-lg font-medium text-gray-800 mb-4">Adicionar Item</h3>
      
      {/* Campos do item */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="produto" className="block text-sm font-medium text-gray-700 mb-1">
            Produto
          </label>
          {carregandoProdutos ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="text-sm text-gray-500">Carregando produtos...</span>
            </div>
          ) : erroProdutos ? (
            <div className="text-sm text-red-600">{erroProdutos}</div>
          ) : (
            <select
              id="produto"
              value={produtoSelecionado}
              onChange={(e) => setProdutoSelecionado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={produtos.length === 0}
            >
              <option value="">Selecione um produto</option>
              {produtos.map(produto => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome} - {produto.codigo} {produto.capacidade ? `(${produto.capacidade})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        
        <div>
          <label htmlFor="quantidade" className="block text-sm font-medium text-gray-700 mb-1">
            Quantidade
          </label>
          <input
            type="number"
            id="quantidade"
            min="1"
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="md:col-span-2">
          <label htmlFor="motivo" className="block text-sm font-medium text-gray-700 mb-1">
            Motivo da {tipoOperacao === 'quebra' ? 'quebra' : 'troca'}
          </label>
          <input
            type="text"
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Dano no transporte, vazamento, etc."
          />
        </div>
        
        <div className="md:col-span-2">
          <label htmlFor="fotos" className="block text-sm font-medium text-gray-700 mb-1">
            Fotos
          </label>
          <input
            type="file"
            id="fotos"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {fotos.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {fotos.length} {fotos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
            </p>
          )}
        </div>
      </div>
      
      {/* Botão para adicionar item */}
      <div className="mt-4 mb-6">
        <button
          type="button"
          onClick={handleAdicionarItem}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={carregandoProdutos || produtos.length === 0}
        >
          Adicionar Item
        </button>
      </div>
      
      {/* Lista de itens adicionados */}
      {itens.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Itens Adicionados</h3>
          
          <div className="space-y-4">
            {itens.map((item, index) => (
              <div 
                key={index} 
                className="border border-gray-200 rounded-md p-4 bg-gray-50 flex justify-between items-center"
              >
                <div>
                  <h4 className="font-medium">{item.nomeProduto}</h4>
                  <p className="text-sm text-gray-600">Quantidade: {item.quantidade}</p>
                  <p className="text-sm text-gray-600">Motivo: {item.motivo}</p>
                  <p className="text-sm text-gray-600">
                    {item.fotos.length} {item.fotos.length === 1 ? 'foto' : 'fotos'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoverItem(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Botão para finalizar grupo */}
      <div className="mt-6 text-right">
        <button
          type="button"
          onClick={handleFinalizarGrupo}
          disabled={itens.length === 0 || loading || !usuario}
          className={`px-4 py-2 rounded-md ${
            itens.length === 0 || loading || !usuario
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
          }`}
        >
          {loading ? 'Finalizando...' : 'Finalizar Grupo'}
        </button>
      </div>
    </div>
  );
} 