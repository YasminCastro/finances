import { HandCoins } from 'lucide-react'
import { brl } from '../lib/finance'
import { num } from '../lib/model'
import type { Model } from '../lib/model'
import type { Cobranca } from '../lib/store'
import { Field, cx, inputCls } from './kit'
import { MoneyInput } from './MoneyInput'

export type Parte = 'tudo' | 'metade' | 'outro'
export interface CobrancaForm {
  ativo: boolean
  pessoa: string
  parte: Parte
  valor: string
}

export const COBRANCA_VAZIA: CobrancaForm = { ativo: false, pessoa: '', parte: 'tudo', valor: '' }

/** Pessoas já usadas em cobranças e rodízios (sugestões do campo). */
export function pessoasConhecidas(model: Model) {
  const eus = new Set(model.rodizios.map((r) => r.eu.toLowerCase()))
  const nomes = [...model.receber.map((r) => r.pessoa), ...model.rodizios.flatMap((r) => r.membros)].filter((n) => n && !eus.has(n.toLowerCase()))
  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Quanto a pessoa deve, a partir do formulário e do total da compra. */
export function valorDaCobranca(c: CobrancaForm, total: number) {
  if (c.parte === 'tudo') return total
  if (c.parte === 'metade') return Math.round(total * 50) / 100
  return num(c.valor)
}

/** Valida e monta a cobrança; devolve string com o erro, ou undefined quando não há cobrança. */
export function montarCobranca(c: CobrancaForm, total: number): Cobranca | string | undefined {
  if (!c.ativo) return undefined
  if (!c.pessoa.trim()) return 'Informe de quem cobrar.'
  const v = valorDaCobranca(c, total)
  if (!(v > 0)) return 'Informe quanto a pessoa te deve.'
  if (v > total + 0.001) return 'A parte da outra pessoa não pode ser maior que o valor da compra.'
  return { pessoa: c.pessoa.trim(), valor: v }
}

export function CobrancaFields({
  model,
  value,
  onChange,
  total,
  parcelas = 1,
}: {
  model: Model
  value: CobrancaForm
  onChange: (c: CobrancaForm) => void
  total: number
  parcelas?: number
}) {
  const set = (patch: Partial<CobrancaForm>) => onChange({ ...value, ...patch })
  const v = valorDaCobranca(value, total)
  const pessoas = pessoasConhecidas(model)

  return (
    <div className={cx('rounded-2xl border p-3 transition', value.ativo ? 'border-primary/40 bg-primary-soft/40' : 'border-line')}>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-(--color-primary)" checked={value.ativo} onChange={(e) => set({ ativo: e.target.checked })} />
        <span>
          <span className="flex items-center gap-1.5 font-semibold">
            <HandCoins size={15} className="text-primary" /> É de outra pessoa
          </span>
          <span className="block text-xs text-muted">Vira um item a receber, e nos seus limites conta só a sua parte.</span>
        </span>
      </label>

      {value.ativo && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Quem te deve">
              <input className={inputCls} list="cobranca-pessoas" value={value.pessoa} onChange={(e) => set({ pessoa: e.target.value })} placeholder="Nome" />
              <datalist id="cobranca-pessoas">
                {pessoas.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Parte da pessoa">
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1">
                {(
                  [
                    ['tudo', 'Tudo'],
                    ['metade', 'Metade'],
                    ['outro', 'Outro'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => set({ parte: id })}
                    className={cx('rounded-lg py-1.5 text-xs font-semibold', value.parte === id ? 'bg-card text-ink shadow-sm' : 'text-muted')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          {value.parte === 'outro' && (
            <Field label="Valor que a pessoa te deve">
              <MoneyInput value={value.valor} onChange={(x) => set({ valor: x })} />
            </Field>
          )}
          {total > 0 && v > 0 && (
            <p className="text-xs text-muted">
              {value.pessoa.trim() || 'A pessoa'} te deve <b className="text-ink">{brl(v)}</b>
              {parcelas > 1 && <> ({parcelas}× junto com as parcelas)</>}. Sua parte: <b className="text-ink">{brl(Math.max(0, total - v))}</b>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
