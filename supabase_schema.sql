-- Criar extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de produtos
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  capacidade TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para busca por nome ou código
CREATE INDEX idx_produtos_nome_codigo ON produtos USING GIN (
  to_tsvector('portuguese', nome || ' ' || codigo)
);

-- Tabela de lançamentos
CREATE TABLE lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para lançamentos por usuário
CREATE INDEX idx_lancamentos_usuario ON lancamentos (usuario_id);

-- Tabela de itens
CREATE TABLE itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lancamento_id UUID NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  motivo TEXT NOT NULL,
  fotos TEXT[] DEFAULT '{}', -- Array de URLs das fotos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para itens
CREATE INDEX idx_itens_lancamento ON itens (lancamento_id);
CREATE INDEX idx_itens_produto ON itens (produto_id);

-- Função para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar o campo updated_at em todas as tabelas
CREATE TRIGGER set_updated_at_produtos
BEFORE UPDATE ON produtos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_lancamentos
BEFORE UPDATE ON lancamentos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_itens
BEFORE UPDATE ON itens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Inserir dados de exemplo para produtos
INSERT INTO produtos (nome, codigo, capacidade) VALUES
  ('Produto Teste 1', 'P001', '1L'),
  ('Produto Teste 2', 'P002', '2L'),
  ('Produto Teste 3', 'P003', '500ml'),
  ('Produto Teste 4', 'P004', '5L'),
  ('Produto Teste 5', 'P005', '10L');

-- Configurar permissões RLS (Row Level Security)

-- Habilitar RLS nas tabelas
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens ENABLE ROW LEVEL SECURITY;

-- Política para produtos: Todos podem ver, apenas admins podem modificar
CREATE POLICY "Produtos visíveis para todos"
  ON produtos FOR SELECT
  USING (true);

CREATE POLICY "Produtos gerenciados por admins"
  ON produtos FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role' OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'perfil' = 'admin'
  ));

-- Política para lançamentos: Usuários só veem os próprios, admins veem todos
CREATE POLICY "Usuários veem seus lançamentos"
  ON lancamentos FOR SELECT
  USING (
    auth.uid() = usuario_id OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'perfil' = 'admin'
    )
  );

CREATE POLICY "Usuários criam seus lançamentos"
  ON lancamentos FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários atualizam seus lançamentos pendentes"
  ON lancamentos FOR UPDATE
  USING (
    auth.uid() = usuario_id AND
    status = 'pendente'
  );

CREATE POLICY "Admins gerenciam todos lançamentos"
  ON lancamentos FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'perfil' = 'admin'
    )
  );

-- Política para itens: Baseada na relação com lançamentos
CREATE POLICY "Itens visíveis através dos lançamentos"
  ON itens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lancamentos
      WHERE lancamentos.id = itens.lancamento_id
      AND (
        lancamentos.usuario_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM auth.users
          WHERE id = auth.uid()
          AND raw_user_meta_data->>'perfil' = 'admin'
        )
      )
    )
  );

CREATE POLICY "Usuários criam itens para seus lançamentos"
  ON itens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lancamentos
      WHERE lancamentos.id = itens.lancamento_id
      AND lancamentos.usuario_id = auth.uid()
      AND lancamentos.status = 'pendente'
    )
  );

CREATE POLICY "Admins gerenciam todos itens"
  ON itens FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'perfil' = 'admin'
    )
  ); 