import { escFecha } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { addMeses, brl, dataCurta, faturaDaCompra, formaDe, hoje, mesCurto } from '../lib/finance'
import { num } from '../lib/model'
import type { Model } from '../lib/model'
import type { Finance } from '../lib/store'
import { Button, Field, cx, inputCls } from './kit'

import { Dropdown } from './Dropdown'
import { DatePicker, MonthPicker } from './pickers'
import { ADD_KINDS } from './addKinds'
import type { AddKind } from './addKinds'

export function AddModal({
  kind,
  setKind,
  onClose,
  model,
  mes,
  finance,
}: {
  kind: AddKind
  setKind: (k: AddKind) => void
  onClose: () => void
  model: Model
  mes: string
  finance: Finance
}) {
  // O componente é montado de novo a cada troca de tipo (key no App), então os valores iniciais vêm daqui.
  const [f, setF] = useState<Record<string, string>>(() => ({
    descricao: kind === 'entrada' ? 'Salário' : '',
    valor: '',
    data: hoje(),
    mes_ref: mes,
    categoria: model.categorias[0]?.nome ?? '',
    forma_pagamento: formaMaisUsada(model),
    total_parcelas: '2',
    destino: model.destinos[0] ?? '',
    pessoa: '',
    dia_vencimento: '',
  }))
  const [err, setErr] = useState<string | null>(null)
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const valor = num(f.valor)
  const parcelas = Math.max(1, Math.round(num(f.total_parcelas)))

  // Compra no cartão: o mês de referência sai da data da compra e do fechamento da fatura,
  // a menos que você escolha o mês manualmente.
  const usaFatura = kind === 'gasto' || kind === 'parcelado'
  const fatura = usaFatura ? faturaDaCompra(formaDe(model, f.forma_pagamento ?? ''), kind === 'gasto' ? f.data : hoje()) : null
  const mesRef = fatura && f.mes_manual !== 'sim' ? fatura.mes_ref : f.mes_ref

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    const precisaDescricao = kind !== 'investimento'
    if (precisaDescricao && !f.descricao?.trim()) return setErr('Preencha a descrição.')
    if (!valor) return setErr('Informe um valor.')
    if (kind === 'receber' && !f.pessoa?.trim()) return setErr('Informe quem te deve.')
    const a = finance.actions
    let ok = false
    const d = f.descricao.trim()
    switch (kind) {
      case 'gasto':
        ok = await a.append('lancamentos', 'L', [
          { mes_ref: mesRef, data: f.data, descricao: d, valor, categoria: f.categoria, forma_pagamento: f.forma_pagamento, tipo: 'gasto' },
        ])
        break
      case 'parcelado':
        ok = await a.addParcelado({
          descricao: d,
          valor_parcela: valor,
          total_parcelas: parcelas,
          mes_primeira_parcela: mesRef,
          categoria: f.categoria,
          forma_pagamento: f.forma_pagamento,
        })
        break
      case 'fixo':
        ok = await a.novoFixo(
          'fixos',
          {
            descricao: d,
            valor,
            categoria: f.categoria,
            forma_pagamento: f.forma_pagamento,
            dia_vencimento: f.dia_vencimento ? Number(f.dia_vencimento) : '',
          },
          mesRef,
        )
        break
      case 'entrada':
        if (f.recorrente === 'sim') {
          ok = await a.novoFixo('entradas_fixas', { descricao: d, valor }, mesRef)
          if (!ok) break
        }
        ok = await a.append('entradas', 'E', [{ mes_ref: mesRef, descricao: d, valor }])
        break
      case 'investimento':
        ok = await a.append('investimentos', 'I', [{ mes_ref: mesRef, data: hoje(), destino: f.destino, valor, descricao: d }])
        break
      case 'receber':
        ok = await a.append('a_receber', 'R', [{ pessoa: f.pessoa.trim(), descricao: d, mes_ref: mesRef, valor, recebido: 'não' }])
        break
    }
    if (ok) onClose()
  }

  const opts = (xs: string[]) => xs.map((x) => <option key={x}>{x}</option>)
  const categoria = (
    <Field label="Categoria">
      <Dropdown value={f.categoria ?? ''} onChange={set('categoria')} opcoes={model.categorias.map((c) => ({ value: c.nome, label: c.nome, cor: c.cor }))} />
    </Field>
  )
  const forma = (
    <Field label="Forma de pagamento">
      <Dropdown value={f.forma_pagamento ?? ''} onChange={set('forma_pagamento')} opcoes={model.formas.map((c) => ({ value: c.nome, label: c.nome, cor: c.cor || undefined }))} />
    </Field>
  )
  const mesField = (label = 'Mês de referência') => (
    <Field label={label}>
      <MonthPicker
        value={mesRef ?? ''}
        onChange={(m) => setF((p) => ({ ...p, mes_ref: m, mes_manual: 'sim' }))}
      />
    </Field>
  )

  const dicaFatura = fatura && (
    <div className="rounded-xl bg-soft px-3 py-2 text-xs text-muted">
      {f.mes_manual === 'sim' && mesRef !== fatura.mes_ref ? (
        <>
          Pela data, iria para a fatura de <b className="text-ink">{mesCurto(fatura.mes_ref)}</b>, mas você escolheu {mesCurto(mesRef)}.{' '}
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setF((p) => ({ ...p, mes_manual: '' }))}>
            Usar automático
          </button>
        </>
      ) : (
        <>
          Entra na fatura <b className="text-ink">{f.forma_pagamento}</b> que fecha em {dataCurta(fatura.fechamento)} e vence em{' '}
          {dataCurta(fatura.vencimento)} → mês de referência <b className="text-ink">{mesCurto(fatura.mes_ref)}</b>.
        </>
      )}
    </div>
  )

  let campos: ReactNode = null
  if (kind === 'gasto')
    campos = (
      <>
        <Row>
          <Field label="Data">
            <DatePicker value={f.data ?? ''} onChange={set('data')} />
          </Field>
          {mesField()}
        </Row>
        <Row>
          {categoria}
          {forma}
        </Row>
        {dicaFatura}
      </>
    )
  if (kind === 'parcelado')
    campos = (
      <>
        <Row>
          <Field label="Número de parcelas">
            <input type="number" min={1} max={72} className={inputCls} value={f.total_parcelas ?? ''} onChange={(e) => set('total_parcelas')(e.target.value)} />
          </Field>
          {mesField('Mês da 1ª parcela')}
        </Row>
        <Row>
          {categoria}
          {forma}
        </Row>
        {dicaFatura}
        {valor > 0 && mesRef && (
          <div className="rounded-xl bg-primary-soft px-3 py-2 text-xs text-primary">
            {parcelas}× de {brl(valor)} = <b>{brl(valor * parcelas)}</b>, de {mesCurto(mesRef)} até{' '}
            {mesCurto(addMeses(mesRef, parcelas - 1))}. Cada parcela vira uma linha em “lancamentos”.
          </div>
        )}
      </>
    )
  if (kind === 'fixo')
    campos = (
      <>
        <Row>
          {categoria}
          {forma}
        </Row>
        <Row>
          <Field label="Dia de vencimento (opcional)">
            <input type="number" min={1} max={31} className={inputCls} value={f.dia_vencimento ?? ''} onChange={(e) => set('dia_vencimento')(e.target.value)} />
          </Field>
          {mesField('Começa em')}
        </Row>
        <p className="text-xs text-muted">A conta aparece todo mês a partir do mês escolhido. Para alterar ou encerrar depois, use a página Fixos.</p>
      </>
    )
  if (kind === 'entrada') {
    const jaFixa = model.entradasFixas.some((e) => e.ativo && e.descricao.toLowerCase() === f.descricao?.trim().toLowerCase())
    campos = (
      <>
        {mesField()}
        {jaFixa ? (
          <p className="text-xs text-muted">
            “{f.descricao.trim()}” já é uma entrada fixa: aparece estimada todo mês. Lançar aqui confirma o valor deste mês.
          </p>
        ) : (
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-(--color-primary)"
              checked={f.recorrente === 'sim'}
              onChange={(e) => set('recorrente')(e.target.checked ? 'sim' : '')}
            />
            <span>
              <b>Repetir todo mês</b>
              <span className="block text-xs text-muted">
                Vira uma entrada fixa (como o salário) e aparece estimada nos próximos meses até você confirmar.
              </span>
            </span>
          </label>
        )}
      </>
    )
  }
  if (kind === 'investimento')
    campos = (
      <>
        <Row>
          <Field label="Destino">
            <Dropdown value={f.destino ?? ''} onChange={set('destino')} opcoes={model.destinos.map((d) => ({ value: d, label: d }))} />
          </Field>
          {mesField()}
        </Row>
        <p className="text-xs text-muted">Para um resgate, use valor negativo (ex.: -200).</p>
      </>
    )
  if (kind === 'receber')
    campos = (
      <Row>
        <Field label="Quem te deve">
          <input
            className={inputCls}
            list="pessoas"
            value={f.pessoa ?? ''}
            onChange={(e) => set('pessoa')(e.target.value)}
            placeholder="Nome"
          />
          <datalist id="pessoas">{opts([...new Set(model.receber.map((r) => r.pessoa))])}</datalist>
        </Field>
        {mesField()}
      </Row>
    )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Adicionar</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-soft" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="scroll-thin -mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {ADD_KINDS.map((k) => (
            <button
              type="button"
              key={k.id}
              onClick={() => setKind(k.id)}
              className={cx(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                kind === k.id ? 'bg-primary text-white' : 'bg-soft text-muted hover:text-ink',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <Row>
            <Field label={kind === 'investimento' ? 'Descrição (opcional)' : 'Descrição'}>
              <input autoFocus className={inputCls} value={f.descricao ?? ''} onChange={(e) => set('descricao')(e.target.value)} />
            </Field>
            <Field label={kind === 'parcelado' ? 'Valor da parcela' : 'Valor (R$)'}>
              <input inputMode="decimal" className={inputCls} placeholder="0,00" value={f.valor ?? ''} onChange={(e) => set('valor')(e.target.value)} />
            </Field>
          </Row>
          {campos}
        </div>
        {(err || finance.error) && <div className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err || finance.error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={finance.busy}>
            {finance.busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  )
}

/** Forma de pagamento mais usada nos últimos 50 gastos (sugestão padrão do formulário). */
function formaMaisUsada(model: Model) {
  const recentes = model.lancamentos.filter((l) => l.tipo === 'gasto' && l.forma_pagamento).slice(-50)
  const cont = new Map<string, number>()
  for (const l of recentes) cont.set(l.forma_pagamento, (cont.get(l.forma_pagamento) ?? 0) + 1)
  const top = [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return top ?? model.formas.find((x) => x.cartao)?.nome ?? model.formas[0]?.nome ?? ''
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
}
