import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Copy, PiggyBank, Plus, Split, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Card, CardTitle, Money, cx, inputCls } from '../components/kit'
import { Dropdown } from '../components/Dropdown'
import { MoneyInput } from '../components/MoneyInput'
import { MESES, addMeses, corDoDestino, fmt, hoje, investimentosResumo, mesAtual, mesCurto, metaDoDestino, salarioFixo } from '../lib/finance'
import { num } from '../lib/model'
import type { Investimento, Model } from '../lib/model'
import type { Cell, Row } from '../lib/google'
import type { Finance } from '../lib/store'

function useCores(model: Model) {
  return useMemo(() => (d: string) => corDoDestino(model, d), [model])
}

const somar = (xs: { valor: number }[]) => xs.reduce((a, x) => a + x.valor, 0)
const mesDoAno = (ano: number, i: number) => `${ano}-${String(i + 1).padStart(2, '0')}`

export function Investimentos({ model, mes, setMes, finance }: { model: Model; mes: string; setMes: (m: string) => void; finance: Finance }) {
  const [ano, setAno] = useState(Number(mes.slice(0, 4)))
  useEffect(() => setAno(Number(mes.slice(0, 4))), [mes])
  const cor = useCores(model)

  const doMes = model.investimentos.filter((i) => i.mes_ref === mes)
  const investidoMes = somar(doMes)
  const salario = salarioFixo(model, mes)
  const meta = salario * model.limites.investimento
  const pctMeta = meta > 0 ? investidoMes / meta : null

  const porMes = useMemo(() => MESES.map((_, i) => somar(model.investimentos.filter((x) => x.mes_ref === mesDoAno(ano, i)))), [model, ano])
  const totalAno = porMes.reduce((a, b) => a + b, 0)
  const atual = mesAtual()
  const mesesNoAno = ano < Number(atual.slice(0, 4)) ? 12 : ano > Number(atual.slice(0, 4)) ? 0 : Number(atual.slice(5, 7))
  const media = mesesNoAno ? porMes.slice(0, mesesNoAno).reduce((a, b) => a + b, 0) / mesesNoAno : 0
  const acumulado = investimentosResumo(model, mes)

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-5 [&>:first-child]:col-span-2 sm:[&>:first-child]:col-span-1">
        <Resumo
          titulo={`Investido em ${mesCurto(mes)}`}
          valor={investidoMes}
          detalhe={pctMeta === null ? `${doMes.length} movimentos` : `${Math.round(pctMeta * 100)}% da meta`}
          tom={pctMeta === null ? 'primary' : pctMeta >= 1 ? 'good' : 'warn'}
        />
        <Resumo titulo={`Total em ${ano}`} valor={totalAno} detalhe={mesesNoAno ? `média ${fmt(media)}/mês` : 'ano futuro'} />
        <Resumo titulo={`Acumulado até ${mesCurto(mes)}`} valor={acumulado.total} detalhe={`${acumulado.destinos.filter((d) => d.valor).length} destinos`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-5">
        <EditorMes key={`${mes}|${doMes.map((i) => `${i.id}:${i.valor}:${i.destino}:${i.descricao}`).join(',')}`} model={model} mes={mes} itens={doMes} meta={meta} finance={finance} cor={cor} />
        <div className="space-y-4 lg:col-span-2 lg:space-y-5">
          <Destinos model={model} mes={mes} cor={cor} />
          <Divisao key={JSON.stringify(model.divisao)} model={model} finance={finance} cor={cor} />
        </div>
      </div>

      <PorMes model={model} ano={ano} setAno={setAno} mes={mes} setMes={setMes} porMes={porMes} meta={meta} media={media} cor={cor} />
    </div>
  )
}

function Resumo({ titulo, valor, detalhe, tom }: { titulo: string; valor: number; detalhe: string; tom?: 'primary' | 'warn' | 'good' }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-medium text-muted">
        <span>{titulo}</span>
        <span
          className={cx(
            'rounded-full px-2 py-0.5 text-[11px] tabular-nums',
            tom === 'warn' ? 'bg-warn-soft text-warn' : tom === 'good' ? 'bg-good-soft text-good' : 'bg-soft',
          )}
        >
          {detalhe}
        </span>
      </div>
      <Money value={valor} className={cx('text-xl sm:text-2xl', tom && 'text-primary')} />
    </div>
  )
}

// ---------- ajustar o mês ----------

interface Linha {
  key: string
  row?: Row
  destino: string
  valor: string
  resgate: boolean
  descricao: string
}

const paraLinha = (i: Investimento, comRow = true): Linha => ({
  key: comRow ? i.id : `n${Math.random()}`,
  row: comRow ? i.row : undefined,
  destino: i.destino,
  valor: i.valor ? fmt(Math.abs(i.valor)) : '',
  resgate: i.valor < 0,
  descricao: i.descricao,
})
const valorDe = (l: Linha) => (l.resgate ? -1 : 1) * num(l.valor)

function EditorMes({
  model,
  mes,
  itens,
  meta,
  finance,
  cor,
}: {
  model: Model
  mes: string
  itens: Investimento[]
  meta: number
  finance: Finance
  cor: (d: string) => string
}) {
  const inicial = useMemo(() => itens.map((i) => paraLinha(i)), [itens])
  const [linhas, setLinhas] = useState<Linha[]>(inicial)
  const anterior = model.investimentos.filter((i) => i.mes_ref === addMeses(mes, -1))

  const set = (key: string, campos: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...campos } : l)))
  const nova = () => {
    const usados = new Set(linhas.map((l) => l.destino))
    const destino = model.destinos.find((d) => !usados.has(d)) ?? model.destinos[0] ?? 'Outros'
    setLinhas((ls) => [...ls, { key: `n${Math.random()}`, destino, valor: '', resgate: false, descricao: '' }])
  }

  // o que mudou em relação à planilha
  const original = new Map(inicial.map((l) => [l.key, l]))
  const validas = linhas.filter((l) => num(l.valor) > 0)
  const alterar = validas
    .filter((l) => l.row)
    .filter((l) => {
      const o = original.get(l.key)!
      return o.destino !== l.destino || valorDe(o) !== valorDe(l) || o.descricao !== l.descricao.trim()
    })
    .map((l) => ({ row: l.row!, patch: { destino: l.destino, valor: valorDe(l), descricao: l.descricao.trim() } as Record<string, Cell> }))
  const novos = validas.filter((l) => !l.row).map((l) => ({ mes_ref: mes, data: hoje(), destino: l.destino, valor: valorDe(l), descricao: l.descricao.trim() }))
  const manter = new Set(validas.filter((l) => l.row).map((l) => l.key))
  const remover = inicial.filter((l) => !manter.has(l.key)).map((l) => l.row!)
  const mudou = alterar.length + novos.length + remover.length > 0

  const total = linhas.reduce((a, l) => a + valorDe(l), 0)
  // aplica a divisão: os aportes viram uma linha por destino; resgates ficam como estão
  const dividir = (valor: number) => {
    const partes = partesDaDivisao(model.divisao, valor)
    setLinhas((ls) => {
      const resgates = ls.filter((l) => l.resgate)
      const aportes = ls.filter((l) => !l.resgate)
      const novas = partes.map(({ destino, valor: v }) => {
        const existente = aportes.find((l) => l.destino === destino)
        return { ...(existente ?? { key: `n${Math.random()}`, descricao: '', resgate: false }), destino, valor: fmt(v) }
      })
      return [...novas, ...resgates]
    })
  }
  const salvar = async () => {
    await finance.actions.salvarInvestimentosMes({ alterar, novos, remover })
  }

  return (
    <Card className="lg:col-span-3">
      <CardTitle icon={<PiggyBank size={18} />} extra={<Money value={total} className="text-lg" tone={total < 0 ? 'bad' : 'default'} />}>
        Investido em {mesCurto(mes)}
      </CardTitle>

      {meta > 0 && (
        <div className="mb-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-soft">
            <div className={cx('h-full rounded-full transition-all', total >= meta ? 'bg-good' : 'bg-primary')} style={{ width: `${Math.max(0, Math.min(100, (total / meta) * 100))}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>
              Meta do mês <b className="font-semibold text-ink tabular-nums">{fmt(meta)}</b>
            </span>
            <span className="tabular-nums">{total >= meta ? 'meta batida' : `faltam ${fmt(meta - total)}`}</span>
          </div>
        </div>
      )}

      {somaDivisao(model.divisao) === 100 && (
        <DividirValor key={mes} sugestao={Math.max(total, meta)} divisao={model.divisao} cor={cor} onAplicar={dividir} />
      )}

      {linhas.length === 0 ? (
        <div className="rounded-2xl bg-soft px-4 py-7 text-center text-sm text-muted">
          Nada investido neste mês.
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button onClick={nova}>
              <Plus size={16} /> Adicionar
            </Button>
            {anterior.length > 0 && (
              <Button variant="ghost" onClick={() => setLinhas(anterior.map((i) => paraLinha(i, false)))}>
                <Copy size={15} /> Repetir {mesCurto(addMeses(mes, -1))} ({fmt(somar(anterior))})
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* uma grade só para cabeçalho e linhas: as colunas ficam alinhadas e o "Tipo" ocupa o que precisa */}
          <ul className="space-y-2 sm:grid sm:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)_2rem] sm:gap-2 sm:space-y-0">
            <li className="hidden px-1 text-[11px] font-medium text-faint sm:col-span-4 sm:grid sm:grid-cols-subgrid" aria-hidden>
            <span>Destino</span>
            <span>Tipo</span>
            <span>Valor</span>
            </li>
            {linhas.map((l) => (
              <li
                key={l.key}
                className="grid grid-cols-[auto_minmax(0,1fr)_2.25rem] items-center gap-2 rounded-2xl border border-line p-2 sm:col-span-4 sm:grid-cols-subgrid sm:border-0 sm:p-0"
              >
                <div className="order-1 col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor(l.destino) }} aria-hidden />
                  <Dropdown
                    className="min-w-0 flex-1"
                    value={l.destino}
                    onChange={(v) => set(l.key, { destino: v })}
                    opcoes={[...new Set([...model.destinos, l.destino])].map((d) => ({ value: d, label: d }))}
                  />
                </div>
                <div className="order-3 sm:order-2">
                  <TipoMov resgate={l.resgate} onChange={(resgate) => set(l.key, { resgate })} />
                </div>
                <button
                  type="button"
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.key !== l.key))}
                  className="order-2 flex size-9 items-center justify-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad sm:order-4 sm:size-8"
                  aria-label={`Remover ${l.destino}`}
                  title="Remover"
                >
                  <Trash2 size={15} />
                </button>
                <div className="order-4 col-span-2 sm:order-3 sm:col-span-1">
                  <MoneyInput value={l.valor} onChange={(valor) => set(l.key, { valor })} />
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={nova} className="mt-3 flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-primary hover:underline">
            <Plus size={15} /> Adicionar destino
          </button>
        </>
      )}

      {(mudou || linhas.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
          <span className="mr-auto text-xs text-muted">{mudou ? 'Alterações ainda não salvas.' : 'Tudo salvo na planilha.'}</span>
          {mudou && (
            <Button variant="ghost" onClick={() => setLinhas(inicial)} disabled={finance.busy}>
              <Undo2 size={15} /> Desfazer
            </Button>
          )}
          <Button variant="primary" onClick={() => void salvar()} disabled={!mudou || finance.busy}>
            Salvar
          </Button>
        </div>
      )}
    </Card>
  )
}

/** Aporte (entra) ou resgate (sai) — dois botões em vez de digitar valor negativo. */
function TipoMov({ resgate, onChange }: { resgate: boolean; onChange: (r: boolean) => void }) {
  const opc = (r: boolean, label: string, icone: ReactNode) => (
    <button
      type="button"
      onClick={() => onChange(r)}
      aria-pressed={resgate === r}
      className={cx(
        'flex items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
        resgate === r ? (r ? 'bg-card text-bad shadow-sm' : 'bg-card text-good shadow-sm') : 'text-muted hover:text-ink',
      )}
    >
      {icone}
      {label}
    </button>
  )
  return (
    <div className="grid shrink-0 grid-cols-2 rounded-xl bg-soft p-0.5" role="group" aria-label="Tipo de movimento">
      {opc(false, 'Aporte', <ArrowUpRight size={13} />)}
      {opc(true, 'Resgate', <ArrowDownLeft size={13} />)}
    </div>
  )
}

// ---------- divisão ----------

const somaDivisao = (d: Record<string, number>) => Math.round(Object.values(d).reduce((a, b) => a + b, 0) * 100) / 100

/** Reparte um valor pela divisão, em centavos; a sobra do arredondamento vai para o maior destino. */
function partesDaDivisao(divisao: Record<string, number>, valor: number) {
  const itens = Object.entries(divisao)
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
  const partes = itens.map(([destino, p]) => ({ destino, valor: Math.floor(valor * p) / 100 }))
  const sobra = Math.round((valor - partes.reduce((a, x) => a + x.valor, 0)) * 100) / 100
  if (partes.length && sobra) partes[0].valor = Math.round((partes[0].valor + sobra) * 100) / 100
  return partes
}

/** "Dividir R$ X" pela divisão, dentro do card do mês. */
function DividirValor({
  sugestao,
  divisao,
  cor,
  onAplicar,
}: {
  sugestao: number
  divisao: Record<string, number>
  cor: (d: string) => string
  onAplicar: (valor: number) => void
}) {
  const [valor, setValor] = useState(sugestao > 0 ? fmt(sugestao) : '')
  const v = num(valor)
  const partes = v > 0 ? partesDaDivisao(divisao, v) : []
  return (
    <div className="mb-4 rounded-2xl bg-soft/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Split size={15} className="text-primary" /> Dividir
        </span>
        <div className="w-36">
          <MoneyInput value={valor} onChange={setValor} />
        </div>
        <Button onClick={() => onAplicar(v)} disabled={!(v > 0)}>
          Aplicar
        </Button>
      </div>
      {partes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {partes.map((x) => (
            <span key={x.destino} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: cor(x.destino) }} aria-hidden />
              {x.destino} <b className="font-semibold text-ink tabular-nums">{fmt(x.valor)}</b>
              <span className="text-faint">{divisao[x.destino]}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Sugestões prontas, mostradas só se os destinos existirem. */
const MODELOS: { nome: string; pcts: Record<string, number> }[] = [
  { nome: '50 · 30 · 20', pcts: { Apartamento: 50, Emergência: 30, Carro: 20 } },
  { nome: '50 · 30 · 10 · 10', pcts: { Apartamento: 50, Emergência: 30, Carro: 10, Outros: 10 } },
]

function Divisao({ model, finance, cor }: { model: Model; finance: Finance; cor: (d: string) => string }) {
  const inicial = Object.fromEntries(model.destinos.map((d) => [d, model.divisao[d] ? String(model.divisao[d]).replace('.', ',') : '']))
  const [pcts, setPcts] = useState<Record<string, string>>(inicial)
  const numeros: Record<string, number> = Object.fromEntries(Object.entries(pcts).map(([d, p]) => [d, Number(p.replace(',', '.')) || 0]))
  const soma = somaDivisao(numeros)
  const mudou = model.destinos.some((d) => (numeros[d] || 0) !== (model.divisao[d] || 0))
  const modelos = MODELOS.filter((m) => Object.keys(m.pcts).every((d) => model.destinos.includes(d)))
  const usar = (m: Record<string, number>) => setPcts(Object.fromEntries(model.destinos.map((d) => [d, m[d] ? String(m[d]) : ''])))
  const ativo = (m: Record<string, number>) => model.destinos.every((d) => (numeros[d] || 0) === (m[d] || 0))
  const salvar = () => finance.actions.salvarDivisao(Object.fromEntries(Object.entries(numeros).filter(([, p]) => p > 0)))
  const r2 = (x: number) => Math.round(x * 100) / 100

  return (
    <Card>
      <CardTitle icon={<Split size={18} />}>Como dividir</CardTitle>
      {/* prévia da divisão */}
      <div className="mb-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-soft" aria-hidden>
        {model.destinos
          .filter((d) => numeros[d] > 0)
          .map((d) => (
            <div key={d} style={{ width: `${Math.min(numeros[d], 100)}%`, background: cor(d) }} />
          ))}
      </div>
      {modelos.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Modelos:</span>
          {modelos.map((m) => (
            <button
              key={m.nome}
              type="button"
              onClick={() => usar(m.pcts)}
              aria-pressed={ativo(m.pcts)}
              className={cx('rounded-full px-2.5 py-1 font-semibold tabular-nums', ativo(m.pcts) ? 'bg-primary-soft text-primary' : 'bg-soft text-muted hover:text-ink')}
            >
              {m.nome}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-2">
        {model.destinos.map((d) => (
          <li key={d} className="flex items-center gap-3">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor(d) }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{d}</span>
            <div className="relative w-24">
              <input
                inputMode="decimal"
                className={cx(inputCls, 'py-1.5 pr-7 text-right tabular-nums')}
                value={pcts[d] ?? ''}
                onChange={(e) => setPcts({ ...pcts, [d]: e.target.value.replace(/[^\d,.]/g, '') })}
                placeholder="0"
                aria-label={`% para ${d}`}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">%</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
        <span className={cx('mr-auto text-xs font-semibold tabular-nums', soma === 100 ? 'text-good' : soma === 0 ? 'text-muted' : 'text-warn')}>
          {soma === 100 ? 'Soma 100%' : soma === 0 ? 'Sem divisão' : soma < 100 ? `Soma ${soma}% · faltam ${r2(100 - soma)}%` : `Soma ${soma}% · passou ${r2(soma - 100)}%`}
        </span>
        {mudou && (
          <Button variant="ghost" onClick={() => setPcts(inicial)} disabled={finance.busy}>
            <Undo2 size={15} /> Desfazer
          </Button>
        )}
        <Button variant="primary" onClick={() => void salvar()} disabled={!mudou || finance.busy || (soma !== 100 && soma !== 0)}>
          Salvar
        </Button>
      </div>
    </Card>
  )
}

// ---------- onde está o dinheiro ----------

function Destinos({ model, mes, cor }: { model: Model; mes: string; cor: (d: string) => string }) {
  const { total, destinos } = investimentosResumo(model, mes)
  // destinos com meta aparecem mesmo zerados (0% da meta)
  const lista = [
    ...destinos,
    ...model.destinos.filter((d) => model.metas[d] && !destinos.some((x) => x.nome === d)).map((nome) => ({ nome, valor: 0 })),
  ]

  return (
    <Card>
      <CardTitle extra={<Money value={total} className="text-lg" />}>Onde está</CardTitle>
      {lista.length === 0 ? (
        <div className="rounded-2xl bg-soft px-4 py-8 text-center text-sm text-muted">Nenhum investimento até {mesCurto(mes)}.</div>
      ) : (
        <ul className="space-y-4">
          {lista.map((d) => {
            const meta = metaDoDestino(model, d.nome, mes)
            const pctMeta = meta ? Math.min(1, d.valor / meta) : 0
            const falta = meta ? Math.max(0, meta - d.valor) : 0
            const m = model.metas[d.nome]
            return (
              <li key={d.nome}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor(d.nome) }} aria-hidden />
                    <span className="truncate font-medium">{d.nome}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <b className="font-semibold">{fmt(d.valor)}</b>
                    {meta !== null && <span className="text-xs text-muted"> / {fmt(meta)}</span>}
                  </span>
                </div>

                {meta !== null && (
                  <>
                    {/* progresso até a meta */}
                    <div
                      className="h-2 overflow-hidden rounded-full bg-soft"
                      role="progressbar"
                      aria-valuenow={Math.round(pctMeta * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${d.nome}: ${Math.round(pctMeta * 100)}% da meta`}
                    >
                      <div className="h-full rounded-full" style={{ width: `${pctMeta * 100}%`, background: cor(d.nome) }} />
                    </div>
                    <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted tabular-nums">
                      <span className={cx(falta === 0 && 'font-semibold text-good')}>
                        {falta === 0 ? 'Meta atingida' : `${Math.round(pctMeta * 100)}% da meta${m?.meses ? ` (${String(m.meses).replace('.', ',')} salários)` : ''}`}
                      </span>
                      {falta > 0 && <span>faltam {fmt(falta)}</span>}
                    </div>
                  </>
                )}

                {meta === null && <div className="text-[11px] text-muted">Sem meta</div>}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
        Guardado até {mesCurto(mes)} (aportes menos resgates). Metas e destinos ficam em Configurações.
      </p>
    </Card>
  )
}

// ---------- mês a mês ----------

function PorMes({
  model,
  ano,
  setAno,
  mes,
  setMes,
  porMes,
  meta,
  media,
  cor,
}: {
  model: Model
  ano: number
  setAno: (a: number) => void
  mes: string
  setMes: (m: string) => void
  porMes: number[]
  meta: number
  media: number
  cor: (d: string) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [tabela, setTabela] = useState(false)
  const mesSel = Number(mes.slice(0, 4)) === ano ? Number(mes.slice(5, 7)) - 1 : -1
  const ativo = hover ?? (mesSel >= 0 ? mesSel : null)
  const referencia = meta > 0 ? meta : media
  const maior = Math.max(...porMes, referencia, 1)
  const total = porMes.reduce((a, b) => a + b, 0)

  const doAno = model.investimentos.filter((i) => i.mes_ref.startsWith(String(ano)))
  const destinosAno = [...new Set([...model.destinos.filter((d) => doAno.some((i) => i.destino === d)), ...doAno.map((i) => i.destino)])]
  const celula = (d: string, i: number) => somar(doAno.filter((x) => x.destino === d && x.mes_ref === mesDoAno(ano, i)))

  return (
    <Card>
      <CardTitle
        extra={
          <div className="flex items-center gap-0.5 rounded-xl bg-soft p-0.5">
            <button type="button" onClick={() => setAno(ano - 1)} className="rounded-lg p-1 text-muted hover:bg-card hover:text-ink" aria-label="Ano anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="w-11 text-center text-sm font-semibold tabular-nums">{ano}</span>
            <button type="button" onClick={() => setAno(ano + 1)} className="rounded-lg p-1 text-muted hover:bg-card hover:text-ink" aria-label="Próximo ano">
              <ChevronRight size={16} />
            </button>
          </div>
        }
      >
        Investido por mês
      </CardTitle>

      {total === 0 && doAno.length === 0 ? (
        <div className="rounded-2xl bg-soft px-4 py-8 text-center text-sm text-muted">Nenhum investimento em {ano}.</div>
      ) : (
        <>
          <div className="mb-2 flex h-5 items-baseline gap-2 text-xs">
            {ativo !== null ? (
              <>
                <span className="font-semibold text-ink">{MESES[ativo]}</span>
                <span className={cx('font-semibold tabular-nums', porMes[ativo] < 0 ? 'text-bad' : 'text-ink')}>
                  {porMes[ativo] < 0 ? '−' : ''}R$ {fmt(Math.abs(porMes[ativo]))}
                </span>
                <span className="truncate text-muted">
                  {destinosAno
                    .map((d) => [d, celula(d, ativo)] as const)
                    .filter(([, v]) => v)
                    .map(([d, v]) => `${d} ${v < 0 ? '−' : ''}${fmt(Math.abs(v))}`)
                    .join(' · ')}
                </span>
              </>
            ) : (
              <span className="text-muted">Toque num mês para ajustar.</span>
            )}
            {referencia > 0 && (
              <span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted">
                <span className="w-3 border-t-2 border-dashed border-faint" aria-hidden />
                {meta > 0 ? 'meta' : 'média'} {fmt(referencia)}
              </span>
            )}
          </div>

          <div className="relative h-40" onMouseLeave={() => setHover(null)}>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-line" aria-hidden />
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-line/60" aria-hidden />
            {referencia > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-faint/70"
                style={{ bottom: `${(referencia / maior) * 100}%` }}
                aria-hidden
              />
            )}
            <div className="absolute inset-0 grid grid-cols-12 gap-1 sm:gap-2">
              {porMes.map((v, i) => {
                const sel = i === mesSel
                const bateu = meta > 0 && v >= meta
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMes(mesDoAno(ano, i))}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${MESES[i]}: R$ ${fmt(v)}`}
                    aria-pressed={sel}
                    className={cx('relative flex h-full flex-col justify-end rounded-lg outline-none', sel ? 'bg-primary-soft/60' : 'hover:bg-soft focus-visible:bg-soft')}
                  >
                    <span
                      className={cx(
                        'mx-auto w-[60%] max-w-7 rounded-t-[4px] transition-opacity',
                        v < 0 ? 'bg-bad' : bateu ? 'bg-good' : 'bg-primary',
                        ativo !== null && ativo !== i && 'opacity-60',
                      )}
                      style={{ height: v > 0 ? `${(v / maior) * 100}%` : v < 0 ? 3 : 0 }}
                    />
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-12 gap-1 text-center text-[10px] sm:gap-2 sm:text-[11px]">
            {MESES.map((m, i) => (
              <span key={m} className={cx(i === mesSel ? 'font-bold text-primary' : mesDoAno(ano, i) > mesAtual() ? 'text-faint' : 'text-muted')}>
                {m.slice(0, 3)}
              </span>
            ))}
          </div>
          {meta > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-good" aria-hidden /> meta batida
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-primary" aria-hidden /> abaixo da meta
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-bad" aria-hidden /> mais resgate que aporte
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setTabela(!tabela)}
            aria-expanded={tabela}
            className="mt-4 flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
          >
            <ChevronDown size={14} className={cx('transition', tabela && 'rotate-180')} />
            {tabela ? 'Esconder tabela' : 'Ver tabela por destino'}
          </button>
          {tabela && (
            <div className="scroll-thin mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-right text-xs tabular-nums">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 text-left font-medium">Destino</th>
                    {MESES.map((m, i) => (
                      <th key={m} className={cx('px-1.5 py-1.5 font-medium', i === mesSel && 'text-primary')}>
                        {m.slice(0, 3)}
                      </th>
                    ))}
                    <th className="py-1.5 pl-3 font-semibold text-ink">Ano</th>
                  </tr>
                </thead>
                <tbody>
                  {destinosAno.map((d) => (
                    <tr key={d} className="border-t border-line">
                      <td className="py-1.5 pr-3 text-left font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ background: cor(d) }} aria-hidden />
                          {d}
                        </span>
                      </td>
                      {MESES.map((m, i) => {
                        const v = celula(d, i)
                        return (
                          <td key={m} className={cx('px-1.5 py-1.5', !v && 'text-faint', v < 0 && 'text-bad', i === mesSel && 'bg-primary-soft/40')}>
                            {v ? fmt(v) : '–'}
                          </td>
                        )
                      })}
                      <td className="py-1.5 pl-3 font-semibold">{fmt(somar(doAno.filter((x) => x.destino === d)))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line font-semibold">
                    <td className="py-1.5 pr-3 text-left">Total</td>
                    {porMes.map((v, i) => (
                      <td key={i} className={cx('px-1.5 py-1.5', !v && 'text-faint', i === mesSel && 'bg-primary-soft/40')}>
                        {v ? fmt(v) : '–'}
                      </td>
                    ))}
                    <td className="py-1.5 pl-3">{fmt(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
