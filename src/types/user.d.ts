/**
 * Tipo de perfil do usuário
 */
export type UserProfile = 'admin' | 'usuario';

/**
 * Interface que representa um usuário da aplicação
 */
export interface AppUser {
  /**
   * ID único do usuário
   */
  id: string;
  
  /**
   * E-mail do usuário (usado para login)
   */
  email: string;
  
  /**
   * Nome completo do usuário
   */
  nome: string;
  
  /**
   * Número de matrícula do usuário
   */
  matricula: string;
  
  /**
   * Perfil de acesso do usuário (admin ou usuário regular)
   */
  perfil: UserProfile;
} 