# Sistema de Gestão de Quebras e Trocas

Um sistema web para gerenciamento de quebras e trocas de produtos, desenvolvido com React, TypeScript, Tailwind CSS e Supabase.

## Visão Geral

Este sistema permite que usuários registrem produtos quebrados ou trocados, incluindo fotos, quantidades e motivos. Os lançamentos são submetidos a um fluxo de aprovação por administradores, que podem aprovar ou rejeitar os registros.

## Funcionalidades

- **Autenticação de Usuários**: Cadastro e login com Supabase Auth
- **Registro de Quebras/Trocas**: Interface para registrar produtos quebrados ou trocados
- **Upload de Fotos**: Upload de imagens para documentar cada item
- **Histórico de Lançamentos**: Visualização do histórico de registros com status
- **Painel de Administração**: Interface para aprovação ou rejeição de lançamentos
- **Validação de Formulários**: Validação usando Zod e React Hook Form
- **Interface Responsiva**: Design adaptável para dispositivos móveis e desktop

## Tecnologias Utilizadas

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Storage, Auth)
- **Validação**: Zod, React Hook Form
- **Gerenciamento de Arquivos**: Supabase Storage, JSZip, File-Saver
- **Formatação de Data**: date-fns

## Estrutura do Projeto

```
src/
├── components/         # Componentes React
│   ├── HistoricoLancamentos.tsx
│   ├── LancamentoForm.tsx
│   ├── LancamentoFormValidado.tsx
│   └── Navbar.tsx
├── lib/                # Bibliotecas e clientes
│   └── supabaseClient.ts
├── pages/              # Páginas da aplicação
│   ├── Admin.tsx
│   ├── Home.tsx
│   ├── Login.tsx
│   └── Register.tsx
├── services/           # Serviços de integração
│   ├── authService.ts
│   ├── lancamentoService.ts
│   └── uploadService.ts
├── types/              # Definições de tipos TypeScript
│   └── user.d.ts
└── App.tsx             # Componente principal e rotas
```

## Requisitos

- Node.js (versão 14 ou superior)
- NPM ou Yarn
- Conta no Supabase para configuração do backend

## Instalação

1. Clone este repositório:
   ```bash
   git clone https://github.com/seu-usuario/quebras-trocas-app.git
   cd quebras-trocas-app
   ```

2. Instale as dependências:
   ```bash
   npm install
   # ou
   yarn install
   ```

3. Configure as variáveis de ambiente:
   - Crie um arquivo `.env.local` na raiz do projeto
   - Adicione suas credenciais do Supabase:
     ```
     REACT_APP_SUPABASE_URL=sua-url-do-supabase
     REACT_APP_SUPABASE_ANON_KEY=sua-chave-anonima-do-supabase
     ```

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm start
   # ou
   yarn start
   ```

## Configuração do Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com)

2. Execute o seguinte script SQL para configurar as tabelas:

```sql
-- Tabela de produtos
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL,
  capacidade TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de lançamentos
CREATE TABLE lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  observacoes_admin TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de itens
CREATE TABLE itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lancamento_id UUID NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  tipo_operacao TEXT NOT NULL,
  fotos TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar bucket para armazenamento de fotos
INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-lancamentos', 'fotos-lancamentos', true);

-- Políticas de Row Level Security (RLS)
-- Produtos: qualquer usuário autenticado pode ler
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Qualquer usuário autenticado pode ler produtos" ON produtos
FOR SELECT TO authenticated USING (true);

-- Lançamentos: usuários podem ler seus próprios lançamentos, admins podem ler todos
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem inserir lançamentos" ON lancamentos
FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Usuários podem ler seus próprios lançamentos" ON lancamentos
FOR SELECT TO authenticated USING (auth.uid() = usuario_id OR (
  SELECT user_metadata->>'perfil' FROM auth.users WHERE id = auth.uid()
) = 'admin');
CREATE POLICY "Admins podem atualizar qualquer lançamento" ON lancamentos
FOR UPDATE TO authenticated USING (
  (SELECT user_metadata->>'perfil' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Itens: usuários podem ler seus próprios itens, admins podem ler todos
ALTER TABLE itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem inserir itens" ON itens
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM lancamentos WHERE id = lancamento_id AND usuario_id = auth.uid())
);
CREATE POLICY "Usuários podem ler seus próprios itens" ON itens
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM lancamentos 
    WHERE id = lancamento_id AND (
      usuario_id = auth.uid() OR
      (SELECT user_metadata->>'perfil' FROM auth.users WHERE id = auth.uid()) = 'admin'
    )
  )
);

-- Storage: usuários podem fazer upload para suas próprias pastas
CREATE POLICY "Usuários podem fazer upload para suas próprias pastas" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'fotos-lancamentos' AND (
    storage.foldername(name)[1] = auth.uid()::text OR
    (SELECT user_metadata->>'perfil' FROM auth.users WHERE id = auth.uid()) = 'admin'
  )
);
CREATE POLICY "Qualquer usuário autenticado pode ler arquivos" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'fotos-lancamentos');
```

3. Configure autenticação:
   - Ative o provedor Email/Password
   - Opcional: Configure outros provedores de autenticação
   - Configure templates de email para recuperação de senha

## Permissões e Perfis de Usuário

O sistema possui dois níveis de acesso:

1. **Usuário**: Pode registrar quebras/trocas, visualizar seu histórico e atualizar seu perfil
2. **Admin**: Pode aprovar/rejeitar lançamentos, gerenciar produtos e usuários, visualizar todos os lançamentos

## Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua funcionalidade (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Faça um push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.
