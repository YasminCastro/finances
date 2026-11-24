import { ChevronLeft, ChevronRight, CreditCard, Wifi } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { addMeses, dataCurta, faturaCartao, fmt, mesCurto, vencimentoFatura } from '../../lib/finance'
import type { Model } from '../../lib/model'
import { Card, CardTitle, Empty, Money, cx } from '../ui'

export function CartoesCard({ model, mes }: { model: Model; mes: string }) {
  const cartoes = model.formas.filter((f) => f.cartao)
  const comValor = [...cartoes].sort((a, b) => faturaCartao(model, mes, b.nome) - faturaCartao(model, mes, a.nome))
  const [idx, setIdx] = useState(0)
  if (!cartoes.length)
    return (
      <Card>
        <CardTitle icon={<CreditCard size={18} />}>Cartões</CardTitle>
        <Empty>Cadastre cartões na aba “formas_pagamento” com tipo = cartao.</Empty>
      </Card>
    )
  const i = Math.min(idx, comValor.length - 1)
  const c = comValor[i]
  const atual = faturaCartao(model, mes, c.nome)
  const proximas = [0, 1, 2].map((k) => {
    const m = addMeses(mes, k)
    return { mes: m, valor: faturaCartao(model, m, c.nome) }
  })
  const maxProx = Math.max(...proximas.map((p) => p.valor), 1)
  const venc = vencimentoFatura(c, mes)
  const cor = c.cor || '#334155'

  return (
    <Card>
      <CardTitle
        icon={<CreditCard size={18} />}
        extra={
          <div className="flex gap-1">
            <NavBtn onClick={() => setIdx((i - 1 + comValor.length) % comValor.length)}>
              <ChevronLeft size={16} />
            </NavBtn>
            <NavBtn onClick={() => setIdx((i + 1) % comValor.length)}>
              <ChevronRight size={16} />
            </NavBtn>
          </div>
        }
      >
        Cartões
      </CardTitle>

      <div className="text-xs text-muted">Fatura de {mesCurto(mes)}</div>
      <Money value={atual} className="mt-1 text-4xl" />

      <div
        className="relative mt-4 h-40 overflow-hidden rounded-2xl p-4 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${cor}, color-mix(in srgb, ${cor} 55%, #000))` }}
      >
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-6 size-44 rounded-full bg-white/5" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight">{c.nome}</span>
            <Wifi size={18} className="rotate-90 opacity-80" />
          </div>
          <div className="h-7 w-10 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 opacity-90" />
          <div className="flex items-end justify-between text-xs">
            <div>
              <div className="text-[10px] tracking-wider uppercase opacity-70">Vence</div>
              <div className="font-semibold">{venc ? dataCurta(venc) : '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] tracking-wider uppercase opacity-70">Fatura</div>
              <div className="font-semibold">R$ {fmt(atual)}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {comValor.map((x, k) => (
          <button
            key={x.nome}
            aria-label={x.nome}
            onClick={() => setIdx(k)}
            className={cx('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-primary' : 'w-1.5 bg-line')}
          />
        ))}
      </div>

      <div className="mt-4 text-[11px] font-semibold tracking-wider text-muted uppercase">Próximas faturas</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {proximas.map((p, k) => (
          <div
            key={p.mes}
            className={cx(
              'flex h-24 flex-col justify-between rounded-2xl border p-2.5',
              k === 0 ? 'border-primary bg-primary-soft' : 'border-line bg-soft',
            )}
          >
            <div className="text-center text-xs font-semibold">{mesCurto(p.mes)}</div>
            <div className="mx-auto w-6 rounded-t-md bg-primary/70" style={{ height: `${Math.max(4, (p.valor / maxProx) * 28)}px` }} />
            <div className={cx('text-center text-xs font-bold whitespace-nowrap', k === 0 ? 'text-primary' : 'text-muted')}>
              R$ {fmt(p.valor)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function NavBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex size-7 items-center justify-center rounded-full border border-line text-muted hover:bg-soft hover:text-ink">
      {children}
    </button>
  )
}
