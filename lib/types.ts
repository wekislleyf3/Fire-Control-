// Mantido por compatibilidade: código existente que importa de "@/lib/types"
// continua funcionando. Novos arquivos devem importar direto de "@/types/*".
export type { Cliente, ClienteInput, ClienteStatus, TipoPessoa } from "@/types/cliente";
export { enderecoCompleto } from "@/types/cliente";
export type { Equipamento, EquipamentoInput, EquipamentoStatus } from "@/types/equipamento";
export type { Documento, DocumentoInput } from "@/types/documento";
export type { Inspecao, InspecaoInput, ChecklistRespostas, ResultadoInspecao } from "@/types/inspecao";
export type { Profile, Empresa, Role } from "@/types/auth";
