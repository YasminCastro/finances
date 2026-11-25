import { escFecha } from '@/lib/utils'
import { Barcode, CreditCard, ExternalLink, Moon, Pencil, PiggyBank, Plus, QrCode, Sun, Tags, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Bar, Button, Card, CardTitle, Empty, Field, cx, inputCls } from '../components/kit'
import { MoneyInput } from '../components/MoneyInput'
import { fmt, formaDe, limiteCartao } from '../lib/finance'
import { SPREADSHEET_URL } from '../lib/google'
import type { Row } from '../lib/google'
import { corDaPosicao, ordemAlfabetica, PALETA_CATEGORIAS } from '../lib/cores'
import { corCategoria, isYes, num, str } from '../lib/model'
import type { Model } from '../lib/model'
import type { Finance, TabConfig } from '../lib/store'

const CORES = ['#EC7000', '#820AD1', '#FF7A00', '#21C25E', '#D7262E', '#2563EB', '#0F172A', '#64748B']

type Editando = { tab: TabConfig; row?: Row; tipoInicial?: TipoForma }

export function Config({ model, finance, dark, setDark }: { model: Model; finance: Finance; dark: boolean; setDark: (d: boolean) => void }) {
  const [edit, setEdit] = useState<Editando | null>(null)
  const t = model.db.tables
  const uso = usos(model)
  const cartoes = t.formas_pagamento.filter((r) => tipoForma(r.tipo) === 'cartao')
  const outras = t.formas_pagamento.filter((r) => tipoForma(r.tipo) !== 'cartao')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
      <Card className="lg:col-span-2">
        <CardTitle icon={<CreditCard size={18} />}>
          Formas de pagamento
        </CardTitle>
        {t.formas_pagamento.length === 0 ? (
          <Empty>Nenhuma forma de pagamento.</Empty>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">Cartões de crédito</h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cartoes.map((r) => (
                  <FormaCard
                    key={r._row}
                    row={r}
                    emUso={uso.formas.get(str(r.nome).toLowerCase()) ?? 0}
                    limite={(() => {
                      const fm = formaDe(model, str(r.nome))
                      return fm ? limiteCartao(model, fm) : null
                    })()}
                    busy={finance.busy}
                    onEditar={() => setEdit({ tab: 'formas_pagamento', row: r })}
                    onExcluir={() => finance.actions.excluirConfig('formas_pagamento', r)}
                  />
                ))}
                <li>
                  <button
                    onClick={() => setEdit({ tab: 'formas_pagamento', tipoInicial: 'cartao' })}
                    className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-semibold text-muted transition hover:border-primary hover:bg-primary-soft hover:text-primary"
                  >
                    <Plus size={20} />
                    Novo cartão
                  </button>
                </li>
              </ul>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">Pix e boleto</h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {outras.map((r) => (
                  <FormaCard
                    key={r._row}
                    row={r}
                    emUso={uso.formas.get(str(r.nome).toLowerCase()) ?? 0}
                    limite={null}
                    busy={finance.busy}
                    onEditar={() => setEdit({ tab: 'formas_pagamento', row: r })}
                    onExcluir={() => finance.actions.excluirConfig('formas_pagamento', r)}
                  />
                ))}
                <li>
                  <button
                    onClick={() => setEdit({ tab: 'formas_pagamento', tipoInicial: 'pix' })}
                    className="flex h-full min-h-[74px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-semibold text-muted transition hover:border-primary hover:bg-primary-soft hover:text-primary"
                  >
                    <Plus size={18} />
                    Novo Pix ou boleto
                  </button>
                </li>
              </ul>
            </section>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle icon={<Tags size={18} />} extra={<NovoBtn onClick={() => setEdit({ tab: 'categorias' })} />}>
          Categorias
        </CardTitle>
        <p className="-mt-2 mb-3 text-xs text-muted">O orçamento mensal é o “valor esperado” usado no card de gastos por categoria.</p>
        <ul className="divide-y divide-line">
          {[...t.categorias].sort((a, b) => ordemAlfabetica(str(a.nome), str(b.nome))).map((r) => {
            const n = uso.categorias.get(str(r.nome).toLowerCase()) ?? 0
            return (
              <li key={r._row} className="flex items-center gap-3 py-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: corCategoria(model, str(r.nome)) }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{str(r.nome)}</div>
                </div>
                <div className="text-sm whitespace-nowrap">
                  {num(r.orcamento_mensal) ? <b>R$ {fmt(num(r.orcamento_mensal))}</b> : <span className="text-xs text-faint">sem orçamento</span>}
                </div>
                <Acoes onEditar={() => setEdit({ tab: 'categorias', row: r })} emUso={n} onExcluir={() => finance.actions.excluirConfig('categorias', r)} busy={finance.busy} />
              </li>
            )
          })}
        </ul>
      </Card>

      <div className="space-y-4 lg:space-y-5">
        <Card>
          <CardTitle icon={<PiggyBank size={18} />} extra={<NovoBtn onClick={() => setEdit({ tab: 'destinos_investimento' })} />}>
            Destinos de investimento
          </CardTitle>
          <ul className="divide-y divide-line">
            {t.destinos_investimento.map((r) => {
              const n = uso.destinos.get(str(r.nome).toLowerCase()) ?? 0
              return (
                <li key={r._row} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{str(r.nome)}</div>
                  </div>
                  <Acoes onEditar={() => setEdit({ tab: 'destinos_investimento', row: r })} emUso={n} onExcluir={() => finance.actions.excluirConfig('destinos_investimento', r)} busy={finance.busy} />
                </li>
              )
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle>Geral</CardTitle>
          <div className="flex items-center justify-between py-1 text-sm">
            <span className="flex items-center gap-2">{dark ? <Moon size={16} /> : <Sun size={16} />} Tema escuro</span>
            <button
              role="switch"
              aria-checked={dark}
              onClick={() => setDark(!dark)}
              className={cx('relative h-6 w-11 rounded-full transition', dark ? 'bg-primary' : 'bg-line')}
            >
              <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', dark ? 'left-5.5' : 'left-0.5')} />
            </button>
          </div>
          <a href={SPREADSHEET_URL} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ExternalLink size={16} /> Abrir planilha de dados
          </a>
        </Card>
      </div>

      {edit && <ConfigModal key={edit.tab + (edit.row?._row ?? 'novo')} edit={edit} model={model} finance={finance} uso={uso} onClose={() => setEdit(null)} />}
    </div>
  )
}

function usos(model: Model) {
  const conta = (pares: string[]) => {
    const m = new Map<string, number>()
    for (const p of pares) if (p) m.set(p.toLowerCase(), (m.get(p.toLowerCase()) ?? 0) + 1)
    return m
  }
  return {
    formas: conta([...model.lancamentos.map((l) => l.forma_pagamento), ...model.fixos.map((f) => f.forma_pagamento)]),
    categorias: conta([...model.lancamentos.map((l) => l.categoria), ...model.fixos.map((f) => f.categoria)]),
    destinos: conta(model.investimentos.map((i) => i.destino)),
  }
}

type TipoForma = 'cartao' | 'pix' | 'boleto'

/** Lê o tipo gravado na planilha. Valores antigos ("outro") contam como Pix. */
function tipoForma(v: unknown): TipoForma {
  const t = str(v as string).toLowerCase()
  if (t.startsWith('cart')) return 'cartao'
  if (t.startsWith('bol')) return 'boleto'
  return 'pix'
}

const TIPOS: Record<TipoForma, { label: string; icone: typeof CreditCard }> = {
  cartao: { label: 'Cartão de crédito', icone: CreditCard },
  pix: { label: 'Pix', icone: QrCode },
  boleto: { label: 'Boleto', icone: Barcode },
}

/** Dia do mês em que a fatura fecha (vencimento − N dias), e se cai no mês anterior. */
function diaFechamento(dia: number, dias: number) {
  const d = new Date(2026, 0, dia - dias) // janeiro tem 31 dias; só serve para achar o dia
  return { dia: d.getDate(), mesAnterior: d.getMonth() !== 0 }
}

function FormaCard({
  row: r,
  emUso,
  limite,
  busy,
  onEditar,
  onExcluir,
}: {
  row: Row
  emUso: number
  limite: ReturnType<typeof limiteCartao>
  busy: boolean
  onEditar: () => void
  onExcluir: () => void
}) {
  const tipo = tipoForma(r.tipo)
  const cartao = tipo === 'cartao'
  const Icone = TIPOS[tipo].icone
  const cor = str(r.cor)
  const venc = str(r.dia_vencimento) ? num(r.dia_vencimento) : null
  const dias = str(r.dias_fechamento) ? num(r.dias_fechamento) : null
  const fech = venc && dias != null ? diaFechamento(venc, dias) : null

  return (
    <li className="flex h-full flex-col rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: cor || 'var(--color-soft)', color: cor ? '#fff' : 'var(--color-muted)' }}
        >
          <Icone size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold" title={str(r.nome)}>
            {str(r.nome)}
          </div>
          <span
            className={cx(
              'mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
              cartao ? 'bg-primary-soft text-primary' : 'bg-soft text-muted',
            )}
          >
            {TIPOS[tipo].label}
          </span>
        </div>
        <Acoes onEditar={onEditar} emUso={emUso} onExcluir={onExcluir} busy={busy} />
      </div>

      {cartao && (
        <dl className="mt-4 mb-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
          <Info rotulo="Vencimento" valor={venc ? `dia ${venc}` : null} />
          <Info rotulo="Fechamento" valor={fech ? `dia ${fech.dia}` : null} />
        </dl>
      )}

      {cartao && (
        <div className="mt-auto border-t border-line pt-3">
          {limite ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-muted">Limite livre</span>
                <span className="text-[11px] text-muted">de R$ {fmt(limite.limite)}</span>
              </div>
              <div className={cx('text-sm font-semibold', limite.livre < 0 ? 'text-bad' : 'text-ink')}>R$ {fmt(limite.livre)}</div>
              <Bar
                className="mt-1.5"
                value={limite.usado}
                max={limite.limite}
                color={limite.usado / limite.limite > 0.85 ? 'var(--color-bad)' : limite.usado / limite.limite > 0.6 ? 'var(--color-warn)' : 'var(--color-good)'}
              />
            </>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-muted">Limite</span>
              <span className="text-sm text-faint">não definido</span>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function Info({ rotulo, valor, detalhe }: { rotulo: string; valor: string | null; detalhe?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted">{rotulo}</dt>
      <dd className={cx('truncate text-sm font-semibold', !valor && 'font-normal text-faint')}>{valor ?? 'não definido'}</dd>
      {detalhe && <dd className="truncate text-[11px] text-faint">{detalhe}</dd>}
    </div>
  )
}

function SeletorCor({ cores, value, onChange }: { cores: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-muted">Cor</span>
      <div className="flex flex-wrap items-center gap-2">
        {cores.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => onChange(c)}
            aria-label={c}
            className={cx('size-7 rounded-full ring-offset-2 ring-offset-card', value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-primary')}
            style={{ background: c }}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0" title="Outra cor" />
      </div>
    </div>
  )
}

function NovoBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" onClick={onClick} className="py-1.5 text-xs">
      <Plus size={14} /> Nova
    </Button>
  )
}

function Acoes({ onEditar, onExcluir, emUso, busy }: { onEditar: () => void; onExcluir: () => void; emUso: number; busy: boolean }) {
  const [confirmar, setConfirmar] = useState(false)
  if (confirmar)
    return (
      <div className="flex shrink-0 gap-1">
        <button disabled={busy} onClick={onExcluir} className="rounded-lg bg-bad px-2 py-1 text-xs font-semibold text-white">
          Excluir
        </button>
        <button onClick={() => setConfirmar(false)} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-soft">
          Não
        </button>
      </div>
    )
  return (
    <div className="flex shrink-0">
      <button onClick={onEditar} className="rounded-lg p-2 text-muted hover:bg-soft hover:text-ink" title="Editar">
        <Pencil size={15} />
      </button>
      <button
        onClick={() => setConfirmar(true)}
        disabled={emUso > 0}
        title={emUso > 0 ? 'Em uso: renomeie em vez de excluir' : 'Excluir'}
        className="rounded-lg p-2 text-faint hover:bg-bad-soft hover:text-bad disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-faint"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

/** Ex.: vence dia 10, fecha 7 dias antes → "fecha dia 3; compras a partir do dia 3 vão para a fatura seguinte". */
function PreviaFechamento({ dia, dias }: { dia: number; dias: number | null }) {
  if (!dia || dias == null || Number.isNaN(dias)) return null
  const ref = new Date(2026, 0, dia - dias) // mês qualquer com 31 dias, só para calcular o dia
  const diaFech = ref.getDate()
  const mesmoMes = ref.getMonth() === 0
  return (
    <p className="rounded-xl bg-primary-soft px-3 py-2 text-xs text-primary">
      A fatura fecha no dia <b>{diaFech}</b>
      {mesmoMes ? '' : ' do mês anterior ao vencimento'}. Compras até o dia {diaFech === 1 ? 'anterior' : diaFech - 1} entram nela; a partir do dia {diaFech},
      vão para a fatura seguinte.
    </p>
  )
}

const TITULOS: Record<TabConfig, [string, string]> = {
  formas_pagamento: ['Nova forma de pagamento', 'Editar forma de pagamento'],
  categorias: ['Nova categoria', 'Editar categoria'],
  destinos_investimento: ['Novo destino de investimento', 'Editar destino'],
}

function ConfigModal({
  edit,
  model,
  finance,
  uso,
  onClose,
}: {
  edit: Editando
  model: Model
  finance: Finance
  uso: ReturnType<typeof usos>
  onClose: () => void
}) {
  const r = edit.row
  const [f, setF] = useState(() => ({
    nome: str(r?.nome),
    tipo: (r ? tipoForma(r.tipo) : (edit.tipoInicial ?? 'cartao')) as TipoForma,
    dia_vencimento: str(r?.dia_vencimento),
    dias_fechamento: str(r?.dias_fechamento),
    limite: r && num(r.limite) ? fmt(num(r.limite)) : '',
    mes_seguinte: r ? isYes(r.fatura_vence_mes_seguinte) : true,
    cor: str(r?.cor) || (edit.tab === 'categorias' ? corDaPosicao(model.categorias.length) : CORES[5]),
    orcamento: r && num(r.orcamento_mensal) ? fmt(num(r.orcamento_mensal)) : '',
  }))
  const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const antigo = str(r?.nome)
  const renomeando = !!r && f.nome.trim() !== antigo
  const mapaUso = edit.tab === 'formas_pagamento' ? uso.formas : edit.tab === 'categorias' ? uso.categorias : uso.destinos
  const afetados = renomeando ? (mapaUso.get(antigo.toLowerCase()) ?? 0) : 0

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const nome = f.nome.trim()
    if (!nome) return setErr('Informe o nome.')
    const existentes = model.db.tables[edit.tab].filter((x) => x._row !== r?._row).map((x) => str(x.nome).toLowerCase())
    if (existentes.includes(nome.toLowerCase())) return setErr('Já existe um item com esse nome.')
    if (edit.tab === 'formas_pagamento' && f.tipo === 'cartao' && f.dia_vencimento && (Number(f.dia_vencimento) < 1 || Number(f.dia_vencimento) > 31))
      return setErr('Dia de vencimento deve ser entre 1 e 31.')
    if (edit.tab === 'formas_pagamento' && f.tipo === 'cartao' && f.dias_fechamento && (Number(f.dias_fechamento) < 0 || Number(f.dias_fechamento) > 30))
      return setErr('Dias antes do vencimento deve ser entre 0 e 30.')

    let valores: Record<string, string | number> = { nome }
    if (edit.tab === 'formas_pagamento')
      valores = {
        nome,
        tipo: f.tipo,
        dia_vencimento: f.tipo === 'cartao' && f.dia_vencimento ? Number(f.dia_vencimento) : '',
        dias_fechamento: f.tipo === 'cartao' && f.dias_fechamento !== '' ? Number(f.dias_fechamento) : '',
        limite: f.tipo === 'cartao' && f.limite ? num(f.limite) : '',
        fatura_vence_mes_seguinte: f.tipo === 'cartao' ? (f.mes_seguinte ? 'sim' : 'não') : '',
        cor: f.cor,
      }
    if (edit.tab === 'categorias') valores = { nome, orcamento_mensal: f.orcamento ? num(f.orcamento) : '', cor: f.cor }
    if (await finance.actions.salvarConfig(edit.tab, r, valores)) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onSubmit={salvar}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{TITULOS[edit.tab][r ? 1 : 0]}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-soft" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <Field label="Nome">
            <input autoFocus className={inputCls} value={f.nome} onChange={(e) => set('nome', e.target.value)} />
          </Field>

          {edit.tab === 'formas_pagamento' && (
            <>
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">Tipo</span>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1">
                  {(Object.keys(TIPOS) as TipoForma[]).map((id) => {
                    const Icone = TIPOS[id].icone
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => set('tipo', id)}
                        className={cx(
                          'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold',
                          f.tipo === id ? 'bg-card text-ink shadow-sm' : 'text-muted',
                        )}
                      >
                        <Icone size={14} />
                        {id === 'cartao' ? 'Cartão' : TIPOS[id].label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {f.tipo === 'cartao' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Dia de vencimento">
                      <input type="number" min={1} max={31} className={inputCls} value={f.dia_vencimento} onChange={(e) => set('dia_vencimento', e.target.value)} />
                    </Field>
                    <Field label="Fecha quantos dias antes">
                      <input type="number" min={0} max={30} placeholder="ex.: 7" className={inputCls} value={f.dias_fechamento} onChange={(e) => set('dias_fechamento', e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Limite do cartão (opcional)">
                    <MoneyInput value={f.limite} onChange={(v) => set('limite', v)} />
                  </Field>
                  <PreviaFechamento dia={Number(f.dia_vencimento)} dias={f.dias_fechamento === '' ? null : Number(f.dias_fechamento)} />
                </>
              )}
              {f.tipo === 'cartao' && (
                <>
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-muted">Em qual mês a fatura aparece no app?</span>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-soft p-1">
                      {(
                        [
                          [true, 'No mês das compras'],
                          [false, 'No mês do vencimento'],
                        ] as const
                      ).map(([v, label]) => (
                        <button
                          type="button"
                          key={label}
                          onClick={() => set('mes_seguinte', v)}
                          className={cx('rounded-lg px-2 py-1.5 text-xs font-semibold', f.mes_seguinte === v ? 'bg-card text-ink shadow-sm' : 'text-muted')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {f.mes_seguinte
                        ? 'Ex.: as compras de novembro (fatura que vence em dezembro) aparecem em Novembro.'
                        : 'Ex.: a fatura que vence em dezembro aparece em Dezembro, mês em que você paga.'}
                    </p>
                  </div>
                </>
              )}
              <SeletorCor cores={CORES} value={f.cor} onChange={(c) => set('cor', c)} />
            </>
          )}

          {edit.tab === 'categorias' && (
            <>
              <Field label="Orçamento mensal (opcional)">
                <input inputMode="decimal" placeholder="0,00" className={inputCls} value={f.orcamento} onChange={(e) => set('orcamento', e.target.value)} />
              </Field>
              <SeletorCor cores={PALETA_CATEGORIAS} value={f.cor} onChange={(c) => set('cor', c)} />
            </>
          )}

          {afetados > 0 && (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
              Renomear “{antigo}” para “{f.nome.trim()}” também atualiza {afetados} lançamentos que usam esse nome.
            </p>
          )}
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
