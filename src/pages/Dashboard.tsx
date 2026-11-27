import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, FilterX } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Dropdown } from '../components/Dropdown'
import { SemanasCard, faixaCurta } from '../components/cards/SemanasCard'
import { Card, CardTitle, Empty, Money, cx } from '../components/kit'
import { addMeses, brl, corDoDestino, dataCurta, faixasSemanas, fmt, investimentosResumo, lancamentosEntre, mesAtual, mesCurto, resumoMes, semanasDoMes } from '../lib/finance'
import { chaveParcela, corCategoria } from '../lib/model'
import type { Lancamento, Model, Tipo } from '../lib/model'
import { ordemAlfabetica } from '../lib/cores'

type Periodo = 'mes' | '12m' | 'ano'
type Filtros = { categoria: string; forma: string; tipo: '' | Tipo }

const soma = (xs: { valor: number }[]) => xs.reduce((a, x) => a + x.valor, 0)
const TIPOS: { value: '' | Tipo; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'gasto', label: 'Gastos do mês' },
  { value: 'fixo', label: 'Fixos' },
  { value: 'parcela', label: 'Parcelas' },
]
const SEGS = [
  { tipo: 'fixo' as const, label: 'Fixos', cor: 'var(--color-seg-1)' },
  { tipo: 'parcela' as const, label: 'Parcelas', cor: 'var(--color-seg-2)' },
  { tipo: 'gasto' as const, label: 'Gastos do mês', cor: 'var(--color-seg-3)' },
]

/** Meses do período; `ref` é o mês de referência (o último do período, ou um mês do ano). */
function mesesDo(periodo: Periodo, ref: string) {
  if (periodo === 'mes') return [ref]
  if (periodo === '12m') return Array.from({ length: 12 }, (_, k) => addMeses(ref, k - 11))
  const ano = ref.slice(0, 4)
  return Array.from({ length: 12 }, (_, k) => `${ano}-${String(k + 1).padStart(2, '0')}`)
}

interface Maior {
  chave: string
  l: Lancamento
  valor: number
  vezes: number
}

interface DadosMes {
  mes: string
  entradas: number
  saidasTotal: number
  investido: number
  itens: Lancamento[] // já filtrados
  porTipo: Record<Tipo, number>
  saidas: number // filtradas
}

export function Dashboard({ model, mes: ref, setMes: setRef }: { model: Model; mes: string; setMes: (m: string) => void }) {
  const [periodo, setPeriodo] = useState<Periodo>('12m')
  const [f, setF] = useState<Filtros>({ categoria: '', forma: '', tipo: '' })
  const filtrando = !!(f.categoria || f.forma || f.tipo)
  const hojeMes = mesAtual()
  const passa = (l: Lancamento) => (!f.categoria || l.categoria === f.categoria) && (!f.forma || l.forma_pagamento === f.forma) && (!f.tipo || l.tipo === f.tipo)

  const meses = mesesDo(periodo, ref)
  // no período de um mês, os gráficos de evolução mostram os 6 meses até ele, para dar contexto
  const mesesGrafico = periodo === 'mes' ? Array.from({ length: 6 }, (_, k) => addMeses(ref, k - 5)) : meses
  const anteriores = meses.map((m) => addMeses(m, -meses.length))

  const dados = useMemo(() => {
    const cache = new Map<string, DadosMes>()
    return (m: string): DadosMes => {
      const c = cache.get(m)
      if (c) return c
      const r = resumoMes(model, m)
      const itens = r.itens.filter(passa)
      const porTipo = { fixo: 0, parcela: 0, gasto: 0 } as Record<Tipo, number>
      for (const l of itens) porTipo[l.tipo] += l.valor
      const d = { mes: m, entradas: r.entradas, saidasTotal: r.saidas, investido: r.investido, itens, porTipo, saidas: soma(itens) }
      cache.set(m, d)
      return d
    }
    // passa depende só de f
  }, [model, f])

  const atual = meses.map(dados)
  const antes = anteriores.map(dados)
  const tot = (xs: DadosMes[], k: 'entradas' | 'saidas' | 'saidasTotal' | 'investido') => xs.reduce((a, x) => a + x[k], 0)

  // ----- semana (só no período de um mês) -----
  // a semana escolhida vale só para o mês em que foi escolhida
  const [semSel, setSemSel] = useState<{ ref: string; inicio: string } | null>(null)
  const semanas = periodo === 'mes' ? semanasDoMes(model, ref, passa) : []
  const idxSem = semSel?.ref === ref ? semanas.findIndex((x) => x.inicio === semSel.inicio) : -1
  const semana = idxSem >= 0 ? semanas[idxSem] : null
  // a semana anterior à 1ª é a última do mês passado
  const semAntes = !semana ? null : idxSem > 0 ? semanas[idxSem - 1] : faixasSemanas(addMeses(ref, -1)).at(-1)!
  const itensSemAntes = semAntes ? lancamentosEntre(model, semAntes.inicio, semAntes.fim).filter(passa) : []
  const escolherSemana = (inicio: string | null) => setSemSel(inicio ? { ref, inicio } : null)

  const entradas = tot(atual, 'entradas')
  const saidas = semana ? semana.total : tot(atual, 'saidas')
  const saidasAntes = semana ? soma(itensSemAntes) : tot(antes, 'saidas')
  const sobra = entradas - tot(atual, 'saidasTotal')
  const investido = tot(atual, 'investido')
  const temFuturo = meses.some((m) => m > hojeMes)

  // ----- categorias e formas no período -----
  const itensPeriodo = semana ? semana.itens : atual.flatMap((d) => d.itens)
  const itensAntes = semana ? itensSemAntes : antes.flatMap((d) => d.itens)
  const agrupar = (xs: Lancamento[], chave: (l: Lancamento) => string) => {
    const mp = new Map<string, number>()
    for (const l of xs) mp.set(chave(l), (mp.get(chave(l)) ?? 0) + l.valor)
    return mp
  }
  const catAtual = agrupar(itensPeriodo, (l) => l.categoria)
  const catAntes = agrupar(itensAntes, (l) => l.categoria)
  const categorias = [...catAtual.entries()]
    .filter(([, v]) => v > 0)
    .map(([nome, valor]) => ({ nome, valor, antes: catAntes.get(nome) ?? 0, cor: corCategoria(model, nome) }))
    .sort((a, b) => b.valor - a.valor)
  // parcelas da mesma compra e meses do mesmo fixo viram um item só
  const grupos = new Map<string, Maior>()
  for (const l of itensPeriodo) {
    if (l.valor <= 0) continue
    const k = l.tipo === 'parcela' ? `p:${chaveParcela(l)}` : l.tipo === 'fixo' ? `f:${l.fixo_id || l.descricao.trim().toLowerCase()}` : `g:${l.id}:${l.mes_ref}`
    const g = grupos.get(k)
    if (g) {
      g.valor += l.valor
      g.vezes += 1
    } else grupos.set(k, { chave: k, l, valor: l.valor, vezes: 1 })
  }
  const maiores = [...grupos.values()].sort((a, b) => b.valor - a.valor).slice(0, 8)

  const navegar = (k: number) => setRef(addMeses(ref, periodo === 'ano' ? 12 * k : k))
  const rotulo =
    periodo === 'ano' ? ref.slice(0, 4) : periodo === '12m' ? `${mesCurto(meses[0])} – ${mesCurto(meses[meses.length - 1])}` : mesCurto(ref)

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* ----- filtros ----- */}
      <Card className="!p-3 sm:!p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-full bg-soft p-0.5 text-xs" role="group" aria-label="Período">
            {(
              [
                ['mes', 'Mês'],
                ['12m', '12 meses'],
                ['ano', 'Ano'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={periodo === id}
                onClick={() => setPeriodo(id)}
                className={cx('rounded-full px-3 py-1.5 font-semibold transition-colors', periodo === id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <NavBtn label="Período anterior" onClick={() => navegar(-1)}>
              <ChevronLeft size={16} />
            </NavBtn>
            <span className="min-w-28 text-center text-sm font-semibold tabular-nums">{rotulo}</span>
            <NavBtn label="Próximo período" onClick={() => navegar(1)}>
              <ChevronRight size={16} />
            </NavBtn>
          </div>
          <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="min-w-40 flex-1 sm:w-48 sm:flex-none">
            <Dropdown
              value={f.categoria}
              onChange={(v) => setF({ ...f, categoria: v })}
              opcoes={[
                { value: '', label: 'Todas as categorias' },
                ...[...model.categorias].sort((a, b) => ordemAlfabetica(a.nome, b.nome)).map((c) => ({ value: c.nome, label: c.nome, cor: c.cor })),
              ]}
            />
            </div>
            <div className="min-w-40 flex-1 sm:w-44 sm:flex-none">
            <Dropdown
              value={f.forma}
              onChange={(v) => setF({ ...f, forma: v })}
              semBusca
              opcoes={[{ value: '', label: 'Todas as formas' }, ...model.formas.map((x) => ({ value: x.nome, label: x.nome, cor: x.cor || undefined }))]}
            />
            </div>
            <div className="min-w-36 flex-1 sm:w-40 sm:flex-none">
              <Dropdown value={f.tipo} onChange={(v) => setF({ ...f, tipo: v as Filtros['tipo'] })} semBusca opcoes={TIPOS} />
            </div>
            {filtrando && (
              <button
                type="button"
                onClick={() => setF({ categoria: '', forma: '', tipo: '' })}
                className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft"
              >
                <FilterX size={14} /> Limpar
              </button>
            )}
          </div>
        </div>
        {periodo === 'mes' && (
          <div className="scroll-thin -mx-3 mt-3 flex gap-1.5 overflow-x-auto border-t border-line px-3 pt-3 pb-0.5 text-xs sm:-mx-4 sm:px-4" role="group" aria-label="Semana">
            <SemanaChip ativo={!semana} onClick={() => escolherSemana(null)}>
              Mês inteiro
            </SemanaChip>
            {semanas.map((s, k) => (
              <SemanaChip key={s.inicio} ativo={semana?.inicio === s.inicio} onClick={() => escolherSemana(semana?.inicio === s.inicio ? null : s.inicio)}>
                Semana {k + 1}
                <span className="ml-1 font-medium opacity-70">{faixaCurta(s)}</span>
              </SemanaChip>
            ))}
          </div>
        )}
        {(temFuturo || filtrando || semana) && (
          <p className="mt-2 px-1 text-xs text-muted">
            {temFuturo && 'Meses futuros entram como previsão (fixos e parcelas já conhecidos). '}
            {semana
              ? 'A semana vale para as saídas, categorias e maiores saídas, pela data de cada lançamento (compras no cartão entram na semana da compra); entradas, sobra e investimentos são do mês. A comparação é com a semana anterior.'
              : filtrando && 'Os filtros valem para as saídas; entradas, sobra e investimentos não mudam.'}
          </p>
        )}
      </Card>

      {/* ----- números do período ----- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <Kpi label="Entradas" valor={entradas} antes={tot(antes, 'entradas')} bomSubir />
        <Kpi label={`${semana ? `Saídas · Semana ${idxSem + 1}` : 'Saídas'}${filtrando ? ' (filtradas)' : ''}`} valor={saidas} antes={saidasAntes} />
        <Kpi label="Sobra" valor={sobra} antes={tot(antes, 'entradas') - tot(antes, 'saidasTotal')} bomSubir tom={sobra < 0 ? 'bad' : 'default'} />
        <Kpi label="Investido" valor={investido} antes={tot(antes, 'investido')} bomSubir extra={entradas > 0 ? `${Math.round((investido / entradas) * 100)}% das entradas` : undefined} />
        {semana && semAntes ? (
          <Kpi
            label={filtrando ? 'Média por dia (filtrada)' : 'Saídas por dia na semana'}
            valor={saidas / semana.dias}
            antes={saidasAntes / semAntes.dias}
            className="col-span-2 lg:col-span-1"
          />
        ) : (
          <Kpi
            label={filtrando ? 'Média mensal (filtrada)' : 'Média de saídas / mês'}
            valor={saidas / meses.length}
            antes={saidasAntes / meses.length}
            className="col-span-2 lg:col-span-1"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <Fluxo dados={mesesGrafico.map(dados)} selecionados={meses} hojeMes={hojeMes} filtrando={filtrando} />
        <Categorias
          itens={categorias}
          total={saidas}
          temAnterior={itensAntes.length > 0}
          selecionada={f.categoria}
          onSelecionar={(c) => setF({ ...f, categoria: f.categoria === c ? '' : c })}
        />
        {meses.length > 1 && <MapaCategorias model={model} dados={atual} hojeMes={hojeMes} />}
        {periodo === 'mes' && (
          <div className="flex flex-col lg:col-span-2 [&>*]:flex-1">
            <SemanasCard semanas={semanas} selecionada={semana?.inicio ?? null} onSelecionar={escolherSemana} filtrando={filtrando} />
          </div>
        )}
        <Reserva model={model} meses={mesesGrafico} selecionados={meses} hojeMes={hojeMes} />
        <Maiores itens={maiores} model={model} largo={periodo === 'mes'} />
      </div>
    </div>
  )
}

// ---------- peças ----------

function SemanaChip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cx(
        'shrink-0 rounded-full px-3 py-1.5 font-semibold whitespace-nowrap tabular-nums transition-colors',
        ativo ? 'bg-primary-soft text-primary' : 'bg-soft text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function NavBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full border border-line text-muted hover:bg-soft hover:text-ink"
    >
      {children}
    </button>
  )
}

function Kpi({
  label,
  valor,
  antes,
  bomSubir,
  extra,
  tom,
  className,
}: {
  label: string
  valor: number
  antes: number
  bomSubir?: boolean
  extra?: string
  tom?: 'bad' | 'default'
  className?: string
}) {
  const dif = antes !== 0 ? (valor - antes) / Math.abs(antes) : null
  const subiu = (dif ?? 0) > 0
  const bom = dif === null || Math.abs(dif) < 0.005 ? null : subiu === !!bomSubir
  return (
    <Card className={cx('!p-4', className)}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <Money value={valor} className="mt-1.5 text-2xl" tone={tom} />
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted tabular-nums">
        {dif !== null && Math.abs(dif) >= 0.005 && (
          <span className={cx('flex items-center font-semibold', bom ? 'text-good' : 'text-bad')}>
            {subiu ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(Math.round(dif * 100))}%
          </span>
        )}
        <span>{dif === null ? 'sem período anterior' : 'vs período anterior'}</span>
        {extra && <span className="w-full">{extra}</span>}
      </div>
    </Card>
  )
}

/** Entradas ao lado das saídas empilhadas por tipo, mês a mês. */
function Fluxo({ dados, selecionados, hojeMes, filtrando }: { dados: DadosMes[]; selecionados: string[]; hojeMes: string; filtrando: boolean }) {
  const max = Math.max(...dados.flatMap((d) => [d.entradas, d.saidas]), 1)
  const muitos = dados.length > 8
  return (
    <Card className="flex flex-col lg:col-span-2">
      <CardTitle
        extra={
          <span className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs text-muted">
            <Legenda cor="var(--color-good)">Entradas</Legenda>
            {SEGS.map((s) => (
              <Legenda key={s.tipo} cor={s.cor}>
                {s.label}
              </Legenda>
            ))}
          </span>
        }
      >
        Entradas e saídas
      </CardTitle>
      <div className="relative flex min-h-56 flex-1 gap-1 sm:gap-2">
        <div className="pointer-events-none absolute inset-x-0 bottom-7 h-px bg-line" aria-hidden />
        {dados.map((d) => {
          const sel = selecionados.includes(d.mes) && selecionados.length === 1
          const futuro = d.mes > hojeMes
          const saldo = d.entradas - d.saidasTotal
          return (
            <div
              key={d.mes}
              className={cx('group flex min-w-0 flex-1 flex-col rounded-xl px-0.5 pt-1', sel ? 'bg-primary-soft/70' : 'hover:bg-soft/70')}
              title={`${mesCurto(d.mes)}${futuro ? ' (previsão)' : ''}\nEntradas ${brl(d.entradas)}\nSaídas ${brl(d.saidas)}${filtrando ? ' (filtradas)' : ''}\n  Fixos ${brl(d.porTipo.fixo)}\n  Parcelas ${brl(d.porTipo.parcela)}\n  Gastos ${brl(d.porTipo.gasto)}\nSobra ${brl(saldo)}`}
            >
              <div className={cx('relative mt-5 flex flex-1 items-end justify-center gap-0.5', futuro && 'opacity-45')}>
                {!filtrando && (
                  <span
                    className={cx(
                      'absolute inset-x-[-6px] text-center text-[10px] font-semibold whitespace-nowrap tabular-nums',
                      saldo >= 0 ? 'text-good' : 'text-bad',
                      muitos && !sel && 'opacity-0 group-hover:opacity-100',
                    )}
                    style={{ bottom: `calc(${(Math.max(d.entradas, d.saidas) / max) * 100}% + 3px)` }}
                  >
                    {saldo >= 0 ? '+' : '−'}
                    {Math.abs(Math.round(saldo)).toLocaleString('pt-BR')}
                  </span>
                )}
                <div className="w-full max-w-5 rounded-t bg-good" style={{ height: `${Math.max(d.entradas > 0 ? 1 : 0, (d.entradas / max) * 100)}%` }} />
                <div className="flex w-full max-w-5 flex-col-reverse gap-[2px]" style={{ height: `${(d.saidas / max) * 100}%` }}>
                  {SEGS.map((s, k) =>
                    d.porTipo[s.tipo] > 0 ? (
                      <div
                        key={s.tipo}
                        className={cx(k === SEGS.length - 1 || SEGS.slice(k + 1).every((x) => d.porTipo[x.tipo] <= 0) ? 'rounded-t' : '')}
                        style={{ flexGrow: d.porTipo[s.tipo], flexBasis: 0, background: s.cor, minHeight: 1 }}
                      />
                    ) : null,
                  )}
                </div>
              </div>
              <div className={cx('flex h-7 items-center justify-center text-[10px] whitespace-nowrap sm:text-[11px]', sel ? 'font-bold text-primary' : 'text-muted')}>
                {mesCurto(d.mes, !muitos)}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted">Toque (ou passe o mouse) num mês para ver o detalhe. Meses futuros aparecem mais claros (previsão).</p>
    </Card>
  )
}

function Legenda({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="size-2 rounded-full" style={{ background: cor }} aria-hidden />
      {children}
    </span>
  )
}

function Categorias({
  itens,
  total,
  temAnterior,
  selecionada,
  onSelecionar,
}: {
  itens: { nome: string; valor: number; antes: number; cor: string }[]
  total: number
  temAnterior: boolean
  selecionada: string
  onSelecionar: (c: string) => void
}) {
  const max = Math.max(...itens.map((c) => c.valor), 1)
  return (
    <Card className="flex flex-col">
      <CardTitle extra={<span className="text-xs text-muted">{itens.length} categorias</span>}>Por categoria</CardTitle>
      {itens.length === 0 ? (
        <Empty>Sem saídas no período.</Empty>
      ) : (
        <ul className="scroll-thin -mx-1 flex-1 space-y-1 px-1 lg:max-h-80 lg:overflow-y-auto lg:pr-2">
          {itens.map((c) => {
            const dif = temAnterior && c.antes > 0 ? (c.valor - c.antes) / c.antes : null
            return (
              <li key={c.nome}>
                <button
                  type="button"
                  onClick={() => onSelecionar(c.nome)}
                  aria-pressed={selecionada === c.nome}
                  title={selecionada === c.nome ? 'Tirar o filtro' : `Filtrar por ${c.nome}`}
                  className={cx('w-full rounded-xl px-2 py-1.5 text-left transition-colors', selecionada === c.nome ? 'bg-primary-soft' : 'hover:bg-soft')}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} aria-hidden />
                      <span className="truncate font-medium">{c.nome}</span>
                    </span>
                    <span className="font-semibold whitespace-nowrap tabular-nums">R$ {fmt(c.valor)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                    <div className="h-full rounded-full" style={{ width: `${(c.valor / max) * 100}%`, background: c.cor }} />
                  </div>
                  <div className="mt-0.5 flex justify-between text-[11px] text-muted tabular-nums">
                    <span>{total > 0 ? `${Math.max(1, Math.round((c.valor / total) * 100))}% das saídas` : ''}</span>
                    {dif !== null && Math.abs(dif) >= 0.01 && (
                      <span className={cx('font-semibold', dif > 0 ? 'text-bad' : 'text-good')}>
                        {dif > 0 ? '▲' : '▼'} {Math.abs(Math.round(dif * 100))}%
                      </span>
                    )}
                    {temAnterior && c.antes === 0 && <span className="text-faint">novo</span>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-muted">Clique numa categoria para filtrar o painel. ▲▼ comparam com o período anterior.</p>
    </Card>
  )
}

/** Categoria × mês: a cor mostra em que meses cada categoria pesou mais. */
function MapaCategorias({ model, dados, hojeMes }: { model: Model; dados: DadosMes[]; hojeMes: string }) {
  const totais = new Map<string, number>()
  for (const d of dados) for (const l of d.itens) totais.set(l.categoria, (totais.get(l.categoria) ?? 0) + l.valor)
  const cats = [...totais.entries()]
    .filter(([, v]) => v > 0)
    .map(([c]) => c)
    .sort(ordemAlfabetica)
  const valor = (d: DadosMes, c: string) => d.itens.filter((l) => l.categoria === c).reduce((a, l) => a + l.valor, 0)

  return (
    <Card className="lg:col-span-3">
      <CardTitle extra={<span className="text-xs text-muted">mais escuro = mês em que a categoria pesou mais</span>}>Mapa de gastos</CardTitle>
      {cats.length === 0 ? (
        <Empty>Sem saídas no período.</Empty>
      ) : (
        <div className="scroll-thin max-h-96 overflow-auto">
          <table className="w-full border-separate border-spacing-[3px] text-[11px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th className="sticky left-0 bg-card" />
                {dados.map((d) => (
                  <th key={d.mes} className={cx('px-0.5 pb-1 font-medium whitespace-nowrap', d.mes > hojeMes ? 'text-faint' : 'text-muted')}>
                    {mesCurto(d.mes, false)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => {
                const vs = dados.map((d) => valor(d, c))
                const max = Math.max(...vs, 1)
                return (
                  <tr key={c}>
                    <th scope="row" className="sticky left-0 z-[1] max-w-32 bg-card pr-2 text-left font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: corCategoria(model, c) }} aria-hidden />
                        <span className="truncate">{c}</span>
                      </span>
                    </th>
                    {vs.map((v, k) => (
                      <td
                        key={dados[k].mes}
                        title={`${c} · ${mesCurto(dados[k].mes)}: ${brl(v)}`}
                        className="h-7 min-w-9 rounded-md text-center tabular-nums"
                        style={{
                          background: v > 0 ? `color-mix(in srgb, var(--color-primary) ${Math.round(12 + (v / max) * 78)}%, var(--color-card))` : 'var(--color-soft)',
                          color: v / max > 0.55 ? 'white' : 'var(--color-muted)',
                        }}
                      >
                        {v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : Math.round(v)) : ''}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/** Reserva: quanto está guardado, como entrou e saiu no período e onde está. */
/** `meses` são as barras (podem incluir contexto); os totais somam só os `selecionados`. */
function Reserva({ model, meses, selecionados, hojeMes }: { model: Model; meses: string[]; selecionados: string[]; hojeMes: string }) {
  const ultimo = selecionados[selecionados.length - 1]
  const { total, destinos } = investimentosResumo(model, ultimo)
  const porMes = meses.map((m) => {
    const xs = model.investimentos.filter((i) => i.mes_ref === m)
    const aporte = xs.filter((i) => i.valor > 0).reduce((a, i) => a + i.valor, 0)
    const resgate = -xs.filter((i) => i.valor < 0).reduce((a, i) => a + i.valor, 0)
    return { mes: m, aporte, resgate, liquido: aporte - resgate }
  })
  const doPeriodo = porMes.filter((p) => selecionados.includes(p.mes))
  const aportes = doPeriodo.reduce((a, p) => a + p.aporte, 0)
  const resgates = doPeriodo.reduce((a, p) => a + p.resgate, 0)
  const liquido = aportes - resgates
  // escala única para cima (aporte) e para baixo (resgate), com o zero no meio da proporção
  const maxCima = Math.max(...porMes.map((p) => p.aporte), 0)
  const maxBaixo = Math.max(...porMes.map((p) => p.resgate), 0)
  const escala = maxCima + maxBaixo || 1
  const zero = (maxCima / escala) * 100 // % da altura acima da linha do zero
  const muitos = meses.length > 8

  return (
    <Card className="flex flex-col">
      <CardTitle>Reserva</CardTitle>
      <div className="text-xs text-muted">Guardado até {mesCurto(ultimo)}</div>
      <Money value={total} className="mt-1 text-3xl" />

      {/* entrou, saiu e o que sobrou no período */}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-soft/70 px-2 py-2">
          <dt className="text-[11px] text-muted">Aportes</dt>
          <dd className="text-sm font-bold text-good tabular-nums">+{fmt(aportes)}</dd>
        </div>
        <div className="rounded-xl bg-soft/70 px-2 py-2">
          <dt className="text-[11px] text-muted">Resgates</dt>
          <dd className={cx('text-sm font-bold tabular-nums', resgates > 0 ? 'text-bad' : 'text-muted')}>{resgates > 0 ? `−${fmt(resgates)}` : '0,00'}</dd>
        </div>
        <div className="rounded-xl bg-soft/70 px-2 py-2">
          <dt className="text-[11px] text-muted">Líquido</dt>
          <dd className={cx('text-sm font-bold tabular-nums', liquido < 0 ? 'text-bad' : 'text-ink')}>
            {liquido < 0 ? '−' : '+'}
            {fmt(Math.abs(liquido))}
          </dd>
        </div>
      </dl>

      {/* mês a mês: aporte para cima, resgate para baixo */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
          <span className="font-semibold">Mês a mês</span>
          <span className="flex gap-3">
            <Legenda cor="var(--color-good)">Aporte</Legenda>
            <Legenda cor="var(--color-bad)">Resgate</Legenda>
          </span>
        </div>
        <div className="relative flex h-32 gap-1">
          <div className="pointer-events-none absolute inset-x-0 h-px bg-line" style={{ top: `${zero}%` }} aria-hidden />
          {porMes.map((p) => (
            <div
              key={p.mes}
              className={cx('relative flex-1 rounded-md hover:bg-soft/70', p.mes > hojeMes && 'opacity-45')}
              title={`${mesCurto(p.mes)}\nAportes ${brl(p.aporte)}\nResgates ${brl(-p.resgate)}\nLíquido ${brl(p.liquido)}`}
            >
              {p.aporte > 0 && (
                <div
                  className="absolute inset-x-0 mx-auto w-full max-w-4 rounded-t bg-good"
                  style={{ bottom: `${100 - zero}%`, height: `${(p.aporte / escala) * 100}%` }}
                />
              )}
              {p.resgate > 0 && (
                <div
                  className="absolute inset-x-0 mx-auto w-full max-w-4 rounded-b bg-bad"
                  style={{ top: `calc(${zero}% + 2px)`, height: `${(p.resgate / escala) * 100}%` }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {porMes.map((p) => (
            <div key={p.mes} className={cx('min-w-0 flex-1 overflow-hidden text-center text-muted', muitos ? 'text-[9px]' : 'text-[10px]')}>
              {mesCurto(p.mes, false)}
            </div>
          ))}
        </div>
      </div>

      {/* onde está */}
      {destinos.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-soft" aria-hidden>
            {destinos.map((d) => (
              <div key={d.nome} style={{ width: `${(d.valor / total) * 100}%`, background: corDoDestino(model, d.nome) }} />
            ))}
          </div>
          <ul className="space-y-1">
            {destinos.map((d) => (
              <li key={d.nome} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: corDoDestino(model, d.nome) }} aria-hidden />
                  <span className="truncate">{d.nome}</span>
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  <b className="font-semibold">R$ {fmt(d.valor)}</b>
                  <span className="ml-1.5 text-muted">{Math.round((d.valor / total) * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Maiores({ itens, model, largo }: { itens: Maior[]; model: Model; largo?: boolean }) {
  return (
    <Card className={largo ? 'lg:col-span-3' : 'lg:col-span-2'}>
      <CardTitle extra={<span className="text-xs text-muted">parcelas e fixos somados no período</span>}>Maiores saídas do período</CardTitle>
      {itens.length === 0 ? (
        <Empty>Sem saídas no período.</Empty>
      ) : (
        <ol className="divide-y divide-line">
          {itens.map(({ chave, l, valor, vezes }, k) => (
            <li key={chave} className="flex items-center gap-3 py-2">
              <span className="w-5 shrink-0 text-right text-xs font-semibold text-faint tabular-nums">{k + 1}</span>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: corCategoria(model, l.categoria) }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{l.descricao}</div>
                <div className="truncate text-xs text-muted">
                  {l.categoria} · {l.forma_pagamento || 'Sem forma'} ·{' '}
                  {l.tipo === 'parcela'
                    ? `${vezes} ${vezes === 1 ? 'parcela' : 'parcelas'} de ${brl(valor / vezes)}`
                    : l.tipo === 'fixo'
                      ? `fixo · ${vezes} ${vezes === 1 ? 'mês' : 'meses'}`
                      : l.data
                        ? dataCurta(l.data)
                        : mesCurto(l.mes_ref)}
                </div>
              </div>
              <span className="text-sm font-bold whitespace-nowrap tabular-nums">R$ {fmt(valor)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
