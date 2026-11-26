import { ArrowLeft, FastForward } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { brl, dividirParcelas, fmt, hoje, mesCurto } from '../lib/finance'
import { num } from '../lib/model'
import type { Lancamento } from '../lib/model'
import type { Finance, ItemSalvar } from '../lib/store'
import { Button, Field, cx, inputCls } from './kit'
import { MoneyInput } from './MoneyInput'
import { DatePicker, MonthPicker } from './pickers'

/**
 * Adiantar parcelas: as ÚLTIMAS parcelas da compra passam para o mês escolhido (com o valor que foi pago,
 * que pode ter desconto). A compra termina antes e o "faltam N" de cada parcela é recalculado.
 */
export function AdiantarParcelas({
  parcela: l,
  serie,
  finance,
  onVoltar,
  onClose,
}: {
  parcela: Lancamento
  /** todas as parcelas da compra, em ordem de mês */
  serie: Lancamento[]
  finance: Finance
  onVoltar: () => void
  onClose: () => void
}) {
  const [mes, setMes] = useState(l.mes_ref)
  const [qtdTxt, setQtdTxt] = useState('1')
  const [valorTxt, setValorTxt] = useState<string | null>(null) // null = usar a soma das parcelas
  const [data, setData] = useState(hoje())
  const [err, setErr] = useState<string | null>(null)

  const disponiveis = serie.filter((x) => x.mes_ref > mes)
  const max = disponiveis.length
  const qtd = Math.min(max, Math.max(1, Math.round(num(qtdTxt)) || 1))
  const movidas = max ? disponiveis.slice(-qtd) : []
  const soma = movidas.reduce((a, x) => a + x.valor, 0)
  const valorPago = valorTxt === null ? soma : num(valorTxt)
  const desconto = soma - valorPago

  const ids = new Set(movidas.map((x) => x.id))
  const novoMes = (x: Lancamento) => (ids.has(x.id) ? mes : x.mes_ref)
  const mesesDepois = [...new Set(serie.map(novoMes))].sort()
  const fimAntes = serie[serie.length - 1]?.mes_ref
  const fimDepois = mesesDepois[mesesDepois.length - 1]
  const noMes = serie.filter((x) => novoMes(x) === mes)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!max) return setErr('Não há parcelas depois deste mês para adiantar.')
    if (valorPago <= 0) return setErr('Informe o valor pago.')
    const valores = dividirParcelas(valorPago, movidas.length)
    const restantes = (m: string) => mesesDepois.filter((x) => x >= m).length
    // grava tudo que muda (e as parcelas estimadas, que passam a existir na planilha)
    const itens: ItemSalvar[] = serie
      .filter((x) => ids.has(x.id) || x.mes_ref >= mes || x.estimada)
      .map((x) => {
        const m = novoMes(x)
        const k = movidas.findIndex((y) => y.id === x.id)
        return {
          l: x,
          campos: { mes_ref: m, parcelas_restantes: restantes(m), ...(k >= 0 ? { valor: valores[k], data } : {}) },
        }
      })
    if (await finance.actions.editarLancamentos(itens)) onClose()
  }

  return (
    <form onSubmit={submit}>
      <div className="mb-5 flex items-center gap-2">
        <button type="button" onClick={onVoltar} className="rounded-full p-1.5 text-muted hover:bg-soft" aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-bold">Adiantar parcelas</h2>
          <p className="text-xs text-muted">
            {l.descricao} · {serie.length} parcelas até {mesCurto(fimAntes)}
          </p>
        </div>
      </div>

      {max === 0 ? (
        <div className="rounded-xl bg-soft px-3 py-3 text-sm text-muted">Esta já é a última parcela; não há o que adiantar.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={`Quantas parcelas (até ${max})`}>
              <input type="number" min={1} max={max} className={inputCls} value={qtdTxt} onChange={(e) => setQtdTxt(e.target.value)} />
            </Field>
            <Field label="Pagas no mês">
              <MonthPicker value={mes} onChange={setMes} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Valor pago">
              <MoneyInput value={valorTxt ?? fmt(soma)} onChange={setValorTxt} />
            </Field>
            <Field label="Data do pagamento">
              <DatePicker value={data} onChange={setData} />
            </Field>
          </div>

          <div className="rounded-2xl border border-line p-3 text-xs">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">Como fica</span>
              {desconto > 0.004 && <span className="rounded-full bg-good-soft px-2 py-0.5 font-semibold text-good">desconto de {brl(desconto)}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {mesesDepois
                .filter((m) => m >= mes)
                .map((m) => {
                  const n = serie.filter((x) => novoMes(x) === m).length
                  return (
                    <span
                      key={m}
                      className={cx('rounded-lg px-2 py-1 text-[11px] font-medium', m === mes ? 'bg-primary text-white' : 'bg-soft text-muted')}
                    >
                      {mesCurto(m)}
                      {n > 1 && ` · ${n} parcelas`}
                    </span>
                  )
                })}
            </div>
            <p className="mt-2.5 text-muted">
              As {movidas.length === 1 ? 'última parcela' : `últimas ${movidas.length} parcelas`} ({movidas.map((x) => mesCurto(x.mes_ref)).join(', ')})
              {' '}passam para <b className="text-ink">{mesCurto(mes)}</b>, que fica com {noMes.length} parcelas. A compra termina em{' '}
              <b className="text-ink">{mesCurto(fimDepois)}</b>
              {fimDepois !== fimAntes && <> em vez de {mesCurto(fimAntes)}</>}.
            </p>
          </div>
        </div>
      )}

      {(err || finance.error) && <div className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err || finance.error}</div>}
      <div className="sheet-footer mt-6 flex justify-end gap-2">
        <Button onClick={onVoltar}>Voltar</Button>
        {max > 0 && (
          <Button type="submit" variant="primary" disabled={finance.busy}>
            <FastForward size={16} /> {finance.busy ? 'Salvando…' : `Adiantar ${movidas.length}`}
          </Button>
        )}
      </div>
    </form>
  )
}
