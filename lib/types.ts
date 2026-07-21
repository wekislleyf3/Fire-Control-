// Mantido por compatibilidade: código existente que importa de "@/lib/types"
// continua funcionando. Novos arquivos devem importar direto de "@/types/*".
export type { Cliente, ClienteInput, ClienteStatus } from "@/types/cliente";
export type { Equipamento, EquipamentoInput, EquipamentoStatus } from "@/types/equipamento";
export type { Documento, DocumentoInput } from "@/types/documento";
export type { Inspecao, InspecaoInput } from "@/types/inspecao";
export type { Profile, Empresa, Role } from "@/types/auth";
