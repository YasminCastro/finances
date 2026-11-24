export type AddKind = 'gasto' | 'parcelado' | 'fixo' | 'entrada' | 'investimento' | 'receber'

export const ADD_KINDS: { id: AddKind; label: string }[] = [
  { id: 'gasto', label: 'Gasto' },
  { id: 'parcelado', label: 'Compra parcelada' },
  { id: 'fixo', label: 'Conta fixa' },
  { id: 'entrada', label: 'Entrada' },
  { id: 'investimento', label: 'Investimento' },
  { id: 'receber', label: 'A receber' },
]
