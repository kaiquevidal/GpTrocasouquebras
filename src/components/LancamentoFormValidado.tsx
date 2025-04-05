import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabaseClient';
import { finalizarLancamento } from '../services/lancamentoService';
import { uploadFotos } from '../services/uploadService';
import { useNavigate } from 'react-router-dom';
import { AppUser } from '../types/user';

// Esquema de validação com Zod
const produtoSchema = z.object({
  id: z.string().nonempty('ID do produto é obrigatório'),
  nome: z.string().nonempty('Nome do produto é obrigatório'),
  codigo: z.string().nonempty('Código do produto é obrigatório'),
  capacidade: z.string().optional()
});

const itemSchema = z.object({
  produtoId: z.string().nonempty('Produto é obrigatório'),
  produto: produtoSchema,
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  motivo: z.string().min(3, 'Motivo deve ter pelo menos 3 caracteres'),
  tipoOperacao: z.enum(['quebra', 'troca'], {
    errorMap: () => ({ message: 'Selecione um tipo de operação válido' })
  }),
  arquivos: z.array(z.instanceof(File)).optional()
});

const formSchema = z.object({
  labelGrupo: z.string().min(3, 'Nome do grupo deve ter pelo menos 3 caracteres'),
  tipoOperacao: z.enum(['quebra', 'troca'], {
    errorMap: () => ({ message: 'Selecione um tipo de operação válido' })
  }),
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  motivo: z.string().min(3, 'Motivo deve ter pelo menos 3 caracteres'),
  produtoId: z.string().nonempty('Produto é obrigatório'),
  arquivos: z.array(z.instanceof(File)).optional()
});

type FormValues = z.infer<typeof formSchema>;
type Item = z.infer<typeof itemSchema>;
type Produto = z.infer<typeof produtoSchema>;

/**
 * Formulário de lançamento de itens com validação usando React Hook Form e Zod
 */
export default function LancamentoFormValidado() {
  const navigate = useNavigate();
  
  // Estados para gerenciar usuário, produtos e itens
  const [usuario, setUsuario] = useState<AppUser | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [carregandoProdutos, setCarregandoProdutos] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  
  // Inicializar React Hook Form com resolver do Zod
  const { 
    control, 
    handleSubmit, 
    formState: { errors },
    reset,
    watch
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      labelGrupo: '',
      tipoOperacao: 'quebra',
      quantidade: 1,
      motivo: '',
      produtoId: '',
      arquivos: []
    }
  });
  
  // Buscar usuário e produtos ao montar o componente
  useEffect(() => {
    const verificarUsuario = async () => {
      try {
        // Verificar autenticação
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        if (!user) {
          navigate('/login');
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
        buscarProdutos();
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        setErro('Erro ao verificar autenticação. Por favor, faça login novamente.');
      } finally {
        setCarregando(false);
      }
    };
    
    verificarUsuario();
  }, [navigate]);
  
  // Buscar produtos do Supabase
  const buscarProdutos = async () => {
    try {
      setCarregandoProdutos(true);
      
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      
      setProdutos(data || []);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      setErro('Erro ao carregar produtos. Por favor, tente novamente.');
    } finally {
      setCarregandoProdutos(false);
    }
  };
  
  // Observar valores do formulário para poder adicionar item
  const formValues = watch();
  
  // Adicionar um novo item à lista
  const adicionarItem = handleSubmit(async (data) => {
    try {
      setErro(null);
      
      // Encontrar o produto selecionado
      const produtoSelecionado = produtos.find(p => p.id === data.produtoId);
      if (!produtoSelecionado) {
        throw new Error('Produto não encontrado');
      }
      
      // Criar o novo item
      const novoItem: Item = {
        produtoId: data.produtoId,
        produto: produtoSelecionado,
        quantidade: data.quantidade,
        motivo: data.motivo,
        tipoOperacao: data.tipoOperacao,
        arquivos: data.arquivos || []
      };
      
      // Adicionar o item à lista
      setItens(prev => [...prev, novoItem]);
      
      // Mostrar mensagem de sucesso
      setMensagem('Item adicionado com sucesso!');
      setTimeout(() => setMensagem(null), 3000);
      
      // Resetar campos do formulário, exceto o labelGrupo
      reset({
        ...data,
        quantidade: 1,
        motivo: '',
        arquivos: []
      });
      
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      setErro('Erro ao adicionar item. Verifique os dados e tente novamente.');
    }
  });
  
  // Remover um item da lista
  const removerItem = (index: number) => {
    setItens(prev => prev.filter((_, i) => i !== index));
  };
  
  // Finalizar o grupo de lançamentos
  const finalizarGrupo = async () => {
    if (itens.length === 0) {
      setErro('Adicione pelo menos um item para finalizar o grupo.');
      return;
    }
    
    if (!usuario) {
      setErro('Usuário não autenticado. Por favor, faça login novamente.');
      navigate('/login');
      return;
    }
    
    if (!formValues.labelGrupo || formValues.labelGrupo.trim().length < 3) {
      setErro('Nome do grupo deve ter pelo menos 3 caracteres.');
      return;
    }
    
    try {
      setEnviando(true);
      setErro(null);
      
      // Preparar os dados para envio
      const lancamentoData = {
        observacoes: formValues.labelGrupo,
        usuario_id: usuario.id,
        itens: await Promise.all(itens.map(async (item) => {
          let fotosUrls: string[] = [];
          
          // Se houver arquivos, fazer upload
          if (item.arquivos && item.arquivos.length > 0) {
            fotosUrls = await uploadFotos(Array.from(item.arquivos), usuario.id);
          }
          
          return {
            produto_id: item.produtoId,
            quantidade: item.quantidade,
            motivo: item.motivo,
            tipo_operacao: item.tipoOperacao,
            fotos: fotosUrls
          };
        }))
      };
      
      // Chamar o serviço para finalizar o lançamento
      const { sucesso, mensagem, lancamentoId } = await finalizarLancamento(lancamentoData);
      
      if (sucesso) {
        // Limpar o formulário e a lista de itens
        reset({
          labelGrupo: '',
          tipoOperacao: 'quebra',
          quantidade: 1,
          motivo: '',
          produtoId: '',
          arquivos: []
        });
        setItens([]);
        
        // Mostrar mensagem de sucesso
        setMensagem(`Lançamento finalizado com sucesso! ID: ${lancamentoId}`);
        setTimeout(() => {
          setMensagem(null);
          // Redirecionar para o histórico
          navigate('/historico');
        }, 3000);
      } else {
        throw new Error(mensagem || 'Erro ao finalizar lançamento');
      }
    } catch (error) {
      console.error('Erro ao finalizar grupo:', error);
      setErro(`Erro ao finalizar grupo: ${(error as Error).message || 'Tente novamente mais tarde'}`);
    } finally {
      setEnviando(false);
    }
  };
  
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
      <h1 className="text-2xl font-bold mb-6">Registrar Quebra/Troca</h1>
      
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
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome do Grupo/Lote
          </label>
          <Controller
            name="labelGrupo"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                className={`w-full px-3 py-2 border rounded-md ${errors.labelGrupo ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Ex: Quebras semanais da linha 01"
              />
            )}
          />
          {errors.labelGrupo && (
            <p className="mt-1 text-sm text-red-600">{errors.labelGrupo.message}</p>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Operação
            </label>
            <Controller
              name="tipoOperacao"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className={`w-full px-3 py-2 border rounded-md ${errors.tipoOperacao ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="quebra">Quebra</option>
                  <option value="troca">Troca</option>
                </select>
              )}
            />
            {errors.tipoOperacao && (
              <p className="mt-1 text-sm text-red-600">{errors.tipoOperacao.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantidade
            </label>
            <Controller
              name="quantidade"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  min="1"
                  className={`w-full px-3 py-2 border rounded-md ${errors.quantidade ? 'border-red-500' : 'border-gray-300'}`}
                />
              )}
            />
            {errors.quantidade && (
              <p className="mt-1 text-sm text-red-600">{errors.quantidade.message}</p>
            )}
          </div>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produto
          </label>
          <Controller
            name="produtoId"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className={`w-full px-3 py-2 border rounded-md ${errors.produtoId ? 'border-red-500' : 'border-gray-300'}`}
                disabled={carregandoProdutos}
              >
                <option value="">Selecione um produto</option>
                {produtos.map(produto => (
                  <option key={produto.id} value={produto.id}>
                    {produto.nome} - {produto.codigo} {produto.capacidade ? `(${produto.capacidade})` : ''}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.produtoId && (
            <p className="mt-1 text-sm text-red-600">{errors.produtoId.message}</p>
          )}
          {carregandoProdutos && (
            <p className="mt-1 text-sm text-blue-600">Carregando produtos...</p>
          )}
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motivo da {formValues.tipoOperacao === 'quebra' ? 'Quebra' : 'Troca'}
          </label>
          <Controller
            name="motivo"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md ${errors.motivo ? 'border-red-500' : 'border-gray-300'}`}
                placeholder={`Descreva o motivo da ${formValues.tipoOperacao === 'quebra' ? 'quebra' : 'troca'}`}
              ></textarea>
            )}
          />
          {errors.motivo && (
            <p className="mt-1 text-sm text-red-600">{errors.motivo.message}</p>
          )}
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fotos (opcional)
          </label>
          <Controller
            name="arquivos"
            control={control}
            render={({ field: { value, onChange, ...field } }) => (
              <input
                {...field}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  onChange(files);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            )}
          />
          {errors.arquivos && (
            <p className="mt-1 text-sm text-red-600">{errors.arquivos.message}</p>
          )}
        </div>
        
        <button
          type="button"
          onClick={adicionarItem}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Adicionar Item
        </button>
      </div>
      
      {/* Lista de itens adicionados */}
      {itens.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Itens Adicionados</h2>
          
          <div className="space-y-4">
            {itens.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-md p-4 flex justify-between items-start">
                <div>
                  <div className="flex items-center mb-1">
                    <h3 className="font-medium">{item.produto.nome}</h3>
                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {item.tipoOperacao === 'quebra' ? 'Quebra' : 'Troca'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Código: {item.produto.codigo}</p>
                  <p className="text-sm text-gray-600">Quantidade: {item.quantidade}</p>
                  <p className="text-sm text-gray-600">Motivo: {item.motivo}</p>
                  <p className="text-sm text-gray-600">
                    Fotos: {item.arquivos ? item.arquivos.length : 0}
                  </p>
                </div>
                <button
                  onClick={() => removerItem(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-center">
            <button
              onClick={finalizarGrupo}
              disabled={enviando || itens.length === 0}
              className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {enviando ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Finalizando...
                </span>
              ) : (
                'Finalizar Grupo'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 