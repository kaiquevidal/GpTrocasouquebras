-- Criação da tabela de logs de ações do usuário
CREATE TABLE public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_acao TEXT NOT NULL, -- 'criar', 'editar', 'excluir', 'aprovar', 'rejeitar', 'exportar', etc.
    alvo_id TEXT NOT NULL,  -- ID do lançamento ou outro objeto alvo da ação
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    detalhes JSONB -- Detalhes adicionais opcionais
);

-- Comentários da tabela e colunas
COMMENT ON TABLE public.logs IS 'Registros de ações realizadas pelos usuários no sistema';
COMMENT ON COLUMN public.logs.usuario_id IS 'ID do usuário que realizou a ação';
COMMENT ON COLUMN public.logs.tipo_acao IS 'Tipo da ação realizada (criar, editar, excluir, etc.)';
COMMENT ON COLUMN public.logs.alvo_id IS 'ID do objeto alvo da ação (lançamento, usuário, etc.)';
COMMENT ON COLUMN public.logs.data_hora IS 'Data e hora em que a ação foi realizada';
COMMENT ON COLUMN public.logs.detalhes IS 'Detalhes adicionais sobre a ação em formato JSON';

-- Índices para melhor desempenho nas consultas
CREATE INDEX idx_logs_usuario_id ON public.logs(usuario_id);
CREATE INDEX idx_logs_tipo_acao ON public.logs(tipo_acao);
CREATE INDEX idx_logs_data_hora ON public.logs(data_hora);

-- RLS: Apenas o próprio usuário e administradores podem ver os logs
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Política para leitura: usuários regulares veem apenas seus próprios logs, admins veem todos
CREATE POLICY "Usuários podem ver seus próprios logs" 
    ON public.logs FOR SELECT 
    USING (
        auth.uid() = usuario_id OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id AND raw_user_meta_data->>'perfil' = 'admin'
        )
    );

-- Política para inserção: qualquer usuário autenticado pode criar logs
CREATE POLICY "Usuários autenticados podem registrar logs" 
    ON public.logs FOR INSERT 
    WITH CHECK (auth.uid() = usuario_id); 