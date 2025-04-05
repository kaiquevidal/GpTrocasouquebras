// @ts-nocheck
import { supabase } from '../lib/supabaseClient';
import { uploadFotos } from './uploadService';

/**
 * Interface para um item de lançamento
 */
interface ItemLancamento {
  produto_id: string;
  quantidade: number;
  motivo: string;
  fotos: File[];
}

/**
 * Interface de parâmetros para finalizar um lançamento
 */
interface FinalizarLancamentoParams {
  grupo: string;
  tipo: string;
  itens: ItemLancamento[];
  usuarioId: string;
}

/**
 * Finaliza um lançamento criando o registro principal e os itens relacionados
 * 
 * @param params Parâmetros do lançamento (grupo, tipo, itens, usuarioId)
 * @returns O lançamento criado com seus itens
 */
export const finalizarLancamento = async (params: FinalizarLancamentoParams) => {
  const { grupo, tipo, itens, usuarioId } = params;
  
  try {
    // 1. Criar o lançamento na tabela 'lancamentos'
    const { data: lancamento, error: lancamentoError } = await supabase
      .from('lancamentos')
      .insert({
        usuario_id: usuarioId,
        data_hora: new Date().toISOString(),
        status: 'pendente',
        observacoes: `${tipo.toUpperCase()} - ${grupo}`
      })
      .select()
      .single();
    
    if (lancamentoError) {
      console.error('Erro ao criar lançamento:', lancamentoError);
      throw lancamentoError;
    }
    
    // 2. Processar cada item e inserir na tabela 'itens'
    const itensProcessados = [];
    
    for (const item of itens) {
      try {
        // Fazer upload das fotos e obter as URLs
        const fotosUrls = await uploadFotos(item.fotos, usuarioId);
        
        // Inserir o item na tabela 'itens'
        const { data: itemData, error: itemError } = await supabase
          .from('itens')
          .insert({
            lancamento_id: lancamento.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            motivo: item.motivo,
            fotos: fotosUrls
          })
          .select()
          .single();
        
        if (itemError) {
          console.error('Erro ao inserir item:', itemError);
          throw itemError;
        }
        
        itensProcessados.push(itemData);
      } catch (itemError) {
        console.error('Erro no processamento do item:', itemError);
        // Continuar processando outros itens, mas registrando o erro
      }
    }
    
    return {
      lancamento,
      itens: itensProcessados,
      error: null
    };
    
  } catch (error) {
    console.error('Erro ao finalizar lançamento:', error);
    return {
      lancamento: null,
      itens: [],
      error
    };
  }
};

/**
 * Obtém os lançamentos do usuário
 * 
 * @param usuarioId ID do usuário
 * @returns Lista de lançamentos do usuário
 */
export const obterLancamentosUsuario = async (usuarioId: string) => {
  try {
    const { data, error } = await supabase
      .from('lancamentos')
      .select(`
        *,
        itens (*)
      `)
      .eq('usuario_id', usuarioId)
      .order('data_hora', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao obter lançamentos:', error);
    return { data: null, error };
  }
};

/**
 * Obtém um lançamento específico com todos seus itens
 * 
 * @param lancamentoId ID do lançamento
 * @returns O lançamento com seus itens
 */
export const obterLancamentoDetalhado = async (lancamentoId: string) => {
  try {
    const { data, error } = await supabase
      .from('lancamentos')
      .select(`
        *,
        itens (
          *,
          produto:produtos (*)
        )
      `)
      .eq('id', lancamentoId)
      .single();
    
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao obter detalhes do lançamento:', error);
    return { data: null, error };
  }
}; 