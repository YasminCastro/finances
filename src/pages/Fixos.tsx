import { escFecha } from '@/lib/utils'
import { CalendarClock, Pencil, Plus, Repeat, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button, Card, Empty, Field, Money, cx, inputCls } from '../components/kit'
import { Dropdown } from '../components/Dropdown'
import { MoneyInput } from '../components/MoneyInput'
import { MonthPicker } from '../components/pickers'
import { addMeses, brl, fmt, formaDe, mesCurto, ocorrenciaFixo, proximaOcorrencia, seriesFixas } from '../lib/finance'
import type { Serie } from '../lib/finance'
import { corCategoria, num, vigente } from '../lib/model'
import type { Fixo, Lancamento, Model, VersaoFixa } from '../lib/model'
import type { Finance, TabFixa } from '../lib/store'
import { ordemAlfabetica } from '../lib/cores'

type Alvo = { tab: TabFixa; serie?: Serie<VersaoFixa> }

export function Fixos({ model, mes, finance }: { model: Model; mes: string; finance: Finance }) {
  const [alvo, setAlvo] = useState<Alvo | null>(null)
  const contas = seriesFixas(model.fixos, mes)
  const entradas = seriesFixas(model.entradasFixas, mes)
  const ajustes = model.lancamentos.filter((l) => l.mes_ref === mes && l.tipo === 'fixo' && l.fixo_id)

  const ativas = <T extends VersaoFixa>(s: Serie<T>[]) => s.filter((x) => x.atual || x.proxima)
  // Encerradas: só as que terminaram há no máximo 3 meses (em relação ao mês que está sendo visto).
  const limiteEncerradas = addMeses(mes, -3)
  const encerradas = <T extends VersaoFixa>(s: Serie<T>[]) =>
    s.filter((x) => {
      if (x.atual || x.proxima) return false
      const ult = x.versoes[x.versoes.length - 1]
      const fim = ult.mes_fim || (ult.mes_inicio ? addMeses(ult.mes_inicio, -1) : '')
      return !!fim && fim >= limiteEncerradas && fim < mes
    })
  const totalContas = ativas(contas).reduce((a, s) => a + (valorNoMes(s, ajustes, mes)), 0)
  const totalEntradas = ativas(entradas).reduce((a, s) => a + (s.atual?.valor ?? 0), 0)

  // Contas agrupadas por categoria (ordem alfabética), com subtotal.
  const grupos = new Map<string, Serie<Fixo>[]>()
  for (const s of ativas(contas)) {
    const cat = (s.atual ?? s.proxima)!.categoria || 'Outros'
    grupos.set(cat, [...(grupos.get(cat) ?? []), s])
  }
  const porCategoria = [...grupos.entries()]
    .sort(([a], [b]) => ordemAlfabetica(a, b))
    .map(([cat, itens]) => ({
      cat,
      cor: corCategoria(model, cat),
      itens: itens.sort((a, b) => ordemAlfabetica((a.atual ?? a.proxima)!.descricao, (b.atual ?? b.proxima)!.descricao)),
      subtotal: itens.reduce((a, s) => a + (valorNoMes(s, ajustes, mes)), 0),
    }))

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-5">
      {/* Coluna da esquerda: resumo + entradas */}
      <div className="space-y-4 lg:sticky lg:top-5 lg:space-y-5">
        <Resumo entradas={totalEntradas} contas={totalContas} />

        <Card>
          <Cabecalho titulo="Entradas fixas" total={totalEntradas} tom="good" onNovo={() => setAlvo({ tab: 'entradas_fixas' })} />
          {ativas(entradas).length === 0 ? (
            <Empty>Cadastre o seu salário para ele aparecer todo mês.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {ativas(entradas).map((s) => (
                <Linha key={s.serie} model={model} serie={s} mes={mes} onEditar={() => setAlvo({ tab: 'entradas_fixas', serie: s })} />
              ))}
            </ul>
          )}
          <Encerradas series={encerradas(entradas)} />
        </Card>
      </div>

      {/* Coluna da direita: contas por categoria */}
      <Card>
        <Cabecalho titulo="Contas fixas" total={totalContas} onNovo={() => setAlvo({ tab: 'fixos' })} />
        {porCategoria.length === 0 ? (
          <Empty>Nenhuma conta fixa vigente.</Empty>
        ) : (
          <div className="space-y-5">
            {porCategoria.map((g) => (
              <section key={g.cat}>
                <div className="mb-1 flex items-center gap-2 border-b border-line pb-2">
                  <span className="size-2.5 rounded-full" style={{ background: g.cor }} />
                  <h3 className="flex-1 text-xs font-semibold tracking-wide text-muted uppercase">{g.cat}</h3>
                  <span className="mr-[39px] text-xs font-semibold text-muted tabular-nums">{brl(g.subtotal)}</span>
                </div>
                <ul className="divide-y divide-line">
                  {g.itens.map((s) => (
                    <Linha
                      key={s.serie}
                      model={model}
                      serie={s}
                      mes={mes}
                      ajuste={ajustes.find((l) => l.fixo_id === s.serie)}
                      onEditar={() => setAlvo({ tab: 'fixos', serie: s })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <Encerradas series={encerradas(contas)} />
      </Card>

      {alvo && <FixoModal alvo={alvo} model={model} mes={mes} finance={finance} onClose={() => setAlvo(null)} />}
    </div>
  )
}

/** Lista recolhível dos itens encerrados, no rodapé de cada card. */
function Encerradas({ series }: { series: Serie<VersaoFixa>[] }) {
  const [ver, setVer] = useState(false)
  if (!series.length) return null
  return (
    <div className="mt-5 border-t border-line pt-3">
      <button onClick={() => setVer(!ver)} className="text-xs font-semibold text-muted hover:text-ink">
        {ver ? 'Esconder' : 'Ver'} encerradas ({series.length})
      </button>
      {ver && (
        <ul className="mt-2 divide-y divide-line">
          {series.map((s) => {
            const ult = s.versoes[s.versoes.length - 1]
            return (
              <li key={s.serie} className="flex justify-between gap-3 py-2 text-sm text-muted">
                <span className="truncate">{ult.descricao}</span>
                <span className="whitespace-nowrap">
                  R$ {fmt(ult.valor)} · {ult.mes_fim ? `até ${mesCurto(ult.mes_fim)}` : 'inativa'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function valorNoMes(s: Serie<VersaoFixa>, ajustes: Lancamento[], mes: string) {
  const ajuste = ajustes.find((l) => l.fixo_id === s.serie)
  if (ajuste) return ajuste.valor
  if (!s.atual) return 0
  const f = s.atual as Fixo
  return 'frequencia' in f ? (ocorrenciaFixo(f, mes)?.valor ?? 0) : s.atual.valor
}

/** Texto curto da repetição: "a cada 3 meses · 2×" (vazio se for todo mês, à vista). */
function textoRepeticao(f: Partial<Fixo>) {
  const freq = f.frequencia ?? 1
  const parc = f.parcelas ?? 1
  if (freq <= 1 && parc <= 1) return ''
  return [freq > 1 ? `a cada ${freq} meses` : 'todo mês', parc > 1 ? `${parc}×` : ''].filter(Boolean).join(' · ')
}

/** Quanto das entradas fixas já está comprometido com contas fixas. */
function Resumo({ entradas, contas }: { entradas: number; contas: number }) {
  const pctUsado = entradas > 0 ? contas / entradas : 0
  const sobra = entradas - contas
  return (
    <Card>
      <div className="text-xs text-muted">Sobra depois dos fixos</div>
      <Money value={sobra} className="mt-1 text-4xl" tone={sobra < 0 ? 'bad' : 'default'} />
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-good/25">
        <div className="h-full rounded-full bg-seg-1" style={{ width: `${Math.min(100, pctUsado * 100)}%` }} />
      </div>
      <div className="mt-2 text-xs text-muted">
        <b className="text-ink">{Math.round(pctUsado * 100)}%</b> das entradas vão para contas fixas
      </div>
    </Card>
  )
}

function Cabecalho({ titulo, total, tom, onNovo }: { titulo: string; total: number; tom?: 'good'; onNovo: () => void }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        <Money value={total} className="mt-1 text-2xl" tone={tom === 'good' ? 'good' : 'default'} />
        <span className="ml-1 text-xs text-muted">/ mês</span>
      </div>
      <Button onClick={onNovo} className="py-1.5 text-xs">
        <Plus size={14} /> Nova
      </Button>
    </div>
  )
}

function Linha({
  model,
  serie,
  mes,
  ajuste,
  onEditar,
}: {
  model: Model
  serie: Serie<VersaoFixa>
  mes: string
  ajuste?: Lancamento
  onEditar: () => void
}) {
  const v = (serie.atual ?? serie.proxima)!
  const f = v as Partial<Fixo>
  const forma = f.forma_pagamento ? formaDe(model, f.forma_pagamento) : undefined
  const repete = textoRepeticao(f)
  const ehConta = 'frequencia' in v
  const oc = ehConta && serie.atual ? ocorrenciaFixo(serie.atual as Fixo, mes) : null
  const foraDoMes = ehConta && !!serie.atual && !oc
  const proxima = foraDoMes ? proximaOcorrencia(serie.atual as Fixo, mes) : null
  const valorMostrado = oc ? oc.valor : ehConta && (f.parcelas ?? 1) > 1 ? v.valor / (f.parcelas ?? 1) : v.valor
  return (
    <li className={cx('group flex items-center gap-3 py-2.5', foraDoMes && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{v.descricao}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted empty:hidden">
          {f.forma_pagamento && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: forma?.cor || 'var(--color-faint)' }} />
              {f.forma_pagamento}
            </span>
          )}
          {f.dia_vencimento ? <span>· vence dia {f.dia_vencimento}</span> : null}
          {repete && (
            <span className="inline-flex items-center gap-1">
              · <Repeat size={11} /> {repete}
              {oc && oc.de > 1 ? ` (parcela ${oc.parcela}/${oc.de})` : ''}
            </span>
          )}
          {foraDoMes && <Tag tone="primary">{proxima ? `próxima em ${mesCurto(proxima)}` : 'sem próximas'}</Tag>}
          {!serie.atual && serie.proxima && <Tag tone="primary">começa em {mesCurto(serie.proxima.mes_inicio)}</Tag>}
          {serie.atual && serie.proxima && (
            <Tag tone="primary">
              R$ {fmt(serie.proxima.valor)} a partir de {mesCurto(serie.proxima.mes_inicio)}
            </Tag>
          )}
          {serie.terminaEm && <Tag tone="warn">termina em {mesCurto(serie.terminaEm)}</Tag>}
          {ajuste && <Tag tone="warn">só em {mesCurto(mes)}: R$ {fmt(ajuste.valor)}</Tag>}
        </div>
      </div>
      <div className={cx('text-sm font-semibold whitespace-nowrap tabular-nums', ajuste && 'text-muted line-through')}>R$ {fmt(valorMostrado)}</div>
      <button
        onClick={onEditar}
        className="rounded-lg p-1.5 text-faint transition hover:bg-soft hover:text-ink lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
        title="Editar"
        aria-label={`Editar ${v.descricao}`}
      >
        <Pencil size={15} />
      </button>
    </li>
  )
}

/** Ex.: "R$ 288,28 a cada 3 meses, em 2× de R$ 144,14. Próximas: dez/26, jan/27, mar/27…" */
function PreviaRepeticao({ valor, freq, parcelas, inicio }: { valor: number; freq: number; parcelas: number; inicio: string }) {
  const f = { valor, frequencia: freq, parcelas, mes_inicio: inicio, mes_fim: '', ativo: true } as Fixo
  const meses: string[] = []
  for (let i = 0; i < 24 && meses.length < 5; i++) {
    const m = addMeses(inicio, i)
    if (ocorrenciaFixo(f, m)) meses.push(mesCurto(m))
  }
  const parcela = ocorrenciaFixo(f, inicio)?.valor ?? valor
  return (
    <p className="rounded-xl bg-soft px-3 py-2 text-xs text-muted">
      <b className="text-ink">{brl(valor)}</b> {freq > 1 ? `a cada ${freq} meses` : 'todo mês'}
      {parcelas > 1 ? `, em ${parcelas}× de ${brl(parcela)}` : ''}. Próximas cobranças: {meses.join(', ')}…
    </p>
  )
}

function Tag({ children, tone }: { children: ReactNode; tone: 'primary' | 'warn' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
        tone === 'primary' ? 'bg-primary-soft text-primary' : 'bg-warn-soft text-warn',
      )}
    >
      <CalendarClock size={11} />
      {children}
    </span>
  )
}

// ---------- formulário ----------

type Modo = 'a_partir' | 'so_mes' | 'encerrar'

function FixoModal({ alvo, model, mes, finance, onClose }: { alvo: Alvo; model: Model; mes: string; finance: Finance; onClose: () => void }) {
  const conta = alvo.tab === 'fixos'
  const novo = !alvo.serie
  const base = (alvo.serie?.atual ?? alvo.serie?.proxima) as Partial<Fixo> | undefined
  const [modo, setModo] = useState<Modo>('a_partir')
  const [quando, setQuando] = useState(mes)
  const [err, setErr] = useState<string | null>(null)
  const ajuste = conta && alvo.serie ? model.lancamentos.find((l) => l.mes_ref === quando && l.tipo === 'fixo' && l.fixo_id === alvo.serie!.serie) : undefined
  const [f, setF] = useState(() => ({
    descricao: base?.descricao ?? '',
    valor: base ? fmt(base.valor ?? 0) : '',
    categoria: base?.categoria ?? model.categorias.find((c) => c.nome === 'Contas Fixas')?.nome ?? model.categorias[0]?.nome ?? '',
    forma_pagamento: base?.forma_pagamento ?? model.formas[0]?.nome ?? '',
    dia_vencimento: base?.dia_vencimento ? String(base.dia_vencimento) : '',
    frequencia: String(base?.frequencia ?? 1),
    parcelas: String(base?.parcelas ?? 1),
  }))
  const freqNum = Math.max(1, Math.round(Number(f.frequencia)) || 1)
  const parcNum = Math.min(freqNum, Math.max(1, Math.round(Number(f.parcelas)) || 1))
  const comRepeticao = conta && modo !== 'so_mes' && (freqNum > 1 || parcNum > 1)
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    const a = finance.actions
    if (modo !== 'encerrar') {
      if (!f.descricao.trim()) return setErr('Preencha a descrição.')
      if (!num(f.valor)) return setErr('Informe um valor.')
    }
    const campos: Record<string, string | number> = { descricao: f.descricao.trim(), valor: num(f.valor) }
    if (conta)
      Object.assign(campos, {
        categoria: f.categoria,
        forma_pagamento: f.forma_pagamento,
        dia_vencimento: f.dia_vencimento ? Number(f.dia_vencimento) : '',
        ...(modo === 'so_mes' ? {} : { frequencia_meses: freqNum, parcelas: parcNum }),
      })

    let ok = false
    if (novo) ok = await a.novoFixo(alvo.tab, campos, quando)
    else if (modo === 'encerrar') ok = await a.encerrarFixo(alvo.tab, alvo.serie!.versoes, quando)
    else if (modo === 'so_mes') {
      const fixo = (alvo.serie!.versoes.find((v) => vigente(v, quando)) ?? base) as Fixo
      ok = await a.ajustarFixoNoMes(fixo, campos, quando, ajuste)
    } else {
      const vs = alvo.serie!.versoes
      const v = vs.find((x) => vigente(x, quando)) ?? [...vs].reverse().find((x) => !x.mes_inicio || x.mes_inicio <= quando) ?? vs[0]
      ok = await a.alterarFixo(alvo.tab, v, campos, quando)
    }
    if (ok) onClose()
  }

  const modos: { id: Modo; label: string; show: boolean }[] = [
    { id: 'a_partir', label: 'A partir de um mês', show: true },
    { id: 'so_mes', label: 'Só em um mês', show: conta },
    { id: 'encerrar', label: 'Encerrar', show: true },
  ]
  const textoQuando = novo
    ? 'Começa em'
    : modo === 'a_partir'
      ? 'Vale a partir de'
      : modo === 'so_mes'
        ? 'Mês'
        : 'Última cobrança em ' + mesCurto(addMeses(quando, -1)) + '; para a partir de'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onSubmit={salvar}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {novo ? (conta ? 'Nova conta fixa' : 'Nova entrada fixa') : `Editar ${base?.descricao ?? ''}`}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-soft" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {!novo && (
          <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-soft p-1">
            {modos
              .filter((m) => m.show)
              .map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setModo(m.id)}
                  className={cx('rounded-lg px-2 py-1.5 text-xs font-semibold', modo === m.id ? 'bg-card text-ink shadow-sm' : 'text-muted')}
                >
                  {m.label}
                </button>
              ))}
          </div>
        )}

        <div className="space-y-4">
          <Field label={textoQuando}>
            <MonthPicker value={quando} onChange={setQuando} />
          </Field>

          {modo !== 'encerrar' && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Descrição">
                  <input className={inputCls} value={f.descricao} onChange={(e) => set('descricao')(e.target.value)} />
                </Field>
                <Field label={comRepeticao ? 'Valor total de cada compra' : 'Valor'}>
                  <MoneyInput value={f.valor} onChange={set('valor')} />
                </Field>
              </div>
              {conta && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Categoria">
                      <Dropdown value={f.categoria} onChange={set('categoria')} opcoes={model.categorias.map((c) => ({ value: c.nome, label: c.nome, cor: c.cor }))} />
                    </Field>
                    <Field label="Forma de pagamento">
                      <Dropdown value={f.forma_pagamento} onChange={set('forma_pagamento')} opcoes={model.formas.map((c) => ({ value: c.nome, label: c.nome, cor: c.cor || undefined }))} />
                    </Field>
                  </div>
                  <div className={cx('grid grid-cols-2 gap-4', modo !== 'so_mes' && 'sm:grid-cols-3')}>
                    {modo !== 'so_mes' && (
                      <>
                        <Field label="Repetir">
                          <Dropdown
                            value={String(freqNum)}
                            onChange={set('frequencia')}
                            opcoes={[...new Set([1, 2, 3, 4, 6, 12, freqNum])]
                              .sort((a, b) => a - b)
                              .map((n) => ({ value: String(n), label: n === 1 ? 'Todo mês' : n === 12 ? 'Uma vez por ano' : `A cada ${n} meses` }))}
                          />
                        </Field>
                        <Field label="Parcelas">
                          <input
                            type="number"
                            min={1}
                            max={freqNum}
                            disabled={freqNum === 1}
                            className={cx(inputCls, freqNum === 1 && 'opacity-50')}
                            value={freqNum === 1 ? '1' : f.parcelas}
                            onChange={(e) => set('parcelas')(e.target.value)}
                          />
                        </Field>
                      </>
                    )}
                    <Field label="Dia de vencimento">
                      <input type="number" min={1} max={31} placeholder="opcional" className={inputCls} value={f.dia_vencimento} onChange={(e) => set('dia_vencimento')(e.target.value)} />
                    </Field>
                  </div>
                </>
              )}
              {comRepeticao && f.valor && (
                <PreviaRepeticao valor={num(f.valor)} freq={freqNum} parcelas={parcNum} inicio={quando} />
              )}
            </>
          )}

          <Explicacao novo={novo} modo={modo} quando={quando} conta={conta} temAjuste={!!ajuste} />

          {alvo.serie && alvo.serie.versoes.length > 1 && (
            <div className="rounded-xl bg-soft p-3 text-xs">
              <div className="mb-1 font-semibold text-muted">Histórico de valores</div>
              {alvo.serie.versoes.map((v) => (
                <div key={v.id} className={cx('flex justify-between', !v.ativo && 'line-through opacity-60')}>
                  <span>
                    {v.mes_inicio ? `de ${mesCurto(v.mes_inicio)}` : 'desde o início'}
                    {v.mes_fim ? ` até ${mesCurto(v.mes_fim)}` : ' em diante'}
                  </span>
                  <b>R$ {fmt(v.valor)}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        {(err || finance.error) && <div className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err || finance.error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant={modo === 'encerrar' ? 'danger' : 'primary'} disabled={finance.busy}>
            {finance.busy ? 'Salvando…' : modo === 'encerrar' && !novo ? 'Encerrar' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Explicacao({ novo, modo, quando, conta, temAjuste }: { novo: boolean; modo: Modo; quando: string; conta: boolean; temAjuste: boolean }) {
  const m = mesCurto(quando)
  let txt = ''
  if (novo) txt = `Aparece todo mês a partir de ${m}.`
  else if (modo === 'a_partir') txt = `Os meses até ${mesCurto(addMeses(quando, -1))} continuam com o valor antigo. De ${m} em diante vale o novo.`
  else if (modo === 'so_mes')
    txt = temAjuste ? `Atualiza o ajuste que já existe em ${m}. O modelo não muda.` : `Muda só ${m}. Os outros meses continuam com o valor do modelo.`
  else txt = `${conta ? 'A conta' : 'A entrada'} deixa de aparecer a partir de ${m}. Os meses anteriores não mudam.`
  return <p className="rounded-xl bg-primary-soft px-3 py-2 text-xs text-primary">{txt}</p>
}
