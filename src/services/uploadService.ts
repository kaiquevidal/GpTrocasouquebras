// @ts-nocheck
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabaseClient';

/**
 * Faz upload de múltiplos arquivos para o bucket 'fotos-lancamentos' no Supabase
 * 
 * @param files Array de arquivos (File[]) para upload
 * @param userId ID do usuário que está fazendo o upload
 * @returns Array de URLs públicas das imagens
 */
export const uploadFotos = async (files: File[], userId: string): Promise<string[]> => {
  try {
    if (!files || files.length === 0) {
      return [];
    }

    // Array para armazenar as URLs públicas
    const publicUrls: string[] = [];

    // Fazer upload de cada arquivo
    for (const file of files) {
      // Extrair a extensão do arquivo
      const fileExt = file.name.split('.').pop();
      
      // Gerar um nome único com UUID
      const fileName = `${uuidv4()}.${fileExt}`;
      
      // Definir o caminho do arquivo (organizado por usuário)
      const filePath = `${userId}/${fileName}`;
      
      // Fazer o upload do arquivo para o bucket
      const { error: uploadError } = await supabase.storage
        .from('fotos-lancamentos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        console.error('Erro ao fazer upload do arquivo:', uploadError);
        throw uploadError;
      }
      
      // Obter a URL pública da imagem
      const { data: urlData } = supabase.storage
        .from('fotos-lancamentos')
        .getPublicUrl(filePath);
      
      if (urlData?.publicUrl) {
        publicUrls.push(urlData.publicUrl);
      }
    }
    
    return publicUrls;
  } catch (error) {
    console.error('Erro no serviço de upload:', error);
    throw new Error('Falha ao fazer upload das fotos. Tente novamente.');
  }
}; 