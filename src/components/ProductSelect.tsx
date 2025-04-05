// @ts-nocheck
import { supabase } from '../lib/supabaseClient';

/**
 * Interface que representa um produto
 */
interface Produto {
  id: string;
  nome: string;
  codigo: string;
  preco: number;
}

/**
 * Props do componente ProductSelect
 */
interface ProductSelectProps {
  onSelect: (produto: Produto) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Componente de autocomplete para selecionar produtos
 * 
 * @param onSelect Função chamada quando um produto é selecionado
 * @param placeholder Texto de placeholder para o input
 * @param className Classes CSS adicionais
 */
export default function ProductSelect({ 
  onSelect, 
  placeholder = "Buscar produto por nome ou código...",
  className = ""
}: ProductSelectProps) {
  // Em uma implementação real, usaríamos os hooks do React:
  // const [query, setQuery] = useState('');
  // const [produtos, setProdutos] = useState<Produto[]>([]);
  // const [loading, setLoading] = useState(false);
  // const [isOpen, setIsOpen] = useState(false);

  /**
   * Função que seria chamada para buscar produtos no Supabase
   */
  const buscarProdutos = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      return [];
    }

    try {
      // Busca por nome ou código que contém o texto da consulta
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .or(`nome.ilike.%${searchQuery}%,codigo.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      return [];
    }
  };

  /**
   * Função chamada quando o usuário digita no campo de busca
   */
  const handleInputChange = (e) => {
    const value = e.target.value;
    console.log('Buscando produtos com o termo:', value);
    // Em uma implementação real:
    // setQuery(value);
    // if (value.length > 0) {
    //   setIsOpen(true);
    // } else {
    //   setIsOpen(false);
    // }
  };

  /**
   * Função chamada quando o usuário seleciona um produto
   */
  const handleSelectProduto = (produto) => {
    onSelect(produto);
    console.log('Produto selecionado:', produto);
    // Em uma implementação real:
    // setQuery(produto.nome);
    // setIsOpen(false);
  };

  // Este é um componente simulado para exemplificar a estrutura.
  // Em uma implementação real, retornaríamos JSX.
  console.log('Renderizando componente ProductSelect');
  
  return (
    <div>
      <p>Este é um componente simulado de seleção de produtos.</p>
      <p>Em uma implementação real, mostraria um campo de busca e uma lista de produtos.</p>
    </div>
  );
} 