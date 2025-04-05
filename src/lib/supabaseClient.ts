// @ts-nocheck
// Cliente Supabase simulado já que a biblioteca não está instalada

const supabaseUrl = 'https://smbaudmxlbozoimwrjej.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYmF1ZG14bGJvem9pbXdyamVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4ODk5OTgsImV4cCI6MjA1OTQ2NTk5OH0.16Swt-YF4TPLxK1ZTePZNjy5L9l7JjPH9JfWCZjunYM';

// Criamos um cliente simulado que imita a API do Supabase
export const supabase = {
  auth: {
    signUp: async (params) => {
      console.log('Simulando registro:', params);
      return { data: { user: { id: 'simulado', email: params.email } }, error: null };
    },
    signInWithPassword: async (params) => {
      console.log('Simulando login:', params);
      return { data: { user: { id: 'simulado', email: params.email } }, error: null };
    },
    signOut: async () => {
      console.log('Simulando logout');
      return { error: null };
    },
    getUser: async () => {
      console.log('Obtendo usuário simulado');
      return { data: { user: { id: 'simulado', email: 'usuario@exemplo.com', user_metadata: { nome: 'Usuário Teste', matricula: '12345', perfil: 'usuario' } } }, error: null };
    }
  },
  from: (tableName) => {
    return {
      select: (columns) => {
        return {
          or: (condition) => {
            return {
              limit: (number) => {
                console.log(`Simulando consulta em ${tableName}: ${columns}, condição: ${condition}, limite: ${number}`);
                if (tableName === 'produtos') {
                  return { 
                    data: [
                      { id: '1', nome: 'Produto Teste 1', codigo: 'P001', preco: 19.99 },
                      { id: '2', nome: 'Produto Teste 2', codigo: 'P002', preco: 29.99 }
                    ], 
                    error: null 
                  };
                }
                return { data: [], error: null };
              }
            };
          }
        };
      }
    };
  }
}; 