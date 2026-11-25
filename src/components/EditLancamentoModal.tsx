import { escFecha } from '@/lib/utils'
import { FastForward, HandCoins, Trash2, X } from 'lucide-react'
import { AdiantarParcelas } from './AdiantarParcelas'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { CUSTOS_CARRO, NAO_E_CARRO, addMeses, custoCarro, custoDeduzido, faturaDaCompra, fmt, formaDe, mesCurto } from '../lib/finance'
import { chaveParcela, num } from '../lib/model'
import type { Lancamento, Model } from '../lib/model'
import type { Cell } from '../lib/google'
import type { Finance, ItemSalvar } from '../lib/store'
import { Button, Field, cx, inputCls } from './kit'
import { Dropdown } from './Dropdown'
import { COBRANCA_VAZIA, CobrancaFields, montarCobranca } from './CobrancaFields'
import type { CobrancaForm } from './CobrancaFields'
import { DatePicker, MonthPicker } from './pickers'

/** Diferença em meses entre dois "AAAA-MM". */
function difMeses(de: string, ate: string) {
  const [a1, m1] = de.split('-').map(Number)
  const [a2, m2] = ate.split('-').map(Number)
  return (a2 - a1) * 12 + (m2 - m1)
}

const titulos: Record<string, string> = { gasto: 'Editar gasto', parcela: 'Editar parcela', fixo: 'Editar ajuste do fixo' }

export function EditLancamentoModal({
  lancamento: l,
  onClose,
  model,
  finance,
}: {
  lancamento: Lancamento
  onClose: () => void
  model: Model
  finance: Finance
}) {
  const [f, setF] = useState({
    descricao: l.descricao,
    valor: fmt(l.valor),
    data: l.data,
    mes_ref: l.mes_ref,
    categoria: l.categoria,
    forma_pagamento: l.forma_pagamento,
    carro: l.carro,
  })
  const [escopo, setEscopo] = useState<'esta' | 'proximas' | 'todas'>('esta')
  const [err, setErr] = useState<string | null>(null)
  const [apagar, setApagar] = useState(false)
  const [adiantar, setAdiantar] = useState(false)
  const [cobranca, setCobranca] = useState<CobrancaForm>(COBRANCA_VAZIA)
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // todas as parcelas da mesma compra (registradas e estimadas), em ordem
  const serie =
    l.tipo === 'parcela'
      ? model.lancamentos.filter((x) => x.tipo === 'parcela' && chaveParcela(x) === chaveParcela(l)).sort((a, b) => a.mes_ref.localeCompare(b.mes_ref))
      : []
  const proximas = serie.filter((x) => x.mes_ref >= l.mes_ref)
  const temAnteriores = serie.length > proximas.length
  // parcela estimada só pode ser excluída junto com as seguintes (senão ela voltaria a ser estimada)
  const todas = escopo === 'todas' && temAnteriores
  const lote = todas ? serie : proximas
  const emLote = (escopo !== 'esta' || (apagar && !!l.estimada)) && lote.length > 1

  // Gasto no cartão: sugere o mês da fatura quando a data ou a forma mudam.
  const fatura = l.tipo === 'gasto' && f.data ? faturaDaCompra(formaDe(model, f.forma_pagamento), f.data) : null
  const sugereFatura = fatura && fatura.mes_ref !== f.mes_ref

  const delta = difMeses(l.mes_ref, f.mes_ref)

  async function excluir() {
    const alvo = emLote ? lote : [l]
    const antes: ItemSalvar[] = []
    if (todas) {
      // apaga a compra inteira: sem linhas, não sobra parcela estimada
    } else if (emLote || l.estimada) {
      // a última parcela registrada antes desta passa a terminar no mês anterior (para não estimar as excluídas)
      const anterior = [...serie].reverse().find((x) => x.row && x.mes_ref < l.mes_ref)
      if (anterior) antes.push({ l: anterior, campos: { parcelas_restantes: difMeses(anterior.mes_ref, l.mes_ref) } })
    } else {
      // excluir só uma parcela registrada: as estimadas seguintes viram linhas, para continuarem existindo
      for (const x of proximas) if (x.estimada) antes.push({ l: x, campos: {} })
    }
    if (await finance.actions.excluirLancamentos(alvo, antes)) onClose()
  }

  /** Parcelas estimadas antes desta também são gravadas, para a sequência não ficar com buraco. */
  const estimadasAntes = () => serie.filter((x) => x.estimada && x.mes_ref < l.mes_ref).map((x) => ({ l: x, campos: {} }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    const valor = num(f.valor)
    if (!f.descricao.trim()) return setErr('Preencha a descrição.')
    if (!valor) return setErr('Informe um valor.')
    const comuns: Record<string, Cell> = {
      descricao: f.descricao.trim(),
      valor,
      categoria: f.categoria,
      forma_pagamento: f.forma_pagamento,
      carro: f.carro,
    }
    const itens = emLote
      ? lote.map((x) => ({
          l: x,
          campos: { ...comuns, mes_ref: addMeses(x.mes_ref, delta), ...(x.id === l.id ? { data: f.data } : {}) },
        }))
      : [{ l, campos: { ...comuns, mes_ref: f.mes_ref, data: f.data } }]
    // com "todas", as anteriores já estão no lote
    if (await finance.actions.editarLancamentos(todas ? itens : [...estimadasAntes(), ...itens])) onClose()
  }

  const opcoesEscopo = (
    [
      ['esta', 'Só esta', true],
      ['proximas', `Esta e as próximas (${proximas.length})`, proximas.length > 1],
      ['todas', `Todas (${serie.length})`, temAnteriores],
    ] as const
  ).filter((o) => o[2])
  const qtdLote = `${lote.length} parcelas`

  const podeAdiantar = l.tipo === 'parcela' && serie.some((x) => x.mes_ref > l.mes_ref)

  // cobrar de alguém: este lançamento, ou o lote escolhido (ex.: esta e as próximas parcelas)
  const ligadas = model.receber.filter((r) => r.origem === l.id)
  const alvoCobranca = emLote ? lote : [l]
  const totalCobranca = alvoCobranca.reduce((a, x) => a + x.valor, 0)
  async function cobrar() {
    setErr(null)
    const c = montarCobranca(cobranca, totalCobranca)
    if (typeof c === 'string') return setErr(c)
    if (!c) return
    if (await finance.actions.cobrarLancamentos(alvoCobranca, c)) onClose()
  }

  if (adiantar)
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        >
          <AdiantarParcelas parcela={l} serie={serie} finance={finance} onVoltar={() => setAdiantar(false)} onClose={onClose} />
        </div>
      </div>
    )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{l.tipo === 'fixo' && !l.fixo_id ? 'Editar conta fixa' : (titulos[l.tipo] ?? 'Editar lançamento')}</h2>
            {l.tipo === 'parcela' && l.parcelas_restantes ? (
              <p className="text-xs text-muted">
                {mesCurto(l.mes_ref)} · faltam {l.parcelas_restantes}
                {l.estimada && ' · estimada (ainda não está na planilha; ao salvar, ela é criada)'}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-soft" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {opcoesEscopo.length > 1 && (
            <div className={cx('grid gap-1 rounded-xl bg-soft p-1', opcoesEscopo.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
              {opcoesEscopo.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEscopo(id)}
                  className={cx(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    escopo === id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <Row>
            <Field label="Descrição">
              <input autoFocus className={inputCls} value={f.descricao} onChange={(e) => set('descricao')(e.target.value)} />
            </Field>
            <Field label={l.tipo === 'parcela' ? 'Valor da parcela' : 'Valor (R$)'}>
              <input inputMode="decimal" className={inputCls} placeholder="0,00" value={f.valor} onChange={(e) => set('valor')(e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Data">
              <DatePicker value={f.data} onChange={set('data')} />
            </Field>
            <Field label={emLote ? 'Mês desta parcela' : 'Mês de referência'}>
              <MonthPicker value={f.mes_ref} onChange={set('mes_ref')} />
            </Field>
          </Row>
          <Row>
            <Field label="Categoria">
              <Dropdown value={f.categoria} onChange={set('categoria')} opcoes={model.categorias.map((c) => ({ value: c.nome, label: c.nome, cor: c.cor }))} />
            </Field>
            <Field label="Forma de pagamento">
              <Dropdown
                value={f.forma_pagamento}
                onChange={set('forma_pagamento')}
                opcoes={model.formas.map((c) => ({ value: c.nome, label: c.nome, cor: c.cor || undefined }))}
              />
            </Field>
          </Row>
          {custoCarro({ ...f, carro: '' }) || f.carro ? (
            <Field label="Gasto do carro">
              <Dropdown
                value={f.carro}
                onChange={set('carro')}
                opcoes={[
                  custoCarro({ ...f, carro: '' })
                    ? { value: '', label: `Automático (${custoDeduzido(f)})` }
                    : { value: '', label: 'Não é do carro' },
                  ...CUSTOS_CARRO.map((c) => ({ value: c, label: c })),
                  ...(custoCarro({ ...f, carro: '' }) ? [{ value: NAO_E_CARRO, label: 'Não é do carro' }] : []),
                ]}
              />
            </Field>
          ) : (
            // gasto de outra categoria que também é do carro (ex.: peça comprada parcelada)
            <button type="button" onClick={() => set('carro')(custoDeduzido(f))} className="self-start text-xs font-semibold text-primary hover:underline">
              + Marcar como gasto do carro
            </button>
          )}

          {sugereFatura && (
            <div className="rounded-xl bg-soft px-3 py-2 text-xs text-muted">
              Pela data, este gasto cai na fatura <b className="text-ink">{f.forma_pagamento}</b> de <b className="text-ink">{mesCurto(fatura.mes_ref)}</b>.{' '}
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => set('mes_ref')(fatura.mes_ref)}>
                Usar {mesCurto(fatura.mes_ref)}
              </button>
            </div>
          )}
          {emLote && (
            <div className="rounded-xl bg-primary-soft px-3 py-2 text-xs text-primary">
              Descrição, valor, categoria e forma valem para {todas ? 'todas as' : 'as'} {qtdLote}
              {delta !== 0 && (
                <>
                  {' '}
                  e todas andam {Math.abs(delta)} {Math.abs(delta) === 1 ? 'mês' : 'meses'} {delta > 0 ? 'para frente' : 'para trás'} (de{' '}
                  {mesCurto(addMeses(lote[0].mes_ref, delta))} até {mesCurto(addMeses(lote[lote.length - 1].mes_ref, delta))})
                </>
              )}
              . A data muda só nesta.
            </div>
          )}

          {ligadas.length > 0 ? (
            <div className="rounded-2xl border border-line p-3 text-sm">
              <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
                <HandCoins size={15} className="text-primary" /> Cobrado de outra pessoa
              </div>
              {ligadas.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted">{r.pessoa}</span>
                  <span className="tabular-nums">
                    R$ {fmt(r.valor)} · <span className={r.recebido ? 'text-good' : 'text-warn'}>{r.recebido ? 'recebido' : 'pendente'}</span>
                  </span>
                </div>
              ))}
              <p className="mt-1.5 text-[11px] text-muted">Para mudar ou desfazer, use a página A receber.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <CobrancaFields
                model={model}
                value={cobranca}
                onChange={setCobranca}
                total={totalCobranca}
                parcelas={alvoCobranca.length}
              />
              {cobranca.ativo && (
                <div className="flex justify-end">
                  <Button variant="primary" disabled={finance.busy} onClick={cobrar}>
                    <HandCoins size={16} /> Criar cobrança
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {(err || finance.error) && <div className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err || finance.error}</div>}
        {apagar ? (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-bad/30 bg-bad-soft p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-bad">
              {todas
                ? `Excluir a compra inteira (${qtdLote})?`
                : emLote
                  ? `Excluir esta e as próximas (${qtdLote})?`
                  : 'Excluir este lançamento?'}
            </span>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setApagar(false)}>
                Voltar
              </Button>
              <Button variant="danger" disabled={finance.busy} onClick={excluir}>
                {finance.busy ? 'Excluindo…' : 'Excluir'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button variant="ghost" className="text-bad hover:bg-bad-soft hover:text-bad" onClick={() => setApagar(true)}>
                <Trash2 size={16} /> Excluir
              </Button>
              {podeAdiantar && (
                <Button variant="ghost" onClick={() => setAdiantar(true)} title="Pagar parcelas futuras neste mês">
                  <FastForward size={16} /> Adiantar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={onClose}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={finance.busy}>
                {finance.busy ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
}
