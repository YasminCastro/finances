import { CalendarCheck, Layers, TrendingDown, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Dropdown } from '../components/Dropdown'
import { Card, Empty, Money, cx } from '../components/kit'
import { addMeses, fmt, formaDe, mesCurto } from '../lib/finance'
import type { Lancamento, Model } from '../lib/model'
import { ordemAlfabetica } from '../lib/cores'

const N = 12

interface Compra {
  chave: string
  descricao: string
  forma: string
  categoria: string
  /** valor por mês (AAAA-MM → R$) */
  porMes: Map<string, number>
  /** último mês com parcela */
  fim: string
  /** parcelas que faltam a partir do mês escolhido (inclui ele) */
  faltam: number
  restante: number
}

function montarCompras(model: Model, mes: string): Compra[] {
  const grupos = new Map<string, Lancamento[]>()
  for (const l of model.lancamentos) {
    if (l.tipo !== 'parcela') continue
    const chave = l.parcelamento_id || `${l.descricao.trim().toLowerCase()}|${l.forma_pagamento}`
    grupos.set(chave, [...(grupos.get(chave) ?? []), l])
  }
  const compras: Compra[] = []
  for (const [chave, ls] of grupos) {
    const futuras = ls.filter((l) => l.mes_ref >= mes)
    if (!futuras.length) continue
    const porMes = new Map<string, number>()
    for (const l of futuras) porMes.set(l.mes_ref, (porMes.get(l.mes_ref) ?? 0) + l.valor)
    const ordenadas = [...futuras].sort((a, b) => a.mes_ref.localeCompare(b.mes_ref))
    const primeira = ordenadas[0]
    const fim = ordenadas[ordenadas.length - 1].mes_ref
    compras.push({
      chave,
      descricao: primeira.descricao,
      forma: primeira.forma_pagamento,
      categoria: primeira.categoria,
      porMes,
      fim,
      faltam: new Set(futuras.map((l) => l.mes_ref)).size,
      restante: futuras.reduce((a, l) => a + l.valor, 0),
    })
  }
  return compras
}

export function Parcelamentos({ model, mes }: { model: Model; mes: string }) {
  const [forma, setForma] = useState('')
  const todas = useMemo(() => montarCompras(model, mes), [model, mes])
  const compras = forma ? todas.filter((c) => c.forma === forma) : todas
  const ultimoMes = compras.reduce((a, c) => (c.fim > a ? c.fim : a), '')
  // colunas: do mês escolhido até a última parcela
  const meses = useMemo(() => {
    const lista = [mes]
    while (ultimoMes && lista[lista.length - 1] < ultimoMes) lista.push(addMeses(mes, lista.length))
    return lista
  }, [mes, ultimoMes])
  const proximos12 = useMemo(() => new Set(Array.from({ length: N }, (_, k) => addMeses(mes, k))), [mes])

  // lista única: quem tem mais parcelas faltando vem primeiro
  const ordenadas = useMemo(
    () => [...compras].sort((a, b) => b.faltam - a.faltam || b.restante - a.restante || ordemAlfabetica(a.descricao, b.descricao)),
    [compras],
  )

  const totalMes = (lista: Compra[], m: string) => lista.reduce((a, c) => a + (c.porMes.get(m) ?? 0), 0)
  const totais = meses.map((m) => totalMes(compras, m))
  const totalJanela = totais.reduce((a, v, k) => (proximos12.has(meses[k]) ? a + v : a), 0)
  const totalRestante = compras.reduce((a, c) => a + c.restante, 0)
  const terminamNoMes = compras.filter((c) => c.fim === mes).length
  const max = Math.max(...totais, 1)

  const formasOpcoes = [
    { value: '', label: 'Todas as formas' },
    ...[...new Set(todas.map((c) => c.forma).filter(Boolean))].sort(ordemAlfabetica).map((f) => ({
      value: f,
      label: f,
      cor: formaDe(model, f)?.cor || undefined,
    })),
  ]

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <Resumo icon={<Wallet size={16} />} titulo={`Parcelas de ${mesCurto(mes)}`}>
          <Money value={totais[0]} className="text-2xl sm:text-3xl" />
        </Resumo>
        <Resumo icon={<Layers size={16} />} titulo="Próximos 12 meses">
          <Money value={totalJanela} className="text-2xl sm:text-3xl" />
        </Resumo>
        <Resumo icon={<TrendingDown size={16} />} titulo="Total que falta pagar">
          <Money value={totalRestante} className="text-2xl sm:text-3xl" />
        </Resumo>
        <Resumo icon={<CalendarCheck size={16} />} titulo="Livre de parcelas em">
          <div className="text-2xl font-extrabold tracking-tight sm:text-3xl">{ultimoMes ? mesCurto(addMeses(ultimoMes, 1)) : '—'}</div>
          <div className="mt-1 text-xs text-muted">
            {compras.length} {compras.length === 1 ? 'compra ativa' : 'compras ativas'}
            {terminamNoMes > 0 && ` · ${terminamNoMes} ${terminamNoMes === 1 ? 'acaba' : 'acabam'} este mês`}
          </div>
        </Resumo>
      </div>

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Parcelas por mês</h2>
            <p className="mt-0.5 text-xs text-muted">
              {mesCurto(meses[0])} – {mesCurto(meses[meses.length - 1])} · {compras.length} {compras.length === 1 ? 'compra' : 'compras'}
            </p>
          </div>
          <div className="w-full sm:w-56">
            <Dropdown value={forma} onChange={setForma} opcoes={formasOpcoes} />
          </div>
        </div>

        {compras.length === 0 ? (
          <div className="px-6 pb-6">
            <Empty>Nenhuma parcela a partir deste mês.</Empty>
          </div>
        ) : (
          <div className="scroll-thin overflow-x-auto border-t border-line">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 w-56 min-w-56 border-r border-b border-line bg-card px-4 py-3 text-left align-bottom">
                    <div className="text-xs font-medium text-muted">Compra</div>
                    <div className="mt-1 text-[11px] font-normal text-faint">total por mês →</div>
                  </th>
                  {meses.map((m, k) => {
                    const v = totais[k]
                    const atual = k === 0
                    return (
                      <th key={m} className="min-w-22 border-b border-line px-1 pt-3 align-bottom font-normal">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={cx(
                              'rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                              atual ? 'bg-primary-soft text-primary' : 'text-muted',
                            )}
                          >
                            {mesCurto(m)}
                          </span>
                          <span className={cx('text-xs font-semibold tabular-nums whitespace-nowrap', atual ? 'text-primary' : 'text-ink')}>
                            {v ? fmt(v) : '—'}
                          </span>
                          <div className="flex h-9 w-full items-end justify-center">
                            <div
                              title={`${mesCurto(m)}: R$ ${fmt(v)}`}
                              className={cx('w-7 rounded-t-md', atual ? 'bg-primary' : 'bg-primary/25')}
                              style={{ height: `${v ? Math.max(6, (v / max) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </th>
                    )
                  })}
                  <th className="sticky right-0 z-20 border-b border-l border-line bg-card px-4 py-3 text-right align-bottom whitespace-nowrap">
                    <div className="text-xs font-medium text-muted">Falta</div>
                    <div className="mt-1 text-sm font-bold text-ink tabular-nums">{fmt(totalRestante)}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((c) => (
                  <Linha key={c.chave} compra={c} cor={formaDe(model, c.forma)?.cor || ''} meses={meses} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Resumo({ icon, titulo, children }: { icon: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
        <span className="flex size-7 items-center justify-center rounded-lg bg-soft">{icon}</span>
        {titulo}
      </div>
      {children}
    </Card>
  )
}

/** Linha em formato de linha do tempo: uma faixa contínua na cor do cartão, do mês atual até a última parcela. */
function Linha({ compra: c, cor, meses }: { compra: Compra; cor: string; meses: string[] }) {
  const base = cor || 'var(--color-primary)'
  const faixa = `color-mix(in srgb, ${base} 16%, transparent)`
  return (
    <tr className="group">
      <td className="sticky left-0 z-10 border-r border-b border-line bg-card px-4 py-2.5 transition-colors group-hover:bg-soft">
        <div className="truncate font-medium text-ink" title={c.descricao}>
          {c.descricao}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <span className="size-2 shrink-0 rounded-full" style={{ background: cor || 'var(--color-faint)' }} />
          <span className="truncate">{c.forma || 'Sem forma'}</span>
        </div>
      </td>
      {meses.map((m, k) => {
        const v = c.porMes.get(m)
        const antes = k > 0 && c.porMes.has(meses[k - 1])
        const depois = k < meses.length - 1 && c.porMes.has(meses[k + 1])
        const ultima = m === c.fim
        return (
          <td key={m} className="border-b border-line px-0 py-2.5 transition-colors group-hover:bg-soft">
            {v ? (
              <div
                title={ultima ? `Última parcela · R$ ${fmt(v)}` : `R$ ${fmt(v)}`}
                className={cx(
                  'flex h-8 items-center justify-center text-xs whitespace-nowrap tabular-nums',
                  antes ? '' : 'ml-1.5 rounded-l-full',
                  depois ? '' : 'mr-1.5 rounded-r-full',
                  ultima ? 'font-semibold text-good' : 'text-ink',
                )}
                style={{ background: faixa }}
              >
                {ultima && <span className="mr-1">✓</span>}
                {fmt(v)}
              </div>
            ) : null}
          </td>
        )
      })}
      <td className="sticky right-0 z-10 border-b border-l border-line bg-card px-4 py-2.5 text-right whitespace-nowrap transition-colors group-hover:bg-soft">
        <div className="font-semibold text-ink tabular-nums">{fmt(c.restante)}</div>
        <div className="mt-0.5 text-xs text-muted">
          {c.faltam === 1 ? 'última' : `${c.faltam}x`} · até {mesCurto(c.fim)}
        </div>
      </td>
    </tr>
  )
}
