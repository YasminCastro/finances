import { escFecha } from '@/lib/utils'
import {
  AlertTriangle,
  CalendarClock,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Ellipsis,
  FileText,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Siren,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button, Card, CardTitle, Field, Money, cx, inputCls } from '../components/kit'
import { Dropdown } from '../components/Dropdown'
import { MoneyInput } from '../components/MoneyInput'
import { DatePicker } from '../components/pickers'
import {
  CUSTOS_CARRO,
  MESES,
  NAO_E_CARRO,
  custoDeduzido,
  custosCarroAno,
  dataCurta,
  ehCategoriaCarro,
  faturaDaCompra,
  fmt,
  formaDe,
  hoje,
  lancamentosCarro,
  mesAtual,
  mesCurto,
} from '../lib/finance'
import type { CustoCarro } from '../lib/finance'
import { normData, num, somarMesesData } from '../lib/model'
import type { Model, Troca } from '../lib/model'
import type { Cell } from '../lib/google'
import type { Finance } from '../lib/store'

/** Cores fixas por tipo de custo (mesma ordem da planilha antiga). */
const COR_CUSTO: Record<CustoCarro, string> = {
  Combustível: '#d97706',
  Mecânico: '#6366f1',
  Documento: '#0d9488',
  Multa: '#e11d48',
  Estética: '#0284c7',
  Outros: '#94a3b8',
}

/** Categorias sugeridas para as trocas (somadas às que você já usou). */
const CATEGORIAS_TROCA = ['Arrefecimento', 'Bateria', 'Combustível', 'Elétrica', 'Freio', 'Ignição', 'Motor', 'Óleo', 'Pneu', 'Suspensão', 'Outros']

const fmtKm = (n: number) => `${n.toLocaleString('pt-BR')} km`
const anoCompleto = (d: string) => `${dataCurta(d)}/${d.slice(0, 4)}`
const diasAte = (d: string) => Math.round((new Date(`${d}T12:00`).getTime() - new Date(`${hoje()}T12:00`).getTime()) / 86_400_000)
/** "80.000", "80000 km" → 80000 */
const lerKm = (s: string) => {
  const n = Number(s.replace(/\D/g, ''))
  return n > 0 ? n : null
}

export function Carro({ model, mes, setMes, finance }: { model: Model; mes: string; setMes?: (m: string) => void; finance: Finance }) {
  const [ano, setAno] = useState(Number(mes.slice(0, 4)))
  const [troca, setTroca] = useState<Troca | 'nova' | null>(null)
  const [importar, setImportar] = useState(false)
  useEffect(() => setAno(Number(mes.slice(0, 4))), [mes])

  const custos = useMemo(() => custosCarroAno(model, ano), [model, ano])
  const doMes = useMemo(() => lancamentosCarro(model, mes), [model, mes])
  const totalMes = doMes.reduce((a, x) => a + x.l.valor, 0)

  // média: meses que já passaram no ano (o ano atual conta até o mês de hoje)
  const atual = mesAtual()
  const mesesNoAno = ano < Number(atual.slice(0, 4)) ? 12 : ano > Number(atual.slice(0, 4)) ? 0 : Number(atual.slice(5, 7))
  const media = mesesNoAno ? custos.porMes.slice(0, mesesNoAno).reduce((a, b) => a + b, 0) / mesesNoAno : 0
  const varMedia = media > 0 && Number(mes.slice(0, 4)) === ano ? totalMes / media - 1 : null

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-5 [&>:first-child]:col-span-2 sm:[&>:first-child]:col-span-1">
        <Resumo
          titulo={`Carro em ${mesCurto(mes)}`}
          valor={totalMes}
          detalhe={varMedia === null ? `${doMes.length} lançamentos` : `${varMedia >= 0 ? '+' : ''}${Math.round(varMedia * 100)}% da média`}
          tom={varMedia !== null && varMedia > 0.15 ? 'warn' : 'primary'}
        />
        <Resumo titulo={`Média por mês em ${ano}`} valor={media} detalhe={mesesNoAno ? `${mesesNoAno} ${mesesNoAno === 1 ? 'mês' : 'meses'}` : 'sem meses'} />
        <Resumo titulo={`Total em ${ano}`} valor={custos.total} detalhe={`${model.trocas.filter((t) => t.data.startsWith(String(ano))).length} trocas`} />
      </div>

      <DoMes model={model} mes={mes} itens={doMes} total={totalMes} finance={finance} />
      <CustosPorMes custos={custos} ano={ano} setAno={setAno} mes={mes} setMes={setMes} mesesNoAno={mesesNoAno} />
      <Trocas model={model} finance={finance} onNova={() => setTroca('nova')} onEditar={setTroca} onImportar={() => setImportar(true)} />

      {troca && <TrocaModal key={troca === 'nova' ? 'nova' : troca.id} model={model} troca={troca === 'nova' ? null : troca} finance={finance} onClose={() => setTroca(null)} />}
      {importar && <ImportarModal model={model} finance={finance} onClose={() => setImportar(false)} />}
    </div>
  )
}

function Resumo({ titulo, valor, detalhe, tom }: { titulo: string; valor: number; detalhe: string; tom?: 'primary' | 'warn' }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-medium text-muted">
        <span>{titulo}</span>
        <span className={cx('rounded-full px-2 py-0.5 text-[11px] tabular-nums', tom === 'warn' ? 'bg-warn-soft text-warn' : 'bg-soft')}>{detalhe}</span>
      </div>
      <Money value={valor} className={cx('text-xl sm:text-2xl', tom === 'primary' && 'text-primary')} />
    </div>
  )
}

// ---------- custos por mês (como a aba "Carro" da planilha antiga) ----------

type Custos = ReturnType<typeof custosCarroAno>

function CustosPorMes({
  custos,
  ano,
  setAno,
  mes,
  setMes,
  mesesNoAno,
}: {
  custos: Custos
  ano: number
  setAno: (a: number) => void
  mes: string
  setMes?: (m: string) => void
  mesesNoAno: number
}) {
  const [tabela, setTabela] = useState(false)
  const tipos = CUSTOS_CARRO.filter((c) => custos.porTipo[c].some((v) => v))
  const mesSel = Number(mes.slice(0, 4)) === ano ? Number(mes.slice(5, 7)) - 1 : -1
  const mediaDe = (xs: number[]) => (mesesNoAno ? xs.slice(0, mesesNoAno).reduce((x, y) => x + y, 0) / mesesNoAno : 0)
  const totalDe = (xs: number[]) => xs.reduce((x, y) => x + y, 0)

  return (
    <Card>
      <CardTitle
        icon={<Car size={18} />}
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
        Custo por mês
      </CardTitle>

      {custos.total === 0 ? (
        <div className="rounded-2xl bg-soft px-4 py-8 text-center text-sm text-muted">Nenhum gasto do carro em {ano}.</div>
      ) : (
        <>
          <Grafico custos={custos} tipos={tipos} ano={ano} mesSel={mesSel} media={mediaDe(custos.porMes)} setMes={setMes} />

          {/* resumo do ano por tipo: quanto, quanto por mês e a fatia do total */}
          <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-line pt-4 sm:grid-cols-2">
            {tipos
              .map((c) => ({ c, total: totalDe(custos.porTipo[c]), media: mediaDe(custos.porTipo[c]) }))
              .sort((x, y) => y.total - x.total)
              .map(({ c, total, media }) => (
                <li key={c} className="flex items-center gap-3">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in srgb, ${COR_CUSTO[c]} 14%, transparent)`, color: COR_CUSTO[c] }}
                    aria-hidden
                  >
                    {ICONE_CUSTO[c]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{c}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{fmt(total)}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
                        <span className="block h-full rounded-full" style={{ width: `${(total / custos.total) * 100}%`, background: COR_CUSTO[c] }} />
                      </span>
                      <span className="w-24 shrink-0 text-right text-[11px] text-muted tabular-nums">
                        {Math.round((total / custos.total) * 100)}% · {fmt(media)}/mês
                      </span>
                    </span>
                  </span>
                </li>
              ))}
          </ul>

          <button
            type="button"
            onClick={() => setTabela(!tabela)}
            aria-expanded={tabela}
            className="mt-4 flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
          >
            <ChevronDown size={14} className={cx('transition', tabela && 'rotate-180')} />
            {tabela ? 'Esconder tabela' : 'Ver tabela mês a mês'}
          </button>
          {tabela && <TabelaMeses custos={custos} tipos={tipos} mesSel={mesSel} mediaDe={mediaDe} />}
        </>
      )}
    </Card>
  )
}

/** Barras empilhadas por tipo, uma por mês; clicar escolhe o mês. */
function Grafico({
  custos,
  tipos,
  ano,
  mesSel,
  media,
  setMes,
}: {
  custos: Custos
  tipos: CustoCarro[]
  ano: number
  mesSel: number
  media: number
  setMes?: (m: string) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const maior = Math.max(...custos.porMes, media, 1)
  const ativo = hover ?? (mesSel >= 0 ? mesSel : null)
  const mesDe = (i: number) => `${ano}-${String(i + 1).padStart(2, '0')}`
  const futuro = (i: number) => mesDe(i) > mesAtual()

  return (
    <div>
      {/* legenda */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {tipos.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: COR_CUSTO[c] }} aria-hidden />
            {c}
          </span>
        ))}
        {media > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-faint" aria-hidden />
            média {fmt(media)}
          </span>
        )}
      </div>

      <div className="relative">
        {/* detalhe do mês sob o mouse (ou o mês escolhido) */}
        <div className="mb-2 flex h-5 items-baseline gap-2 text-xs">
          {ativo !== null && (
            <>
              <span className="font-semibold text-ink">{MESES[ativo]}</span>
              <span className="font-semibold text-ink tabular-nums">R$ {fmt(custos.porMes[ativo])}</span>
              <span className="truncate text-muted">
                {tipos
                  .filter((c) => custos.porTipo[c][ativo])
                  .map((c) => `${c} ${fmt(custos.porTipo[c][ativo])}`)
                  .join(' · ')}
              </span>
            </>
          )}
        </div>

        <div className="relative h-44" onMouseLeave={() => setHover(null)}>
          {/* grade discreta + média */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-line" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-line/60" aria-hidden />
          {media > 0 && (
            <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-faint/70" style={{ bottom: `${(media / maior) * 100}%` }} aria-hidden />
          )}

          <div className="absolute inset-0 grid grid-cols-12 gap-1 sm:gap-2">
            {custos.porMes.map((total, i) => {
              const sel = i === mesSel
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!setMes}
                  onClick={() => setMes?.(mesDe(i))}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${MESES[i]}: R$ ${fmt(total)}`}
                  aria-pressed={sel}
                  className={cx(
                    'group relative flex h-full flex-col justify-end rounded-lg outline-none disabled:cursor-default',
                    sel ? 'bg-primary-soft/60' : 'hover:bg-soft focus-visible:bg-soft',
                  )}
                >
                  {/* segmentos: o 1º tipo embaixo; 2px de folga entre eles; topo arredondado */}
                  <span
                    className={cx('mx-auto flex w-[60%] max-w-7 flex-col-reverse gap-[2px] transition-opacity', ativo !== null && ativo !== i && 'opacity-60')}
                    style={{ height: `${(total / maior) * 100}%` }}
                  >
                    {tipos
                      .filter((c) => custos.porTipo[c][i] > 0)
                      .map((c, k, arr) => (
                        <span
                          key={c}
                          className={cx('w-full', k === arr.length - 1 && 'rounded-t-[4px]')}
                          style={{ flexGrow: custos.porTipo[c][i], flexBasis: 0, minHeight: 2, background: COR_CUSTO[c] }}
                        />
                      ))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* meses */}
        <div className="mt-1.5 grid grid-cols-12 gap-1 text-center text-[10px] sm:gap-2 sm:text-[11px]">
          {MESES.map((m, i) => (
            <span key={m} className={cx(i === mesSel ? 'font-bold text-primary' : futuro(i) ? 'text-faint' : 'text-muted')}>
              {m.slice(0, 3)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A mesma informação em tabela (como na planilha antiga). */
function TabelaMeses({ custos, tipos, mesSel, mediaDe }: { custos: Custos; tipos: CustoCarro[]; mesSel: number; mediaDe: (xs: number[]) => number }) {
  const valor = (v: number) => (v ? fmt(v) : <span className="text-faint">–</span>)
  const linha = (nome: ReactNode, xs: number[], forte?: boolean) => (
    <tr className={cx(forte && 'font-semibold')}>
      <td className="sticky left-0 z-10 border-t border-line bg-card py-2 pr-3 whitespace-nowrap">{nome}</td>
      {xs.map((v, i) => (
        <td key={i} className={cx('border-t border-line px-2.5 py-2 text-right whitespace-nowrap', i === mesSel && 'bg-primary-soft/40')}>
          {valor(v)}
        </td>
      ))}
      <td className="border-t border-line px-2.5 py-2 text-right font-semibold whitespace-nowrap">{valor(xs.reduce((a, b) => a + b, 0))}</td>
      <td className="border-t border-line py-2 pl-2.5 text-right whitespace-nowrap text-muted">{valor(mediaDe(xs))}</td>
    </tr>
  )
  return (
    <div className="scroll-thin mt-3 overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0 text-xs tabular-nums sm:text-sm">
        <thead>
          <tr className="text-[11px] font-semibold text-muted uppercase">
            <th className="sticky left-0 z-10 bg-card py-2 pr-3 text-left">Tipo</th>
            {MESES.map((m, i) => (
              <th key={m} className={cx('px-2.5 py-2 text-right', i === mesSel && 'text-primary')}>
                {m.slice(0, 3)}
              </th>
            ))}
            <th className="px-2.5 py-2 text-right">Total</th>
            <th className="py-2 pl-2.5 text-right">Média</th>
          </tr>
        </thead>
        <tbody>
          {tipos.map((c) => (
            <Fragment key={c}>
              {linha(
                <>
                  <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: COR_CUSTO[c] }} aria-hidden />
                  {c}
                </>,
                custos.porTipo[c],
              )}
            </Fragment>
          ))}
          {linha('Total', custos.porMes, true)}
        </tbody>
      </table>
    </div>
  )
}

// ---------- lançamentos do carro no mês ----------

const ICONE_CUSTO: Record<CustoCarro, ReactNode> = {
  Combustível: <Fuel size={16} />,
  Mecânico: <Wrench size={16} />,
  Documento: <FileText size={16} />,
  Multa: <Siren size={16} />,
  Estética: <Sparkles size={16} />,
  Outros: <Ellipsis size={16} />,
}

function DoMes({
  model,
  mes,
  itens,
  total,
  finance,
}: {
  model: Model
  mes: string
  itens: ReturnType<typeof lancamentosCarro>
  total: number
  finance: Finance
}) {
  const tipar = (l: (typeof itens)[number]['l'], v: string) => finance.actions.editarLancamentos([{ l, campos: { carro: v } }])
  // quanto foi para cada tipo no mês (barra empilhada + legenda)
  const porTipo = CUSTOS_CARRO.map((c) => ({ c, v: itens.filter((x) => x.custo === c).reduce((a, x) => a + x.l.valor, 0) })).filter((x) => x.v > 0)
  const cats = model.categorias.filter((c) => ehCategoriaCarro(c.nome)).map((c) => c.nome)

  return (
    <Card>
      <CardTitle extra={<Money value={total} className="text-lg" />}>Gastos de {mesCurto(mes)}</CardTitle>
      {itens.length === 0 ? (
        <div className="rounded-2xl bg-soft px-4 py-8 text-center text-sm text-muted">Nenhum gasto do carro neste mês.</div>
      ) : (
        <>
          {/* para onde foi o dinheiro */}
          <div className="mb-4">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {porTipo.map(({ c, v }) => (
                <div key={c} style={{ width: `${(v / total) * 100}%`, background: COR_CUSTO[c] }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {porTipo.map(({ c, v }) => (
                <span key={c} className="flex items-center gap-1.5 text-muted">
                  <span className="size-2 rounded-full" style={{ background: COR_CUSTO[c] }} aria-hidden />
                  {c} <b className="font-semibold text-ink tabular-nums">{fmt(v)}</b>
                </span>
              ))}
            </div>
          </div>

          <ul className="-mx-2">
            {itens.map(({ l, custo }) => (
              <li key={l.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-soft/60">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `color-mix(in srgb, ${COR_CUSTO[custo]} 14%, transparent)`, color: COR_CUSTO[custo] }}
                  aria-hidden
                >
                  {ICONE_CUSTO[custo]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" title={l.descricao}>
                    {l.descricao}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                    <TipoCusto l={l} custo={custo} disabled={finance.busy || !l.row} onChange={(v) => void tipar(l, v)} />
                    <span className="truncate">
                      {[l.data && dataCurta(l.data), l.forma_pagamento].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{fmt(l.valor)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
        Entram as categorias {cats.join(' e ') || 'Carro e Combustível'}. Também entra o que tem “carro” na descrição. O tipo é deduzido; toque nele para trocar.
      </p>
    </Card>
  )
}

/** Etiqueta do tipo de custo; abre o mesmo dropdown do resto do app para trocar. */
function TipoCusto({
  l,
  custo,
  disabled,
  onChange,
}: {
  l: (ReturnType<typeof lancamentosCarro>)[number]['l']
  custo: CustoCarro
  disabled: boolean
  onChange: (v: string) => void
}) {
  const auto = custoDeduzido(l)
  return (
    <Dropdown
      semBusca
      disabled={disabled}
      value={l.carro}
      onChange={(v) => v !== l.carro && onChange(v)}
      className="shrink-0 rounded-full"
      opcoes={[
        { value: '', label: `Automático (${auto})`, cor: COR_CUSTO[auto] },
        ...CUSTOS_CARRO.map((c) => ({ value: c, label: c, cor: COR_CUSTO[c] })),
        { value: NAO_E_CARRO, label: 'Não é do carro' },
      ]}
      gatilho={() => (
        <span
          className={cx('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition', !disabled && 'hover:brightness-95')}
          style={{ background: `color-mix(in srgb, ${COR_CUSTO[custo]} 14%, transparent)`, color: COR_CUSTO[custo] }}
          title={!l.row ? (l.projetado ? 'Conta fixa prevista' : 'Parcela estimada') : l.carro ? 'Escolhido por você' : 'Deduzido pela descrição'}
        >
          {custo}
          {!disabled && <ChevronDown size={11} aria-hidden />}
        </span>
      )}
    />
  )
}

// ---------- trocas e manutenções ----------

function Trocas({
  model,
  finance,
  onNova,
  onEditar,
  onImportar,
}: {
  model: Model
  finance: Finance
  onNova: () => void
  onEditar: (t: Troca) => void
  onImportar: () => void
}) {
  const [filtro, setFiltro] = useState('')
  const [apagar, setApagar] = useState<string | null>(null)
  const trocas = model.trocas
  const categorias = [...new Set(trocas.map((t) => t.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const visiveis = filtro ? trocas.filter((t) => t.categoria === filtro) : trocas
  const anos = [...new Set(visiveis.map((t) => t.data.slice(0, 4) || 'Sem data'))]
  const ultimoKm = trocas.reduce((a, t) => Math.max(a, t.km ?? 0), 0) || null

  // próxima manutenção: só a da troca mais recente de cada item (uma troca nova substitui a anterior)
  const proximas = useMemo(() => {
    const vista = new Set<string>()
    const out: { t: Troca; dias: number | null; faltaKm: number | null; nivel: 'atrasada' | 'breve' | 'ok' }[] = []
    for (const t of trocas) {
      const k = t.item.trim().toLowerCase()
      if (vista.has(k)) continue
      vista.add(k)
      if (!t.proxima_data && !t.proxima_km) continue
      const dias = t.proxima_data ? diasAte(t.proxima_data) : null
      const faltaKm = t.proxima_km && ultimoKm ? t.proxima_km - ultimoKm : null
      const nivel = (dias ?? 1) < 0 || (faltaKm ?? 1) < 0 ? 'atrasada' : (dias ?? 999) <= 30 || (faltaKm ?? 9999) <= 1000 ? 'breve' : 'ok'
      out.push({ t, dias, faltaKm, nivel })
    }
    return out.sort((a, b) => (a.dias ?? 9999) - (b.dias ?? 9999))
  }, [trocas, ultimoKm])

  return (
    <Card>
      <CardTitle
        icon={<Wrench size={18} />}
        extra={
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" onClick={onImportar} title="Colar as linhas da planilha antiga">
              <ClipboardPaste size={15} /> <span className="hidden sm:inline">Colar da planilha</span>
            </Button>
            <Button variant="primary" onClick={onNova}>
              <Plus size={15} /> Registrar
            </Button>
          </div>
        }
      >
        Trocas e manutenções
      </CardTitle>

      {proximas.length > 0 && (
        <div className="mb-4 space-y-2">
          {proximas.map(({ t, dias, faltaKm, nivel }) => (
            <div
              key={t.id}
              className={cx(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm',
                nivel === 'atrasada' ? 'bg-bad-soft' : nivel === 'breve' ? 'bg-warn-soft' : 'bg-soft',
              )}
            >
              <span className={cx('shrink-0', nivel === 'atrasada' ? 'text-bad' : nivel === 'breve' ? 'text-warn' : 'text-muted')}>
                {nivel === 'ok' ? <CalendarClock size={17} /> : <AlertTriangle size={17} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Próxima troca: {t.item}</span>
                <span className="block text-xs text-muted">
                  {t.proxima_data && (
                    <>
                      {anoCompleto(t.proxima_data)} ·{' '}
                      {dias! < 0 ? `atrasada há ${-dias!} dias` : dias === 0 ? 'hoje' : `em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
                    </>
                  )}
                  {t.proxima_data && t.proxima_km ? ' · ' : ''}
                  {t.proxima_km && (
                    <>
                      aos {fmtKm(t.proxima_km)}
                      {faltaKm !== null && (faltaKm < 0 ? ` (passou ${fmtKm(-faltaKm)})` : ` (faltam ${fmtKm(faltaKm)})`)}
                    </>
                  )}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {trocas.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {['', ...categorias].map((c) => (
            <button
              key={c || 'todas'}
              type="button"
              onClick={() => setFiltro(c)}
              className={cx(
                'rounded-full px-2.5 py-1 text-xs font-semibold transition',
                filtro === c ? 'bg-primary text-white' : 'bg-soft text-muted hover:text-ink',
              )}
            >
              {c || 'Todas'}
            </button>
          ))}
          {ultimoKm && (
            <span className="ml-auto flex items-center gap-1 text-xs text-muted" title="Maior quilometragem registrada nas trocas">
              <Gauge size={13} /> {fmtKm(ultimoKm)}
            </span>
          )}
        </div>
      )}

      {trocas.length === 0 ? (
        <div className="rounded-2xl bg-soft px-4 py-8 text-center">
          <p className="text-sm font-medium text-ink">Nenhuma troca registrada</p>
          <p className="mt-1 text-xs text-muted">Registre o que trocou no carro, ou cole as linhas da sua planilha “Trocas Carro”.</p>
        </div>
      ) : (
        // a lista rola dentro do card (o ano fica preso no topo enquanto rola)
        <div className="scroll-thin -mr-2 max-h-[26rem] overflow-y-auto overscroll-contain pr-2">
        {anos.map((a) => (
          <div key={a}>
            <div className="sticky top-0 z-10 bg-card px-1 pt-2 pb-1 text-[11px] font-semibold text-faint uppercase">{a}</div>
            <ul className="divide-y divide-line">
              {visiveis
                .filter((t) => (t.data.slice(0, 4) || 'Sem data') === a)
                .map((t) => (
                  <li key={t.id} className="group flex items-start gap-3 py-2.5">
                    <span className="w-10 shrink-0 pt-0.5 text-xs text-faint tabular-nums">{t.data ? dataCurta(t.data) : '—'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium">{t.item}</span>
                        <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] text-muted">{t.categoria}</span>
                      </span>
                      {(t.observacao || t.km) && (
                        <span className="mt-0.5 block text-xs text-muted">
                          {t.km ? fmtKm(t.km) : ''}
                          {t.km && t.observacao ? ' · ' : ''}
                          {t.observacao}
                        </span>
                      )}
                    </span>
                    {apagar === t.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <Button variant="danger" className="px-2 py-1 text-xs" disabled={finance.busy} onClick={() => void finance.actions.excluirTroca(t.row)}>
                          Excluir
                        </Button>
                        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setApagar(null)}>
                          Não
                        </Button>
                      </span>
                    ) : (
                      <>
                        <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{t.custo ? fmt(t.custo) : <span className="text-faint">–</span>}</span>
                        <span className="flex shrink-0 gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                          <IconeBtn label={`Editar ${t.item}`} onClick={() => onEditar(t)}>
                            <Pencil size={14} />
                          </IconeBtn>
                          <IconeBtn label={`Excluir ${t.item}`} onClick={() => setApagar(t.id)}>
                            <Trash2 size={14} />
                          </IconeBtn>
                        </span>
                      </>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
        </div>
      )}
    </Card>
  )
}

function TrocaModal({ model, troca, finance, onClose }: { model: Model; troca: Troca | null; finance: Finance; onClose: () => void }) {
  const [f, setF] = useState({
    data: troca?.data || hoje(),
    item: troca?.item ?? '',
    categoria: troca?.categoria ?? '',
    observacao: troca?.observacao ?? '',
    km: troca?.km ? String(troca.km) : '',
    proxima_data: troca?.proxima_data ?? '',
    proxima_km: troca?.proxima_km ? String(troca.proxima_km) : '',
    custo: troca?.custo ? fmt(troca.custo) : '',
  })
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  const [err, setErr] = useState<string | null>(null)
  // lançar o custo também como gasto (só se ainda não estiver ligado a um lançamento)
  const podeLancar = !troca?.lancamento_id
  const [lancar, setLancar] = useState(false)
  const catCarro = model.categorias.find((c) => /^carro$/i.test(c.nome))?.nome ?? model.categorias.find((c) => ehCategoriaCarro(c.nome))?.nome
  const [categoria, setCategoria] = useState(catCarro ?? model.categorias[0]?.nome ?? '')
  const [forma, setForma] = useState(model.formas[0]?.nome ?? '')
  const custo = num(f.custo)
  const data = /^\d{4}-\d{2}-\d{2}$/.test(f.data) ? f.data : hoje()
  const fatura = faturaDaCompra(formaDe(model, forma), data)
  const mesLanc = fatura?.mes_ref ?? data.slice(0, 7)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sugestoes = [...new Set([...model.trocas.map((t) => t.categoria), ...CATEGORIAS_TROCA])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const itens = [...new Set(model.trocas.map((t) => t.item))]

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!f.item.trim()) return setErr('Diga o que foi trocado.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return setErr('Informe a data.')
    if (lancar && !(custo > 0)) return setErr('Informe o custo para lançar nos gastos.')
    const valores: Record<string, Cell> = {
      data: f.data,
      item: f.item.trim(),
      categoria: f.categoria.trim() || 'Outros',
      observacao: f.observacao.trim(),
      km: lerKm(f.km) ?? '',
      proxima_data: f.proxima_data,
      proxima_km: lerKm(f.proxima_km) ?? '',
      custo: custo || '',
      lancamento_id: troca?.lancamento_id ?? '',
    }
    const lanc =
      lancar && podeLancar
        ? { mes_ref: mesLanc, data: f.data, descricao: f.item.trim(), valor: custo, categoria, forma_pagamento: forma, carro: 'Mecânico' }
        : undefined
    if (await finance.actions.salvarTroca(troca?.row, valores, lanc)) onClose()
  }

  return (
    <Modal onClose={onClose} onSubmit={salvar} titulo={troca ? 'Editar troca' : 'Registrar troca'}>
      <div className="space-y-3">
        <Field label="O que foi trocado">
          <input autoFocus className={inputCls} list="troca-itens" value={f.item} onChange={(e) => set('item')(e.target.value)} placeholder="Ex.: Óleo, Pneus dianteiros" />
          <datalist id="troca-itens">
            {itens.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <DatePicker value={f.data} onChange={set('data')} />
          </Field>
          <Field label="Categoria">
            <input className={inputCls} list="troca-categorias" value={f.categoria} onChange={(e) => set('categoria')(e.target.value)} placeholder="Ex.: Motor" />
            <datalist id="troca-categorias">
              {sugestoes.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <Field label="Custo (opcional)">
            <MoneyInput value={f.custo} onChange={set('custo')} />
          </Field>
          <Field label="Quilometragem (opcional)">
            <input className={inputCls} inputMode="numeric" value={f.km} onChange={(e) => set('km')(e.target.value)} placeholder={ultimoKmTexto(model)} />
          </Field>
        </div>

        <div className="rounded-2xl border border-line p-3">
          <div className="mb-2 text-xs font-semibold text-muted">Próxima troca (opcional)</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <DatePicker value={f.proxima_data} onChange={set('proxima_data')} placeholder="Quando" opcional />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[
                  [6, '+6 meses'],
                  [12, '+1 ano'],
                ].map(([n, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => set('proxima_data')(somarMesesData(data, n as number))}
                    className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-muted hover:text-ink"
                  >
                    {label}
                  </button>
                ))}
                {f.proxima_data && (
                  <button type="button" onClick={() => set('proxima_data')('')} className="rounded-full px-2 py-0.5 text-[11px] text-faint hover:text-ink">
                    limpar
                  </button>
                )}
              </div>
            </div>
            <input className={cx(inputCls, 'h-10')} inputMode="numeric" value={f.proxima_km} onChange={(e) => set('proxima_km')(e.target.value)} placeholder="Ou aos … km" />
          </div>
        </div>

        <Field label="Observação (opcional)">
          <textarea className={cx(inputCls, 'min-h-20')} value={f.observacao} onChange={(e) => set('observacao')(e.target.value)} placeholder="Ex.: peça R$ 438,95 + mão de obra" />
        </Field>

        {podeLancar ? (
          <div className={cx('rounded-2xl border p-3 transition', lancar ? 'border-primary/40 bg-primary-soft/40' : 'border-line')}>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-(--color-primary)" checked={lancar} onChange={(e) => setLancar(e.target.checked)} />
              <span>
                <span className="font-semibold">Lançar também nos gastos</span>
                <span className="block text-xs text-muted">Cria o gasto “{f.item.trim() || '…'}” nos lançamentos, como custo Mecânico do carro.</span>
              </span>
            </label>
            {lancar && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Forma de pagamento">
                  <Dropdown value={forma} onChange={setForma} opcoes={model.formas.map((c) => ({ value: c.nome, label: c.nome, cor: c.cor || undefined }))} />
                </Field>
                <Field label="Categoria do gasto">
                  <Dropdown value={categoria} onChange={setCategoria} opcoes={model.categorias.map((c) => ({ value: c.nome, label: c.nome, cor: c.cor }))} />
                </Field>
                <p className="col-span-2 text-xs text-muted">
                  Entra em <b className="text-ink">{mesCurto(mesLanc)}</b>
                  {fatura ? ` (fatura ${forma} que vence em ${dataCurta(fatura.vencimento)})` : ''}.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">Esta troca já está nos lançamentos. Mudar o custo aqui não altera o gasto lançado.</p>
        )}

        {err && <p className="text-sm text-bad">{err}</p>}
        <div className="sheet-footer flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={finance.busy}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ultimoKmTexto(model: Model) {
  const km = model.trocas.reduce((a, t) => Math.max(a, t.km ?? 0), 0)
  return km ? `Último: ${km.toLocaleString('pt-BR')}` : 'Ex.: 85000'
}

// ---------- importar da planilha antiga ----------

/** Lê o que o Google Planilhas copia (colunas separadas por tab; células com quebra de linha vêm entre aspas). */
function lerTSV(txt: string): string[][] {
  const linhas: string[][] = [[]]
  let cel = ''
  let aspas = false
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i]
    if (aspas) {
      if (ch === '"' && txt[i + 1] === '"') {
        cel += '"'
        i++
      } else if (ch === '"') aspas = false
      else cel += ch
    } else if (ch === '"' && cel === '') aspas = true
    else if (ch === '\t') {
      linhas[linhas.length - 1].push(cel)
      cel = ''
    } else if (ch === '\n') {
      linhas[linhas.length - 1].push(cel)
      linhas.push([])
      cel = ''
    } else if (ch !== '\r') cel += ch
  }
  linhas[linhas.length - 1].push(cel)
  return linhas.filter((l) => l.some((c) => c.trim()))
}

/** "R$ 4.000,00" → 4000; "R$ 4.000" → 4000 */
const lerMoeda = (s: string) => {
  const t = s.replace(/[R$\s]/g, '')
  return !t.includes(',') && /\.\d{3}$/.test(t) ? Number(t.replace(/\./g, '')) || 0 : num(t)
}

/** Colunas da aba "Trocas Carro": Data, Item, Categoria, Observação, KM, Próxima manutenção, Custo. */
function linhasImportadas(txt: string) {
  return lerTSV(txt)
    .map((c) => ({
      data: normData(c[0] ?? ''),
      item: (c[1] ?? '').trim(),
      categoria: (c[2] ?? '').trim() || 'Outros',
      observacao: (c[3] ?? '').trim(),
      km: lerKm(c[4] ?? '') ?? '',
      proxima_data: /^\d{4}-\d{2}-\d{2}$/.test(normData(c[5] ?? '')) ? normData(c[5] ?? '') : '',
      proxima_km: '',
      custo: lerMoeda(c[6] ?? '') || '',
      lancamento_id: '',
    }))
    .filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.data) && l.item) // pula o cabeçalho e linhas vazias
}

function ImportarModal({ model, finance, onClose }: { model: Model; finance: Finance; onClose: () => void }) {
  const [txt, setTxt] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const existentes = new Set(model.trocas.map((t) => `${t.data}|${t.item.toLowerCase()}`))
  const lidas = linhasImportadas(txt)
  const novas = lidas.filter((l) => !existentes.has(`${l.data}|${l.item.toLowerCase()}`))
  const repetidas = lidas.length - novas.length

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (novas.length && (await finance.actions.importarTrocas(novas))) onClose()
  }

  return (
    <Modal onClose={onClose} onSubmit={salvar} titulo="Colar da planilha">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Na aba <b className="text-ink">Trocas Carro</b>, selecione as linhas (da coluna Data até Custo), copie com Ctrl+C e cole aqui.
        </p>
        <textarea
          autoFocus
          className={cx(inputCls, 'min-h-40 font-mono text-xs')}
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          placeholder={'23/07/2026\tCabeçote\tMotor\t…\t\t\tR$ 4.000,00'}
        />
        {lidas.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-xl bg-soft px-3 py-2 text-xs">
            {novas.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 py-0.5">
                <span className="truncate">
                  <span className="text-faint tabular-nums">{anoCompleto(l.data)}</span> {l.item} <span className="text-muted">· {l.categoria}</span>
                </span>
                <span className="shrink-0 tabular-nums">{typeof l.custo === 'number' ? fmt(l.custo) : '–'}</span>
              </div>
            ))}
            {repetidas > 0 && (
              <div className="pt-1 text-muted">
                {repetidas} {repetidas === 1 ? 'linha já existe e será ignorada' : 'linhas já existem e serão ignoradas'}.
              </div>
            )}
          </div>
        )}
        {txt.trim() && lidas.length === 0 && <p className="text-sm text-bad">Não reconheci nenhuma linha. A 1ª coluna precisa ser a data (dd/mm/aaaa).</p>}
        <div className="sheet-footer flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={finance.busy || novas.length === 0}>
            Importar {novas.length || ''} {novas.length === 1 ? 'troca' : 'trocas'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- peças ----------

function Modal({ titulo, children, onClose, onSubmit }: { titulo: string; children: ReactNode; onClose: () => void; onSubmit: (e: FormEvent) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onSubmit={onSubmit}
        onMouseDown={(e) => e.stopPropagation()}
        className="sheet max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-soft" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </form>
    </div>
  )
}

function IconeBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rounded-md p-1 text-muted hover:bg-soft hover:text-ink">
      {children}
    </button>
  )
}
