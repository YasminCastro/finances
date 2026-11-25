import { cx, inputCls } from './kit'

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Formata o que foi digitado como moeda, preenchendo pelos centavos: "500000" → "5.000,00". */
export function mascaraMoeda(texto: string) {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13)
  if (!digitos) return ''
  return nf.format(Number(digitos) / 100)
}

/** Campo de valor em reais com máscara. O valor é a string formatada (ex.: "5.000,00"); use num() para converter. */
export function MoneyInput({
  value,
  onChange,
  placeholder = '0,00',
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">R$</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={cx(inputCls, 'pl-9 text-right tabular-nums')}
        value={value}
        onChange={(e) => onChange(mascaraMoeda(e.target.value))}
      />
    </div>
  )
}
