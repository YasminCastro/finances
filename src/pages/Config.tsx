import { escFecha } from '@/lib/utils'
import { Barcode, CreditCard, Percent, ExternalLink, LogOut, Moon, Pencil, PiggyBank, Plus, QrCode, Sun, Tags, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Bar, Button, Card, CardTitle, Empty, Field, cx, inputCls } from '../components/kit'
import { MoneyInput } from '../components/MoneyInput'
import { brl, fmt, formaDe, limiteCartao, metaDoDestino, salarioFixo, sugestoesOrcamento } from '../lib/finance'
import type { SugestaoOrcamento } from '../lib/finance'
import { SPREADSHEET_URL } from '../lib/google'
import type { Row } from '../lib/google'
import { corDaPosicao, ordemAlfabetica, PALETA_CATEGORIAS } from '../lib/cores'
import { LIMITES, corCategoria, isYes, num, str, vigente } from '../lib/model'
import type { Model, TipoLimite } from '../lib/model'
import type { Finance, TabConfig } from '../lib/store'

const CORES = ['#EC7000', '#820AD1', '#FF7A00', '#21C25E', '#D7262E', '#2563EB', '#0F172A', '#64748B']

type Editando = { tab: TabConfig; row?: Row; tipoInicial?: TipoForma }

export function Config({ model, finance, dark, setDark }: { model: Model; finance: Finance; dark: boolean; setDark: (d: boolean) => void }) {
  const [edit, setEdit] = useState<Editando | null>(null)
  const t = model.db.tables
  const uso = usos(model)
  const sugestoes = sugestoesOrcamento(model, mesAtual())
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
            <MesFaturas model={model} finance={finance} />

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
        <p className="-mt-2 mb-3 text-xs text-muted">
          O orçamento mensal é o “valor esperado” usado no card de gastos por categoria. É opcional; a sugestão vem do que você costuma gastar.
        </p>
        <ul className="divide-y divide-line">
          {[...t.categorias].sort((a, b) => ordemAlfabetica(str(a.nome), str(b.nome))).map((r) => {
            const n = uso.categorias.get(str(r.nome).toLowerCase()) ?? 0
            const sug = sugestoes.get(str(r.nome).toLowerCase())
            return (
              <CategoriaLinha
                key={r._row}
                nome={str(r.nome)}
                cor={corCategoria(model, str(r.nome))}
                orcamento={num(r.orcamento_mensal)}
                sug={sug}
                busy={finance.busy}
                onUsar={(v) => finance.actions.salvarConfig('categorias', r, { nome: str(r.nome), orcamento_mensal: v, cor: str(r.cor) })}
                acoes={<Acoes onEditar={() => setEdit({ tab: 'categorias', row: r })} emUso={n} onExcluir={() => finance.actions.excluirConfig('categorias', r)} busy={finance.busy} />}
              />
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
                    <div className="truncate text-xs text-muted">{textoMeta(model, str(r.nome))}</div>
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
          <Limites model={model} finance={finance} />
          <a href={SPREADSHEET_URL} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ExternalLink size={16} /> Abrir planilha de dados
          </a>
        </Card>
      </div>

      {edit && <ConfigModal key={edit.tab + (edit.row?._row ?? 'novo')} edit={edit} model={model} finance={finance} uso={uso} onClose={() => setEdit(null)} />}
      <Button className="lg:hidden" onClick={finance.logout}>
        <LogOut size={16} /> Sair da conta
      </Button>
    </div>
  )
}

/** Limites do mês por tipo em % do salário fixo (alerta nos cards dos lançamentos). */
function Limites({ model, finance }: { model: Model; finance: Finance }) {
  const salario = model.entradasFixas.filter((f) => vigente(f, mesAtual())).reduce((a, f) => a + f.valor, 0)
  const soma = Math.round(Object.values(model.limites).reduce((a, v) => a + v, 0) * 100)
  const livre = 100 - soma
  return (
    <div className="border-t border-line py-3 text-sm first:border-t-0">
      <div className="flex items-center gap-2">
        <Percent size={16} /> Limites do mês
      </div>
      <p className="mt-1 text-xs text-muted">
        Em % do salário fixo. Acima do limite, o card do tipo nos lançamentos fica vermelho (amarelo quando está perto). O investimento é
        a meta de quanto guardar por mês (por enquanto só fica registrada).
      </p>
      <div className="mt-3 space-y-2">
        {(Object.keys(LIMITES) as TipoLimite[]).map((k) => (
          <LimiteCampo key={k} k={k} model={model} finance={finance} salario={salario} />
        ))}
      </div>
      <div className={cx('mt-3 rounded-xl px-3 py-2 text-xs', livre < 0 ? 'bg-bad-soft text-bad' : livre === 0 ? 'bg-good-soft text-good' : 'bg-soft text-muted')}>
        Total planejado: <b className="tabular-nums">{soma}%</b> do salário
        {livre < 0 ? ` · passa ${-livre}% do salário, reduza algum limite.` : livre === 0 ? ' · todo o salário tem destino.' : ` · ${livre}% sem destino.`}
      </div>
    </div>
  )
}

function LimiteCampo({ k, model, finance, salario }: { k: TipoLimite; model: Model; finance: Finance; salario: number }) {
  const l = LIMITES[k]
  const atual = Math.round(model.limites[k] * 100)
  const [v, setV] = useState(String(atual))
  useEffect(() => setV(String(atual)), [atual])
  const n = Number(v.replace(',', '.'))
  const valido = Number.isFinite(n) && n > 0 && n <= 100
  const mudou = valido && n !== atual
  const id = `limite-${k}`

  // grava ao sair do campo (Enter também sai); um único caminho evita gravar duas vezes
  const salvar = () => {
    if (mudou) finance.actions.salvarAjuste(l.chave, n)
    else setV(String(atual))
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        ;(document.activeElement as HTMLElement | null)?.blur()
      }}
      className="flex items-center justify-between gap-3"
    >
      <label htmlFor={id} className="min-w-0">
        <div className="font-medium">{l.label}</div>
        <div className="text-xs text-muted tabular-nums">
          {salario > 0 && valido ? `até ${fmt((salario * n) / 100)} por mês` : `padrão ${l.padrao}%`}
        </div>
      </label>
      <div className="relative shrink-0">
        <input
          id={id}
          inputMode="decimal"
          value={v}
          onChange={(e) => setV(e.target.value.replace(/[^\d.,]/g, ''))}
          onBlur={salvar}
          disabled={finance.busy}
          className={cx(inputCls, 'h-9 w-20 pr-7 text-right tabular-nums', !valido && 'border-bad')}
          aria-invalid={!valido}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">%</span>
      </div>
    </form>
  )
}

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

/**
 * Linha da categoria: a barra é o quanto costuma gastar e o tracinho, o orçamento.
 * A escala é da própria linha (o maior dos dois), porque aqui se compara orçamento × hábito
 * dentro da categoria, não as categorias entre si. Sem orçamento não há alerta nenhum.
 */
function CategoriaLinha({
  nome,
  cor,
  orcamento,
  sug,
  busy,
  onUsar,
  acoes,
}: {
  nome: string
  cor: string
  orcamento: number
  sug: SugestaoOrcamento | undefined
  busy: boolean
  onUsar: (v: number) => void
  acoes: ReactNode
}) {
  const temOrc = orcamento > 0
  const escala = Math.max(orcamento, sug?.valor ?? 0, 1)
  let status: ReactNode = null
  if (sug && temOrc) {
    if (sug.valor > orcamento * 1.1) status = <span className="font-semibold text-warn">costuma passar {brl(sug.valor - orcamento)}</span>
    else if (sug.valor < orcamento * 0.6) status = <span>orçamento folgado</span>
    else status = <span className="text-good">bem ajustado</span>
  } else if (sug) status = <span>sem orçamento</span>

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="size-3 shrink-0 rounded-full" style={{ background: cor }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold">{nome}</span>
          {temOrc ? (
            <b className="text-sm whitespace-nowrap tabular-nums">R$ {fmt(orcamento)}</b>
          ) : sug ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onUsar(sug.valor)}
              title="Definir esta sugestão como orçamento mensal"
              className="shrink-0 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-primary hover:brightness-95 disabled:opacity-50"
            >
              Usar R$ {fmt(sug.valor)}
            </button>
          ) : (
            <span className="text-xs whitespace-nowrap text-faint">sem orçamento</span>
          )}
        </div>
        {sug && (
          <>
            <div className="relative mt-1.5 h-1.5 rounded-full bg-soft" title={`Costuma gastar ~R$ ${fmt(sug.valor)}`}>
              <div className="h-full rounded-full" style={{ width: `${(sug.valor / escala) * 100}%`, background: cor }} />
              {temOrc && (
                <div
                  className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-ink/60"
                  style={{ left: `calc(${(orcamento / escala) * 100}% - 1px)` }}
                  title={`Orçamento: ${brl(orcamento)}`}
                />
              )}
            </div>
            <div
              className="mt-1 flex flex-wrap gap-x-1 text-[11px] text-muted tabular-nums"
              title={`Mediana dos gastos avulsos dos últimos ${sug.meses} meses (sem fixos e parcelas)`}
            >
              <span>costuma gastar ~R$ {fmt(sug.valor)}</span>
              {status && <span aria-hidden>·</span>}
              {status}
            </div>
          </>
        )}
      </div>
      {acoes}
    </li>
  )
}

/** Sugestão de orçamento com base no histórico; nunca é aplicada sozinha. */
function SugestaoOrcamentoDica({
  model,
  categoria,
  atual,
  onUsar,
  onLimpar,
}: {
  model: Model
  categoria: string
  atual: string
  onUsar: (v: number) => void
  onLimpar: () => void
}) {
  const s = categoria ? sugestoesOrcamento(model, mesAtual()).get(categoria.toLowerCase()) : undefined
  const temValor = num(atual) > 0
  return (
    <div className="mt-1.5 space-y-1 text-xs text-muted">
      {s ? (
        <p>
          Sugestão: <b className="text-ink">R$ {fmt(s.valor)}</b> — mediana dos seus gastos avulsos nos últimos {s.meses} meses (sem fixos e parcelas).{' '}
          {num(atual) !== s.valor && (
            <button type="button" onClick={() => onUsar(s.valor)} className="font-semibold text-primary hover:underline">
              Usar
            </button>
          )}
        </p>
      ) : (
        categoria && <p>Ainda não há histórico suficiente para sugerir um valor.</p>
      )}
      <p className="text-faint">
        Deixe em branco se não quiser orçamento para esta categoria.{' '}
        {temValor && (
          <button type="button" onClick={onLimpar} className="font-semibold text-muted hover:text-ink hover:underline">
            Remover orçamento
          </button>
        )}
      </p>
    </div>
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
    // cartão novo segue o padrão dos outros cartões
    mes_seguinte: r ? isYes(r.fatura_vence_mes_seguinte) : model.formas.filter((x) => x.cartao).every((x) => x.mes_seguinte) && model.formas.some((x) => x.cartao),
    cor: str(r?.cor) || (edit.tab === 'categorias' ? corDaPosicao(model.categorias.length) : CORES[5]),
    orcamento: r && num(r.orcamento_mensal) ? fmt(num(r.orcamento_mensal)) : '',
    tipo_meta: (r && num(r.meta_meses) > 0 ? 'meses' : r && num(r.meta) > 0 ? 'valor' : 'nenhuma') as 'nenhuma' | 'valor' | 'meses',
    meta: r && num(r.meta) > 0 ? fmt(num(r.meta)) : '',
    meta_meses: r && num(r.meta_meses) > 0 ? String(num(r.meta_meses)).replace('.', ',') : '',
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
    if (edit.tab === 'destinos_investimento') {
      if (f.tipo_meta === 'valor' && !(num(f.meta) > 0)) return setErr('Informe o valor da meta.')
      if (f.tipo_meta === 'meses' && !(num(f.meta_meses) > 0)) return setErr('Informe quantos meses de salário.')
      valores = {
        nome,
        meta: f.tipo_meta === 'valor' ? num(f.meta) : '',
        meta_meses: f.tipo_meta === 'meses' ? num(f.meta_meses) : '',
      }
    }
    if (await finance.actions.salvarConfig(edit.tab, r, valores)) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onSubmit={salvar}
        onMouseDown={(e) => e.stopPropagation()}
        className="sheet max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
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
              {f.tipo === 'cartao' && !r && (
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
              <div>
                <Field label="Orçamento mensal (opcional)">
                  <MoneyInput value={f.orcamento} onChange={(v) => set('orcamento', v)} />
                </Field>
                <SugestaoOrcamentoDica
                  model={model}
                  categoria={antigo || f.nome.trim()}
                  atual={f.orcamento}
                  onUsar={(v) => set('orcamento', fmt(v))}
                  onLimpar={() => set('orcamento', '')}
                />
              </div>
              <SeletorCor cores={PALETA_CATEGORIAS} value={f.cor} onChange={(c) => set('cor', c)} />
            </>
          )}

          {edit.tab === 'destinos_investimento' && (
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted">Meta</span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1">
                {(
                  [
                    ['nenhuma', 'Sem meta'],
                    ['valor', 'Valor'],
                    ['meses', 'Meses de salário'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => set('tipo_meta', id)}
                    aria-pressed={f.tipo_meta === id}
                    className={cx('rounded-lg px-2 py-1.5 text-xs font-semibold', f.tipo_meta === id ? 'bg-card text-ink shadow-sm' : 'text-muted')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {f.tipo_meta === 'valor' && (
                <div className="mt-3">
                  <MoneyInput value={f.meta} onChange={(v) => set('meta', v)} placeholder="60.000,00" />
                </div>
              )}
              {f.tipo_meta === 'meses' && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    inputMode="decimal"
                    className={cx(inputCls, 'w-24 text-right tabular-nums')}
                    value={f.meta_meses}
                    onChange={(e) => set('meta_meses', e.target.value.replace(/[^\d,.]/g, ''))}
                    placeholder="6"
                    aria-label="Meses de salário"
                  />
                  <span className="text-sm text-muted">
                    meses × {fmt(salarioFixo(model, mesAtual()))} ={' '}
                    <b className="text-ink tabular-nums">R$ {fmt(num(f.meta_meses) * salarioFixo(model, mesAtual()))}</b>
                  </span>
                </div>
              )}
              <p className="mt-2 text-xs text-muted">
                {f.tipo_meta === 'meses'
                  ? 'A meta acompanha o salário fixo: se ele mudar, a meta muda junto.'
                  : f.tipo_meta === 'nenhuma'
                    ? 'Bom para dinheiro guardado para compras, sem um valor final.'
                    : 'Quanto você quer juntar nesse destino.'}
              </p>
            </div>
          )}

          {afetados > 0 && (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
              Renomear “{antigo}” para “{f.nome.trim()}” também atualiza {afetados} lançamentos que usam esse nome.
            </p>
          )}
        </div>

        {(err || finance.error) && <div className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err || finance.error}</div>}
        <div className="sheet-footer mt-6 flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={finance.busy}>
            {finance.busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  )
}

/** Em qual mês as faturas aparecem (vale para todos os cartões) — trocar move os lançamentos de cartão junto. */
function MesFaturas({ model, finance }: { model: Model; finance: Finance }) {
  const [destino, setDestino] = useState<'compras' | 'vencimento' | null>(null)
  const cartoes = model.formas.filter((f) => f.cartao)
  if (!cartoes.length) return null
  const naCompra = cartoes.filter((f) => f.mes_seguinte)
  const modo = naCompra.length === 0 ? 'vencimento' : naCompra.length === cartoes.length ? 'compras' : 'misto'

  const alvo = destino === 'vencimento' ? naCompra : destino === 'compras' ? cartoes.filter((f) => !f.mes_seguinte) : []
  const nomes = new Set(alvo.map((f) => f.nome.toLowerCase()))
  const afetados = model.lancamentos.filter((l) => l.row && nomes.has(l.forma_pagamento.toLowerCase())).length

  async function confirmar() {
    if (!destino) return
    if (await finance.actions.mudarMesFatura(alvo.map((f) => f.nome), destino === 'vencimento')) setDestino(null)
  }

  const opcoes = [
    ['compras', 'No mês das compras', 'A fatura que vence em 10/12 aparece em Novembro.'],
    ['vencimento', 'No mês do pagamento', 'A fatura que vence em 10/12 aparece em Dezembro, como no app do cartão.'],
  ] as const

  return (
    <section className="rounded-2xl bg-soft/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Em qual mês as faturas aparecem</h3>
          <p className="mt-0.5 text-xs text-muted">
            {modo === 'misto'
              ? `Hoje está misturado: ${naCompra.map((f) => f.nome).join(', ')} no mês das compras; os outros no mês do pagamento.`
              : opcoes.find((o) => o[0] === modo)![2]}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-card p-1 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          {opcoes.map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={finance.busy}
              onClick={() => setDestino(modo === id ? null : id)}
              className={cx(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                modo === id ? 'bg-primary text-white' : destino === id ? 'bg-primary-soft text-primary' : 'text-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {destino && alvo.length > 0 && (
        <div className="mt-3 rounded-xl border border-warn/30 bg-warn-soft p-3 text-xs text-warn">
          <p>
            Isso muda <b>{alvo.map((f) => f.nome).join(', ')}</b> para o mês {destino === 'vencimento' ? 'do pagamento' : 'das compras'} e move{' '}
            <b>{afetados} lançamentos</b> desses cartões (gastos, parcelas e fixos), além do início/fim das contas fixas deles,{' '}
            <b>1 mês para {destino === 'vencimento' ? 'frente' : 'trás'}</b>. Pix, boleto e entradas não mudam.
          </p>
          <p className="mt-1.5">Dica: o Google Planilhas guarda o histórico de versões (Arquivo → Histórico de versões), caso queira voltar.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDestino(null)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={finance.busy} onClick={confirmar}>
              {finance.busy ? 'Movendo…' : 'Confirmar e mover'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function textoMeta(model: Model, destino: string) {
  const m = model.metas[destino]
  if (!m) return 'Sem meta'
  const v = metaDoDestino(model, destino, mesAtual()) ?? 0
  return m.meses ? `Meta: ${String(m.meses).replace('.', ',')} meses de salário (R$ ${fmt(v)})` : `Meta: R$ ${fmt(v)}`
}
