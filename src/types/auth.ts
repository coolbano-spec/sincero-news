export type TipoUsuario = "Leitor" | "Influenciador" | "Jornalista" | "Administrador";

export type PlanoAssinatura = "Mensal" | "Trimestral" | "Semestral" | "Anual" | "Vitalício";

export type StatusAssinatura = "Ativa" | "Expirada" | "Cancelada" | "Em análise";

export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  tipoUsuario: TipoUsuario;
  plano: PlanoAssinatura;
  statusAssinatura: StatusAssinatura;
  dataCompra: string;
  dataExpiracao: string;
  origemCadastro: string;
  dataCriacao: string;
  ultimoLogin: string;
}

export interface SimulatedEmail {
  id: string;
  email: string;
  nome: string;
  subject: string;
  body: string;
  link: string;
  sentAt: string;
}
