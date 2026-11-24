import { Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { dataCurta, fmt, resumoMes } from '../lib/finance'
import type { Lancamento, Model } from '../lib/model'
import type { Finance } from '../lib/store'
import { Card, Empty, cx, inputCls } from '../components/ui'

const TIPOS = [
  { id: '', label: 'Todos' },
  { id: 'gasto', label: 'Gastos' },
  { id: 'fixo', label: 'Fixos' },
  { id: 'parcela', label: 'Parcelas' },
] as const

const tipoCor: Record<string, string> = {
  gasto: 'bg-primary-soft text-primary',
  fixo: 'bg-soft text-muted',
  parcela: 'bg-warn-soft text-warn',
}

export function Lancamentos({ model, mes, finance }: { model: Model; mes: string; finance: Finance }) {
  const [tipo, setTipo] = useState('')
  const [q, setQ] = useState('')
  const [forma, setForma] = useState('')
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const r = resumoMes(model, mes)

  const lista = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return r.itens
      .filter((l) => !tipo || l.tipo === tipo)
      .filter((l) => !forma || l.forma_pagamento === forma)
      .filter((l) => !qq || `${l.descricao} ${l.categoria} ${l.forma_pagamento}`.toLowerCase().includes(qq))
      .sort((a, b) => (b.data || '').localeCompare(a.data || '') || a.tipo.localeCompare(b.tipo))
  }, [r.itens, tipo, forma, q])
  const total = lista.reduce((a, l) => a + l.valor, 0)
  const formas = [...new Set(r.itens.map((l) => l.forma_pagamento).filter(Boolean))].sort()

  async function excluir(l: Lancamento, futuras: boolean) {
    const alvo = futuras
      ? model.lancamentos.filter((x) => x.parcelamento_id === l.parcelamento_id && x.mes_ref >= l.mes_ref)
      : [l]
    await finance.actions.excluirLancamentos(alvo)
    setConfirmar(null)
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1.5 overflow-x-auto">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTipo(t.id)}
              className={cx(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold',
                tipo === t.id ? 'bg-primary text-white' : 'bg-soft text-muted hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="w-40 shrink-0">
            <select className={cx(inputCls, 'py-2')} value={forma} onChange={(e) => setForma(e.target.value)}>
              <option value="">Todas as formas</option>
              {formas.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input className={cx(inputCls, 'py-2 pl-9')} placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between border-b border-line pb-3 text-sm">
        <span className="text-muted">{lista.length} lançamentos</span>
        <span>
          Total: <b>R$ {fmt(total)}</b>
        </span>
      </div>

      {lista.length === 0 ? (
        <div className="mt-4">
          <Empty>Nenhum lançamento encontrado.</Empty>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {lista.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-3">
              <div className="hidden w-12 shrink-0 text-xs text-muted sm:block">{l.data ? dataCurta(l.data) : '—'}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{l.descricao}</span>
                  <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', tipoCor[l.tipo])}>
                    {l.projetado ? 'fixo (modelo)' : l.tipo}
                    {l.tipo === 'parcela' && l.parcelas_restantes ? ` · faltam ${l.parcelas_restantes}` : ''}
                  </span>
                </div>
                <div className="truncate text-xs text-muted">
                  <span className="sm:hidden">{l.data ? dataCurta(l.data) + ' · ' : ''}</span>
                  {l.categoria} · {l.forma_pagamento || 'sem forma'}
                </div>
              </div>
              <div className="text-sm font-bold whitespace-nowrap">R$ {fmt(l.valor)}</div>
              {l.projetado ? (
                <div className="w-8" />
              ) : confirmar === l.id ? (
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <button
                    disabled={finance.busy}
                    onClick={() => excluir(l, false)}
                    className="rounded-lg bg-bad px-2 py-1 text-xs font-semibold text-white"
                  >
                    {l.tipo === 'parcela' ? 'Só esta' : 'Excluir'}
                  </button>
                  {l.tipo === 'parcela' && l.parcelamento_id && (
                    <button
                      disabled={finance.busy}
                      onClick={() => excluir(l, true)}
                      className="rounded-lg bg-bad px-2 py-1 text-xs font-semibold text-white"
                      title="Apaga esta e as próximas parcelas (ex.: compra quitada)"
                    >
                      Esta e próximas
                    </button>
                  )}
                  <button onClick={() => setConfirmar(null)} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-soft">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmar(l.id)}
                  className="rounded-lg p-1.5 text-faint hover:bg-bad-soft hover:text-bad"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">
        Para editar um valor ou descrição, altere direto na planilha (aba “lancamentos”) e clique em atualizar.
      </p>
    </Card>
  )
}
