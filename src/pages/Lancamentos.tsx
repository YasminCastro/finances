import { AlertTriangle, ChevronRight, HandCoins, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cobrancasPorLancamento, fmt, formaDe, hoje, mesCurto, reembolsoDoMes, resumoMes } from '../lib/finance'
import { corCategoria, vigente } from '../lib/model'
import type { Lancamento, Model, Receber, TipoLimite } from '../lib/model'
import type { Finance } from '../lib/store'
import { Card, Money, cx, inputCls } from '../components/kit'
import { Dropdown } from '../components/Dropdown'
import { EditLancamentoModal } from '../components/EditLancamentoModal'
import { ordemAlfabetica } from '../lib/cores'

const TIPOS = [
  { id: '', label: 'Todos' },
  { id: 'gasto', label: 'Gastos' },
  { id: 'fixo', label: 'Fixos' },
  { id: 'parcela', label: 'Parcelas' },
] as const

const diaFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

function rotuloDia(data: string) {
  if (!data) return 'Sem data'
  const h = hoje()
  if (data === h) return 'Hoje'
  const [y, m, d] = data.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const ontem = new Date()
  ontem.setDate(ontem.getDate() - 1)
  if (dt.toDateString() === ontem.toDateString()) return 'Ontem'
  const s = diaFmt.format(dt)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function Lancamentos({ model, mes, finance }: { model: Model; mes: string; finance: Finance }) {
  const [tipo, setTipo] = useState('')
  const [q, setQ] = useState('')
  const [forma, setForma] = useState('')
  const [categoria, setCategoria] = useState('')
  const [editando, setEditando] = useState<Lancamento | null>(null)
  const r = resumoMes(model, mes)

  // filtros que não são o tipo (o resumo por tipo respeita busca, forma e categoria)
  const base = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return r.itens
      .filter((l) => !forma || l.forma_pagamento === forma)
      .filter((l) => !categoria || l.categoria === categoria)
      .filter((l) => !qq || `${l.descricao} ${l.categoria} ${l.forma_pagamento}`.toLowerCase().includes(qq))
  }, [r.itens, forma, categoria, q])
  const lista = tipo ? base.filter((l) => l.tipo === tipo) : base
  const total = lista.reduce((a, l) => a + l.valor, 0)

  const porTipo = TIPOS.map((t) => {
    const ls = t.id ? base.filter((l) => l.tipo === t.id) : base
    return { ...t, total: ls.reduce((a, l) => a + l.valor, 0), qtd: ls.length }
  })

  // regra: cada tipo do mês (todos os itens, sem filtros) até X% do salário fixo.
  // Conta só a sua parte: o que outras pessoas vão te devolver (a receber ligado ao lançamento ou rodízio) sai da conta.
  const salario = model.entradasFixas.filter((f) => vigente(f, mes)).reduce((a, f) => a + f.valor, 0)
  const reembolso = reembolsoDoMes(model, mes)
  const cobrancas = useMemo(() => cobrancasPorLancamento(model), [model])
  const totalTipo: Partial<Record<TipoLimite, number>> = {
    fixo: r.fixos - reembolso.fixo,
    gasto: r.gastos - reembolso.gasto,
    parcela: r.parcelas - reembolso.parcela,
  }
  const alerta = (id: string) => {
    if (!(id in totalTipo) || salario <= 0) return null
    const k = id as TipoLimite
    const limite = model.limites[k]
    const total = totalTipo[k] ?? 0
    const pct = total / salario
    const nivel = pct > limite ? 'bad' : pct >= limite * 0.85 ? 'warn' : 'good'
    return { k, limite, total, pct, nivel, devolvem: reembolso[k as 'fixo' | 'gasto' | 'parcela'] ?? 0 }
  }

  // agrupa por dia (mais recente primeiro); sem data vem depois e as parcelas ficam numa seção própria no fim
  const dias = useMemo(() => {
    const soma = (ls: Lancamento[]) => ls.reduce((a, l) => a + l.valor, 0)
    const m = new Map<string, Lancamento[]>()
    for (const l of lista) if (l.tipo !== 'parcela') m.set(l.data || '', [...(m.get(l.data || '') ?? []), l])
    const grupos = [...m.entries()]
      .sort(([a], [b]) => (!a ? 1 : !b ? -1 : b.localeCompare(a)))
      .map(([data, ls]) => ({
        chave: data || 'sem-data',
        titulo: data ? rotuloDia(data) : 'Sem data',
        itens: ls.sort((a, b) => a.tipo.localeCompare(b.tipo) || ordemAlfabetica(a.descricao, b.descricao)),
        total: soma(ls),
      }))
    // parcelas: das que faltam mais para as que faltam menos
    const parcelas = lista
      .filter((l) => l.tipo === 'parcela')
      .sort((a, b) => (b.parcelas_restantes ?? 0) - (a.parcelas_restantes ?? 0) || ordemAlfabetica(a.descricao, b.descricao))
    if (parcelas.length) grupos.push({ chave: 'parcelas', titulo: 'Parcelas', itens: parcelas, total: soma(parcelas) })
    return grupos
  }, [lista])

  const formas = [...new Set(r.itens.map((l) => l.forma_pagamento).filter(Boolean))].sort(ordemAlfabetica)
  const categorias = [...new Set(r.itens.map((l) => l.categoria).filter(Boolean))].sort(ordemAlfabetica)
  const filtrando = !!(q || forma || categoria)
  const limpar = () => {
    setQ('')
    setForma('')
    setCategoria('')
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {porTipo.map((t) => {
          const ativo = tipo === t.id
          const al = alerta(t.id)
          const regra = al?.nivel ?? null
          const acima = regra === 'bad'
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTipo(t.id)}
              aria-pressed={ativo}
              title={
                al
                  ? `${t.label} (sua parte): ${fmt(al.total)} = ${Math.round(al.pct * 100)}% do salário fixo (${fmt(salario)}). Limite: ${Math.round(al.limite * 100)}% = ${fmt(salario * al.limite)}`
                  : undefined
              }
              className={cx(
                'rounded-3xl border p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition sm:p-5',
                acima ? 'bg-bad-soft' : 'bg-card',
                ativo
                  ? acima
                    ? 'border-bad ring-2 ring-bad/20'
                    : 'border-primary ring-2 ring-primary/15'
                  : acima
                    ? 'border-bad/50 hover:border-bad'
                    : 'border-line hover:border-faint/60',
              )}
            >
              <div className="mb-2 flex items-center justify-between text-xs font-medium">
                <span className={cx('flex items-center gap-1', acima ? 'text-bad' : ativo ? 'text-primary' : 'text-muted')}>
                  {acima && <AlertTriangle className="size-3.5" aria-hidden />}
                  {t.label}
                </span>
                <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] text-muted tabular-nums">{t.qtd}</span>
              </div>
              <Money value={t.total} className={cx('text-xl sm:text-2xl', acima && 'text-bad')} />
              {al && (
                <div className="mt-2.5">
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-soft">
                    <div
                      className={cx('h-full rounded-full', regra === 'bad' ? 'bg-bad' : regra === 'warn' ? 'bg-warn' : 'bg-good')}
                      style={{ width: `${Math.min(100, (al.pct / al.limite) * 100)}%` }}
                    />
                  </div>
                  <div className={cx('mt-1 text-[11px] tabular-nums', regra === 'bad' ? 'font-medium text-bad' : regra === 'warn' ? 'text-warn' : 'text-muted')}>
                    {Math.round(al.pct * 100)}% do salário · limite {Math.round(al.limite * 100)}%
                    {acima && ` · ${fmt(al.total - salario * al.limite)} acima`}
                  </div>
                  {al.devolvem > 0 && (
                    <div className="mt-0.5 text-[11px] text-muted tabular-nums">sua parte · R$ {fmt(al.devolvem)} voltam de outras pessoas</div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden p-0 sm:p-0">
        {/* cabeçalho: título do que está sendo visto + total, depois a busca e os filtros */}
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">
                {TIPOS.find((t) => t.id === tipo)?.label ?? 'Todos'} <span className="font-normal text-muted">em {mesCurto(mes)}</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {lista.length} {lista.length === 1 ? 'lançamento' : 'lançamentos'}
                {filtrando && (
                  <>
                    {' · filtrado · '}
                    <button type="button" onClick={limpar} className="font-semibold text-primary hover:underline">
                      limpar filtros
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] font-medium text-muted">Total</div>
              <Money value={total} className="text-lg" />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <input
                className={cx(inputCls, 'py-2 pr-9 pl-9')}
                placeholder="Buscar por descrição, categoria ou forma"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Buscar lançamentos"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  aria-label="Limpar busca"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-faint hover:bg-soft hover:text-ink"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <div className="sm:w-52">
                <Dropdown
                  className="py-2"
                  value={categoria}
                  onChange={setCategoria}
                  opcoes={[{ value: '', label: 'Todas as categorias' }, ...categorias.map((c) => ({ value: c, label: c, cor: corCategoria(model, c) }))]}
                />
              </div>
              <div className="sm:w-44">
                <Dropdown
                  className="py-2"
                  value={forma}
                  onChange={setForma}
                  opcoes={[{ value: '', label: 'Todas as formas' }, ...formas.map((f) => ({ value: f, label: f, cor: formaDe(model, f)?.cor || undefined }))]}
                />
              </div>
            </div>
          </div>
        </div>

        {lista.length === 0 ? (
          <div className="border-t border-line px-4 py-10 text-center sm:px-5">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-soft text-faint">
              <Search size={18} />
            </div>
            <p className="text-sm font-medium text-ink">Nenhum lançamento encontrado</p>
            <p className="mt-1 text-xs text-muted">{filtrando ? 'Tente outra busca ou limpe os filtros.' : `Nada lançado em ${mesCurto(mes)} ainda.`}</p>
            {filtrando && (
              <button type="button" onClick={limpar} className="mt-3 text-xs font-semibold text-primary hover:underline">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="border-t border-line pb-2">
            {dias.map((d) => (
              <section key={d.chave} aria-label={d.titulo}>
                <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-1.5 sm:px-5">
                  <h3 className="text-xs font-semibold text-ink">
                    {d.titulo}
                    <span className="ml-1.5 font-normal text-faint">
                      {d.itens.length} {d.itens.length === 1 ? 'item' : 'itens'}
                    </span>
                  </h3>
                  <span className="text-xs font-medium text-muted tabular-nums">R$ {fmt(d.total)}</span>
                </div>
                <ul>
                  {d.itens.map((l, idx) => (
                    <li key={l.id} className="relative">
                      {/* divisor começa depois do ícone */}
                      {idx > 0 && <span className="absolute top-0 right-0 left-16 h-px bg-line/70 sm:left-[4.375rem]" aria-hidden />}
                      <Item l={l} model={model} cobrancas={cobrancas.get(l.id)} onEdit={() => setEditando(l)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>

      {editando && <EditLancamentoModal lancamento={editando} onClose={() => setEditando(null)} model={model} finance={finance} />}
    </div>
  )
}

/** Etiqueta curta do tipo/estado do lançamento (fica ao lado do valor, alinhada à direita). */
function etiqueta(l: Lancamento): { texto: string; tom: 'warn' | 'primary' | 'muted'; tracejada?: boolean; titulo?: string } | null {
  if (l.tipo === 'parcela') {
    const r = l.parcelas_restantes
    const texto = r === 1 ? 'última parcela' : r ? `faltam ${r}` : 'parcela'
    return { texto, tom: 'warn', tracejada: l.estimada, titulo: l.estimada ? 'Parcela estimada (ainda não está na planilha)' : undefined }
  }
  if (l.tipo === 'fixo') {
    if (l.projetado) return { texto: 'fixo', tom: 'muted', tracejada: true, titulo: 'Conta fixa estimada: edite na página Fixos' }
    return { texto: l.fixo_id ? 'fixo · ajustado' : 'fixo', tom: 'primary' }
  }
  return null
}

const TOM = {
  warn: 'bg-warn-soft text-warn border-transparent',
  primary: 'bg-primary-soft text-primary border-transparent',
  muted: 'bg-soft text-muted border-transparent',
}

function Item({ l, model, cobrancas, onEdit }: { l: Lancamento; model: Model; cobrancas?: Receber[]; onEdit: () => void }) {
  const cor = corCategoria(model, l.categoria)
  const corForma = formaDe(model, l.forma_pagamento)?.cor
  const tag = etiqueta(l)
  const estimado = l.projetado || l.estimada

  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={l.projetado}
      title={tag?.titulo ?? 'Editar'}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-soft/70 focus-visible:bg-soft/70 focus-visible:outline-none sm:gap-3.5 sm:px-5"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
        style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: cor }}
        aria-hidden
      >
        {l.categoria.charAt(0).toUpperCase()}
      </span>

      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-sm font-medium', estimado ? 'text-muted' : 'text-ink')}>{l.descricao}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <span className="truncate">{l.categoria}</span>
          <span className="text-faint" aria-hidden>
            ·
          </span>
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: corForma || 'var(--color-faint)' }} aria-hidden />
          <span className="truncate">{l.forma_pagamento || 'sem forma'}</span>
          {cobrancas?.length ? (
            <>
              <span className="text-faint" aria-hidden>
                ·
              </span>
              <span
                className={cx('flex shrink-0 items-center gap-1 font-medium', cobrancas.every((c) => c.recebido) ? 'text-good' : 'text-primary')}
                title={cobrancas.map((c) => `${c.pessoa}: R$ ${fmt(c.valor)}${c.recebido ? ' (recebido)' : ''}`).join(' · ')}
              >
                <HandCoins size={12} aria-hidden />
                {cobrancas.some((c) => c.valor < 0) ? 'abatido de ' : ''}
                {[...new Set(cobrancas.map((c) => c.pessoa))].join(', ')} · R$ {fmt(Math.abs(cobrancas.reduce((a, c) => a + c.valor, 0)))}
              </span>
            </>
          ) : null}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className={cx('text-sm font-semibold whitespace-nowrap tabular-nums', estimado ? 'text-muted' : 'text-ink')}>R$ {fmt(l.valor)}</span>
        {tag && (
          <span
            className={cx(
              'rounded-full border px-1.5 py-px text-[10px] leading-4 font-medium whitespace-nowrap',
              TOM[tag.tom],
              tag.tracejada && 'border-dashed border-current/40 bg-transparent',
            )}
          >
            {tag.texto}
            {tag.tracejada && ' · estimado'}
          </span>
        )}
      </span>

      <ChevronRight
        size={16}
        aria-hidden
        className={cx('hidden shrink-0 text-faint transition sm:block', l.projetado ? 'invisible' : 'opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100')}
      />
    </button>
  )
}
