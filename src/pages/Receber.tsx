import { escFecha } from '@/lib/utils'
import { ArrowDown, ArrowUp, Check, ChevronDown, HandCoins, MinusCircle, Pencil, Plus, Repeat, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button, Card, CardTitle, Field, Money, cx, inputCls } from '../components/kit'
import { Dropdown } from '../components/Dropdown'
import { MoneyInput } from '../components/MoneyInput'
import { DatePicker, MonthPicker } from '../components/pickers'
import { pessoasConhecidas } from '../components/CobrancaFields'
import { addMeses, dataCurta, difMeses, fmt, hoje, mesCurto, receberItens, valorDoRodizio, vezDoRodizio } from '../lib/finance'
import { num } from '../lib/model'
import type { Model, Receber as ItemReceber, Rodizio } from '../lib/model'
import type { Finance } from '../lib/store'

const somar = (xs: ItemReceber[]) => xs.reduce((a, r) => a + r.valor, 0)
/** Mês em que o dinheiro entrou (data do recebimento; sem data, o mês do item). */
const mesRecebido = (r: ItemReceber) => (r.recebido_em ? r.recebido_em.slice(0, 7) : r.mes_ref)

export function Receber({ model, mes, finance }: { model: Model; mes: string; finance: Finance }) {
  const [rodizio, setRodizio] = useState<Rodizio | 'novo' | null>(null)
  // nova cobrança (ou abatimento), opcionalmente já com a pessoa escolhida
  const [nova, setNova] = useState<{ pessoa?: string; abate?: boolean } | null>(null)
  const [historico, setHistorico] = useState(false)
  const [visao, setVisao] = useState<'mes' | 'tudo'>('mes')

  const itens = useMemo(() => receberItens(model), [model])
  const pendentes = itens.filter((r) => !r.recebido)
  const doMes = pendentes.filter((r) => r.mes_ref === mes)
  const recebidosMes = itens.filter((r) => r.recebido && mesRecebido(r) === mes)

  // "Até o mês": o que vence no mês selecionado + o que ficou para trás; "Tudo": inclui as parcelas dos próximos meses
  const visiveis = visao === 'mes' ? pendentes.filter((r) => r.mes_ref <= mes) : pendentes
  const pessoas = useMemo(() => {
    const m = new Map<string, ItemReceber[]>()
    for (const r of visiveis) m.set(r.pessoa, [...(m.get(r.pessoa) ?? []), r])
    return [...m.entries()]
      .map(([pessoa, xs]) => ({ pessoa, itens: xs.sort((a, b) => a.mes_ref.localeCompare(b.mes_ref)), total: somar(xs) }))
      .sort((a, b) => b.total - a.total)
  }, [visiveis])
  const futuros = pendentes.filter((r) => r.mes_ref > mes)

  const recebidos = itens
    .filter((r) => r.recebido)
    .sort((a, b) => (b.recebido_em || b.mes_ref).localeCompare(a.recebido_em || a.mes_ref))
    .slice(0, 30)

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-5">
        <Resumo titulo="Te devem no total" valor={somar(pendentes)} detalhe={`${new Set(pendentes.map((r) => r.pessoa)).size} pessoas`} tom="primary" />
        <Resumo titulo={`A receber de ${mesCurto(mes)}`} valor={somar(doMes)} detalhe={`${doMes.length} ${doMes.length === 1 ? 'item' : 'itens'}`} />
        <Resumo titulo={`Recebido em ${mesCurto(mes)}`} valor={somar(recebidosMes)} detalhe={`${recebidosMes.length} ${recebidosMes.length === 1 ? 'item' : 'itens'}`} tom="good" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-5">
        {/* rodízios */}
        <div className="space-y-4 lg:col-span-2 lg:space-y-5">
          {model.rodizios.map((r) => (
            <RodizioCard key={r.id} r={r} model={model} mes={mes} itens={itens} finance={finance} onEditar={() => setRodizio(r)} />
          ))}
          <button
            type="button"
            onClick={() => setRodizio('novo')}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-line px-4 py-5 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary"
          >
            <Repeat size={16} /> {model.rodizios.length ? 'Novo rodízio' : 'Criar rodízio (ex.: Spotify)'}
          </button>
        </div>

        {/* pessoas */}
        <div className="space-y-4 lg:col-span-3 lg:space-y-5">
          <Card>
            <CardTitle
              icon={<HandCoins size={18} />}
              extra={
                <Button variant="primary" onClick={() => setNova({})}>
                  <Plus size={16} /> Nova cobrança
                </Button>
              }
            >
              Quem te deve
            </CardTitle>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-soft p-1" role="tablist">
                {(
                  [
                    ['mes', `Até ${mesCurto(mes)}`],
                    ['tudo', 'Tudo'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={visao === id}
                    onClick={() => setVisao(id)}
                    className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold', visao === id ? 'bg-card text-ink shadow-sm' : 'text-muted')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {visao === 'mes' && futuros.length > 0 && <span className="text-xs text-muted">+ R$ {fmt(somar(futuros))} nos próximos meses</span>}
            </div>
            {pessoas.length === 0 ? (
              <div className="rounded-2xl bg-soft px-4 py-8 text-center">
                <p className="text-sm font-medium text-ink">{visao === 'mes' && pendentes.length ? `Nada para receber até ${mesCurto(mes)} 🎉` : 'Ninguém te deve nada 🎉'}</p>
                <p className="mt-1 text-xs text-muted">
                  {visao === 'mes' && pendentes.length
                    ? 'As próximas parcelas aparecem em “Tudo” e na tabela por mês.'
                    : 'Ao lançar uma compra, marque “É de outra pessoa” para ela aparecer aqui.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pessoas.map((p) => (
                  <Pessoa key={p.pessoa} {...p} finance={finance} mes={mes} onAbater={() => setNova({ pessoa: p.pessoa, abate: true })} />
                ))}
              </div>
            )}
          </Card>

          <PorMes pendentes={pendentes} mes={mes} />

          {recebidos.length > 0 && (
            <Card className="p-0 sm:p-0">
              <button
                type="button"
                onClick={() => setHistorico(!historico)}
                aria-expanded={historico}
                className="flex w-full items-center justify-between px-5 py-4 text-left sm:px-6"
              >
                <span className="text-[15px] font-semibold">Recebidos</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  últimos {recebidos.length}
                  <ChevronDown size={16} className={cx('transition', historico && 'rotate-180')} />
                </span>
              </button>
              {historico && (
                <ul className="border-t border-line px-5 py-2 sm:px-6">
                  {recebidos.map((r) => (
                    <li key={r.id} className="group flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">
                          <b className="font-medium">{r.pessoa}</b> <span className="text-muted">· {r.descricao}</span>
                        </span>
                        <span className="text-xs text-faint">
                          {mesCurto(r.mes_ref)}
                          {r.recebido_em && ` · recebido ${dataCurta(r.recebido_em)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-good tabular-nums">R$ {fmt(r.valor)}</span>
                        <button
                          type="button"
                          disabled={finance.busy}
                          onClick={() => finance.actions.toggleRecebido(r)}
                          title="Desfazer: voltar para pendente"
                          className="rounded-full p-1 text-faint opacity-0 transition group-hover:opacity-100 hover:bg-soft hover:text-ink focus-visible:opacity-100"
                        >
                          <Undo2 size={14} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      {rodizio && <RodizioModal alvo={rodizio} model={model} mes={mes} finance={finance} onClose={() => setRodizio(null)} />}
      {nova && (
        <NovaCobranca
          model={model}
          mes={mes}
          finance={finance}
          pendentes={pendentes}
          pessoaInicial={nova.pessoa}
          abateInicial={nova.abate}
          onClose={() => setNova(null)}
        />
      )}
    </div>
  )
}

function Resumo({ titulo, valor, detalhe, tom }: { titulo: string; valor: number; detalhe: string; tom?: 'primary' | 'good' }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
        <span>{titulo}</span>
        <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] tabular-nums">{detalhe}</span>
      </div>
      <Money value={valor} className={cx('text-xl sm:text-2xl', tom === 'primary' && 'text-primary', tom === 'good' && 'text-good')} />
    </div>
  )
}

function Avatar({ nome, ativo, eu }: { nome: string; ativo?: boolean; eu?: boolean }) {
  return (
    <span
      className={cx(
        'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        ativo ? 'bg-primary text-white' : eu ? 'bg-soft text-muted' : 'bg-primary-soft text-primary',
      )}
      aria-hidden
    >
      {nome.slice(0, 1).toUpperCase()}
    </span>
  )
}

// ---------- rodízio ----------

function RodizioCard({
  r,
  model,
  mes,
  itens,
  finance,
  onEditar,
}: {
  r: Rodizio
  model: Model
  mes: string
  itens: ItemReceber[]
  finance: Finance
  onEditar: () => void
}) {
  const vez = vezDoRodizio(r, mes)
  const ehEu = !!vez && vez.toLowerCase() === r.eu.toLowerCase()
  const valor = valorDoRodizio(model, r, mes)
  const item = itens.find((x) => x.origem === `rodizio:${r.id}` && x.mes_ref === mes)
  const futuro = mes > hoje().slice(0, 7)
  const proximos = Array.from({ length: 6 }, (_, k) => addMeses(mes, k + 1))

  return (
    <Card>
      <CardTitle
        icon={<Repeat size={18} />}
        extra={
          <button type="button" onClick={onEditar} className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink" title="Editar rodízio">
            <Pencil size={15} />
          </button>
        }
      >
        {r.nome}
        <span className="text-xs font-normal text-muted tabular-nums">R$ {fmt(valor)}/mês</span>
      </CardTitle>

      {!vez ? (
        <p className="rounded-2xl bg-soft px-4 py-4 text-sm text-muted">O rodízio começa em {mesCurto(r.mes_inicio)}.</p>
      ) : (
        <div className={cx('flex items-center gap-3 rounded-2xl p-3', ehEu ? 'bg-soft' : item?.recebido ? 'bg-good-soft' : 'bg-primary-soft/60')}>
          <Avatar nome={vez} ativo={!ehEu} eu={ehEu} />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">Vez de {mesCurto(mes)}</div>
            <div className="truncate font-semibold">{ehEu ? 'Você' : vez}</div>
          </div>
          {ehEu ? (
            <span className="text-xs text-muted">sua vez: sem reembolso</span>
          ) : item?.recebido ? (
            <button
              type="button"
              disabled={finance.busy}
              onClick={() => finance.actions.toggleRecebido(item)}
              title="Desfazer"
              className="flex items-center gap-1 rounded-full bg-good px-2.5 py-1 text-xs font-semibold text-white"
            >
              <Check size={13} strokeWidth={3} /> Recebido
            </button>
          ) : futuro || !item ? (
            <span className="text-xs text-muted">{futuro ? 'ainda não chegou' : ''}</span>
          ) : (
            <Button variant="primary" disabled={finance.busy} onClick={() => finance.actions.toggleRecebido(item)}>
              <Check size={15} /> Recebi
            </Button>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-muted">Próximos meses</div>
        <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
          {proximos.map((m) => {
            const p = vezDoRodizio(r, m)
            const eu = !!p && p.toLowerCase() === r.eu.toLowerCase()
            return (
              <li key={m} className={cx('rounded-xl px-2 py-1.5 text-center', eu ? 'bg-soft' : 'border border-line')}>
                <div className="text-[10px] text-faint uppercase">{mesCurto(m)}</div>
                <div className={cx('truncate text-xs font-semibold', eu ? 'text-muted' : 'text-ink')}>{p ? (eu ? 'Você' : p) : '—'}</div>
              </li>
            )
          })}
        </ol>
      </div>
    </Card>
  )
}

function RodizioModal({ alvo, model, mes, finance, onClose }: { alvo: Rodizio | 'novo'; model: Model; mes: string; finance: Finance; onClose: () => void }) {
  const r = alvo === 'novo' ? null : alvo
  // contas fixas (uma por série, com o nome mais recente)
  const fixos = useMemo(() => {
    const m = new Map<string, { serie: string; nome: string; valor: number }>()
    for (const f of model.fixos) m.set(f.serie, { serie: f.serie, nome: f.descricao, valor: f.valor })
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [model.fixos])
  const sugestaoFixo = !r ? fixos.find((f) => /spotify/i.test(f.nome)) : undefined

  const [nome, setNome] = useState(r?.nome ?? (sugestaoFixo ? sugestaoFixo.nome : 'Spotify'))
  const [fixoId, setFixoId] = useState(r?.fixo_id ?? sugestaoFixo?.serie ?? '')
  const [valor, setValor] = useState(r ? fmt(r.valor) : sugestaoFixo ? fmt(sugestaoFixo.valor) : '')
  const [membros, setMembros] = useState<string[]>(r?.membros ?? [])
  const [eu, setEu] = useState(r?.eu ?? '')
  const [novo, setNovo] = useState('')
  // "vez de quem em qual mês": guardamos o mês do 1º da lista; na tela, a pessoa escolhe quem é a vez no mês atual
  const [vezAgora, setVezAgora] = useState(() => (r ? (vezDoRodizio(r, mes) ?? r.membros[0] ?? '') : ''))
  const [err, setErr] = useState<string | null>(null)
  const [apagar, setApagar] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const adicionar = () => {
    const n = novo.trim()
    if (!n || membros.some((m) => m.toLowerCase() === n.toLowerCase())) return setNovo('')
    setMembros([...membros, n])
    if (!vezAgora) setVezAgora(n)
    setNovo('')
  }
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= membros.length) return
    const xs = [...membros]
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
    setMembros(xs)
  }
  const remover = (i: number) => {
    const x = membros[i]
    setMembros(membros.filter((_, k) => k !== i))
    if (eu === x) setEu('')
    if (vezAgora === x) setVezAgora('')
  }

  // mês em que o 1º da lista tem a vez, para que `vezAgora` caia em `mes`
  const idxVez = membros.indexOf(vezAgora)
  const mesInicio = idxVez >= 0 ? addMeses(mes, -idxVez) : mes
  const previa: Rodizio = { id: '', nome, membros, eu, mes_inicio: mesInicio, valor: num(valor), fixo_id: fixoId, row: r?.row ?? ({} as Rodizio['row']) }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!nome.trim()) return setErr('Dê um nome ao rodízio.')
    if (membros.length < 2) return setErr('Adicione pelo menos duas pessoas.')
    if (!eu) return setErr('Escolha quem é você na lista.')
    if (idxVez < 0) return setErr(`Escolha de quem é a vez em ${mesCurto(mes)}.`)
    if (!fixoId && !(num(valor) > 0)) return setErr('Informe o valor mensal ou ligue a uma conta fixa.')
    const ok = await finance.actions.salvarRodizio(r?.row, {
      nome: nome.trim(),
      membros: membros.join(', '),
      eu,
      mes_inicio: mesInicio,
      valor: num(valor),
      fixo_id: fixoId,
    })
    if (ok) onClose()
  }

  return (
    <Modal onClose={onClose} onSubmit={salvar} titulo={r ? `Editar ${r.nome}` : 'Novo rodízio'}>
      <div className="space-y-4">
        <p className="rounded-xl bg-primary-soft px-3 py-2 text-xs text-primary">
          A assinatura cai no seu cartão e, a cada mês, uma pessoa da lista te reembolsa o valor inteiro. No seu mês, não há reembolso.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Conta fixa ligada">
            <Dropdown
              value={fixoId}
              onChange={(v) => {
                setFixoId(v)
                const f = fixos.find((x) => x.serie === v)
                if (f) setValor(fmt(f.valor))
              }}
              opcoes={[{ value: '', label: 'Nenhuma' }, ...fixos.map((f) => ({ value: f.serie, label: f.nome }))]}
            />
          </Field>
        </div>
        {!fixoId ? (
          <Field label="Valor mensal">
            <MoneyInput value={valor} onChange={setValor} />
          </Field>
        ) : (
          <p className="-mt-2 text-xs text-muted">O valor acompanha a conta fixa (hoje R$ {fmt(valorDoRodizio(model, previa, mes))}).</p>
        )}

        <Field label="Pessoas, na ordem do rodízio">
          <div className="space-y-1.5">
            {membros.map((m, i) => (
              <div key={m} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5">
                <span className="w-5 text-center text-xs text-faint tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate text-sm font-medium">
                  {m} {m === eu && <span className="ml-1 rounded-full bg-soft px-1.5 py-px text-[10px] text-muted">você</span>}
                </span>
                <IconeBtn label="Subir" onClick={() => mover(i, -1)} disabled={i === 0}>
                  <ArrowUp size={14} />
                </IconeBtn>
                <IconeBtn label="Descer" onClick={() => mover(i, 1)} disabled={i === membros.length - 1}>
                  <ArrowDown size={14} />
                </IconeBtn>
                <IconeBtn label="Remover" onClick={() => remover(i)}>
                  <X size={14} />
                </IconeBtn>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                className={inputCls}
                list="rodizio-pessoas"
                placeholder="Nome da pessoa"
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    adicionar()
                  }
                }}
              />
              <datalist id="rodizio-pessoas">
                {pessoasConhecidas(model).map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <Button onClick={adicionar}>
                <Plus size={16} /> Adicionar
              </Button>
            </div>
          </div>
        </Field>

        {membros.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Quem é você">
              <Dropdown value={eu} onChange={setEu} opcoes={[{ value: '', label: 'Escolha…' }, ...membros.map((m) => ({ value: m, label: m }))]} />
            </Field>
            <Field label={`De quem é a vez em ${mesCurto(mes)}`}>
              <Dropdown value={vezAgora} onChange={setVezAgora} opcoes={[{ value: '', label: 'Escolha…' }, ...membros.map((m) => ({ value: m, label: m }))]} />
            </Field>
          </div>
        )}

        {idxVez >= 0 && membros.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: Math.max(6, membros.length) }, (_, k) => addMeses(mes, k)).map((m) => {
              const p = vezDoRodizio(previa, m)
              return (
                <span key={m} className={cx('rounded-lg px-2 py-1 text-[11px] font-medium', p === eu ? 'bg-soft text-muted' : 'bg-primary-soft text-primary')}>
                  {mesCurto(m)} · {p === eu ? 'você' : p}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {err && <div className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err}</div>}
      {apagar && r ? (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-bad/30 bg-bad-soft p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-bad">Excluir o rodízio? Os reembolsos já recebidos continuam no histórico.</span>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setApagar(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              disabled={finance.busy}
              onClick={async () => {
                if (await finance.actions.excluirRodizio(r.row)) onClose()
              }}
            >
              Excluir
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex items-center justify-between gap-2">
          <div>
            {r && (
              <Button variant="ghost" className="text-bad hover:bg-bad-soft hover:text-bad" onClick={() => setApagar(true)}>
                <Trash2 size={16} /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={finance.busy}>
              {finance.busy ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---------- visão mensal ----------

/** Tabela pessoa × mês do que falta receber (atrasados numa coluna própria). */
function PorMes({ pendentes, mes }: { pendentes: ItemReceber[]; mes: string }) {
  const ultimo = pendentes.reduce((a, r) => (r.mes_ref > a ? r.mes_ref : a), mes)
  const n = Math.min(12, 1 + difMeses(mes, ultimo))
  const meses = Array.from({ length: n }, (_, k) => addMeses(mes, k))
  const temAtraso = pendentes.some((r) => r.mes_ref < mes)
  const depois = pendentes.some((r) => r.mes_ref > meses[meses.length - 1])
  const pessoas = [...new Set(pendentes.map((r) => r.pessoa))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  if (!pessoas.length || (meses.length === 1 && !temAtraso)) return null

  const cel = (pessoa: string | null, f: (r: ItemReceber) => boolean) => somar(pendentes.filter((r) => (pessoa === null || r.pessoa === pessoa) && f(r)))
  const colunas: { id: string; label: string; f: (r: ItemReceber) => boolean; tom?: string }[] = [
    ...(temAtraso ? [{ id: 'atraso', label: 'Atrasado', f: (r: ItemReceber) => r.mes_ref < mes, tom: 'text-warn' }] : []),
    ...meses.map((m) => ({ id: m, label: mesCurto(m), f: (r: ItemReceber) => r.mes_ref === m, tom: m === mes ? 'text-primary' : undefined })),
    ...(depois ? [{ id: 'depois', label: 'Depois', f: (r: ItemReceber) => r.mes_ref > meses[meses.length - 1] }] : []),
  ]
  const valor = (v: number) => (v === 0 ? <span className="text-faint">–</span> : fmt(v))

  return (
    <Card className="p-0 sm:p-0">
      <div className="px-5 pt-5 sm:px-6">
        <CardTitle>Por mês</CardTitle>
        <p className="-mt-3 mb-3 text-xs text-muted">O que cada pessoa tem para te pagar em cada mês: parcelas no seu cartão, rodízio e cobranças.</p>
      </div>
      <div className="scroll-thin overflow-x-auto pb-2">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm tabular-nums">
          <thead>
            <tr className="text-[11px] font-semibold text-muted uppercase">
              <th className="sticky left-0 z-10 bg-card px-5 py-2 text-left sm:px-6">Pessoa</th>
              {colunas.map((c) => (
                <th key={c.id} className={cx('px-3 py-2 text-right whitespace-nowrap', c.tom)}>
                  {c.label}
                </th>
              ))}
              <th className="px-5 py-2 text-right sm:px-6">Total</th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={p}>
                <td className="sticky left-0 z-10 border-t border-line bg-card px-5 py-2 font-medium whitespace-nowrap sm:px-6">{p}</td>
                {colunas.map((c) => (
                  <td key={c.id} className={cx('border-t border-line px-3 py-2 text-right whitespace-nowrap', c.id === mes && 'bg-primary-soft/40', c.tom)}>
                    {valor(cel(p, c.f))}
                  </td>
                ))}
                <td className="border-t border-line px-5 py-2 text-right font-semibold whitespace-nowrap sm:px-6">{fmt(cel(p, () => true))}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="sticky left-0 z-10 border-t border-line bg-card px-5 py-2 sm:px-6">Total</td>
              {colunas.map((c) => (
                <td key={c.id} className={cx('border-t border-line px-3 py-2 text-right whitespace-nowrap', c.id === mes && 'bg-primary-soft/40', c.tom)}>
                  {valor(cel(null, c.f))}
                </td>
              ))}
              <td className="border-t border-line px-5 py-2 text-right whitespace-nowrap sm:px-6">{fmt(somar(pendentes))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------- pessoas ----------

function Pessoa({
  pessoa,
  itens,
  total,
  finance,
  mes,
  onAbater,
}: {
  pessoa: string
  itens: ItemReceber[]
  total: number
  finance: Finance
  mes: string
  onAbater: () => void
}) {
  const [aberto, setAberto] = useState(true)
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(pessoa)
  const meses = [...new Set(itens.map((r) => r.mes_ref))]

  const renomear = async (e?: FormEvent) => {
    e?.preventDefault()
    const novo = nome.trim()
    if (!novo || novo === pessoa) return cancelar()
    if (await finance.actions.renomearPessoa(pessoa, novo)) setEditando(false)
  }
  const cancelar = () => {
    setNome(pessoa)
    setEditando(false)
  }
  const atrasados = itens.filter((r) => r.mes_ref < mes).length

  return (
    <section className="rounded-2xl border border-line">
      <div className="flex items-center gap-3 p-3">
        {editando ? (
          <form onSubmit={renomear} className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar nome={nome || pessoa} />
            <input
              autoFocus
              className={cx(inputCls, 'h-9 py-1.5')}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), cancelar())}
              aria-label={`Novo nome de ${pessoa}`}
            />
            <Button type="submit" variant="primary" disabled={finance.busy}>
              <Check size={15} />
            </Button>
            <Button variant="ghost" onClick={cancelar}>
              <X size={15} />
            </Button>
          </form>
        ) : (
          <>
            <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <Avatar nome={pessoa} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{pessoa}</span>
                <span className="text-xs text-muted">
                  {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                  {atrasados > 0 && <span className="text-warn"> · {atrasados} de meses anteriores</span>}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEditando(true)}
              title="Editar nome"
              aria-label={`Editar nome de ${pessoa}`}
              className="rounded-lg p-1.5 text-faint hover:bg-soft hover:text-ink"
            >
              <Pencil size={14} />
            </button>
          </>
        )}
        <span className="text-right">
          <span className="block text-base font-bold tabular-nums">R$ {fmt(total)}</span>
        </span>
        <Button variant="ghost" disabled={finance.busy} onClick={onAbater} title={`Algo que ${pessoa} pagou para você: abate do que ela te deve`}>
          <MinusCircle size={15} /> <span className="hidden sm:inline">Abater</span>
        </Button>
        <Button disabled={finance.busy} onClick={() => finance.actions.marcarRecebidos(itens)} title={`Marcar tudo de ${pessoa} como recebido`}>
          <Check size={15} /> <span className="hidden sm:inline">Recebi tudo</span>
        </Button>
      </div>

      {aberto && (
        <div className="border-t border-line px-3 pt-1 pb-2">
          {meses.map((m) => (
            <div key={m}>
              <div className={cx('px-1 pt-2 pb-1 text-[11px] font-semibold uppercase', m < mes ? 'text-warn' : m === mes ? 'text-primary' : 'text-faint')}>
                {mesCurto(m)}
                {m < mes ? ' · atrasado' : m === mes ? ' · este mês' : ''}
              </div>
              <ul>
                {itens
                  .filter((r) => r.mes_ref === m)
                  .map((r) => (
                    <li key={r.id} className="group flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-soft/70">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {r.descricao}
                        {r.data && <span className="ml-1.5 text-xs text-faint">{dataCurta(r.data)}</span>}
                        {r.origem.startsWith('rodizio:') && <span className="ml-1.5 rounded-full bg-primary-soft px-1.5 py-px text-[10px] text-primary">rodízio</span>}
                        {r.valor < 0 && <span className="ml-1.5 rounded-full bg-good-soft px-1.5 py-px text-[10px] text-good">abate</span>}
                      </span>
                      <span className={cx('text-sm tabular-nums', r.valor < 0 ? 'text-good' : 'text-ink')}>
                        {r.valor < 0 ? '−' : ''}R$ {fmt(Math.abs(r.valor))}
                      </span>
                      {confirmar === r.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => finance.actions.excluirReceber([r])}
                            disabled={finance.busy}
                            className="rounded-md bg-bad px-2 py-0.5 text-[11px] font-semibold text-white"
                          >
                            Excluir
                          </button>
                          <button type="button" onClick={() => setConfirmar(null)} className="rounded-md px-1.5 py-0.5 text-[11px] text-muted hover:bg-soft">
                            Não
                          </button>
                        </span>
                      ) : (
                        <>
                          {r.row && (
                            <button
                              type="button"
                              onClick={() => setConfirmar(r.id)}
                              title="Excluir"
                              className="rounded-full p-1 text-faint opacity-0 transition group-hover:opacity-100 hover:text-bad focus-visible:opacity-100"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={finance.busy}
                            onClick={() => finance.actions.toggleRecebido(r)}
                            title="Marcar como recebido"
                            className="flex size-6 items-center justify-center rounded-full border border-line text-faint transition hover:border-good hover:bg-good-soft hover:text-good"
                          >
                            <Check size={13} strokeWidth={3} />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function NovaCobranca({
  model,
  mes,
  finance,
  pendentes,
  pessoaInicial,
  abateInicial,
  onClose,
}: {
  model: Model
  mes: string
  finance: Finance
  pendentes: ItemReceber[]
  pessoaInicial?: string
  abateInicial?: boolean
  onClose: () => void
}) {
  const [pessoa, setPessoa] = useState(pessoaInicial ?? '')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [mesRef, setMesRef] = useState(mes)
  const [abate, setAbate] = useState(!!abateInicial)
  // abatimento: dia em que a pessoa pagou, e se vira também um gasto seu nos lançamentos
  const [data, setData] = useState(() => (mes === hoje().slice(0, 7) ? hoje() : `${mes}-01`))
  const [lancar, setLancar] = useState(false)
  const [categoria, setCategoria] = useState(model.categorias[0]?.nome ?? '')
  // quanto a pessoa te deve hoje (para mostrar como fica depois do abatimento)
  const deve = somar(pendentes.filter((r) => r.pessoa.toLowerCase() === pessoa.trim().toLowerCase()))
  const v = num(valor)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!pessoa.trim()) return setErr(abate ? 'Informe quem pagou.' : 'Informe quem te deve.')
    if (!abate && !descricao.trim()) return setErr('Preencha a descrição.')
    if (!(v > 0)) return setErr('Informe um valor.')
    if (abate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErr('Informe a data.')
      if (lancar && !descricao.trim()) return setErr('Diga o que foi pago, para aparecer nos lançamentos.')
      const ok = await finance.actions.abater({
        pessoa: pessoa.trim(),
        descricao: descricao.trim() || 'Abatimento',
        valor: v,
        data,
        lancar: lancar ? { categoria } : undefined,
      })
      if (ok) onClose()
      return
    }
    const ok = await finance.actions.append('a_receber', 'R', [
      {
        pessoa: pessoa.trim(),
        descricao: descricao.trim() || 'Abatimento',
        mes_ref: mesRef,
        valor: abate ? -v : v,
        recebido: 'não',
        origem: '',
        tipo: '',
      },
    ])
    if (ok) onClose()
  }

  return (
    <Modal onClose={onClose} onSubmit={salvar} titulo={abate ? `Abater${pessoa.trim() ? ` de ${pessoa.trim()}` : ''}` : 'Nova cobrança'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-soft p-1">
          {(
            [
              [false, 'Me deve'],
              [true, 'Pagou por mim (abate)'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setAbate(v)}
              className={cx('rounded-lg px-2 py-1.5 text-xs font-semibold', abate === v ? 'bg-card text-ink shadow-sm' : 'text-muted')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Pessoa">
            <input autoFocus={!pessoaInicial} className={inputCls} list="nova-pessoas" value={pessoa} onChange={(e) => setPessoa(e.target.value)} placeholder="Nome" />
            <datalist id="nova-pessoas">
              {pessoasConhecidas(model).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label={abate ? 'O que pagou (opcional)' : 'Descrição'}>
            <input
              className={inputCls}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={abate ? 'Ex.: almoço, Uber, Pix' : ''}
            />
          </Field>
          <Field label="Valor">
            <MoneyInput value={valor} onChange={setValor} autoFocus={!!pessoaInicial} />
          </Field>
          {abate ? (
            <Field label="Data">
              <DatePicker value={data} onChange={setData} />
            </Field>
          ) : (
            <Field label="Mês">
              <MonthPicker value={mesRef} onChange={setMesRef} />
            </Field>
          )}
        </div>
        {abate && (
          <div className={cx('rounded-2xl border p-3 transition', lancar ? 'border-primary/40 bg-primary-soft/40' : 'border-line')}>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-(--color-primary)" checked={lancar} onChange={(e) => setLancar(e.target.checked)} />
              <span>
                <span className="font-semibold">Lançar também nos meus gastos</span>
                <span className="block text-xs text-muted">
                  Quando ela pagou algo que era seu (ex.: seu almoço). Entra nos lançamentos de {mesCurto(data.slice(0, 7) || mes)} como “Pago por{' '}
                  {pessoa.trim() || '…'}”, sem ir para fatura nem contas a pagar.
                </span>
              </span>
            </label>
            {lancar && (
              <div className="mt-3">
                <Field label="Categoria">
                  <Dropdown value={categoria} onChange={setCategoria} opcoes={model.categorias.map((c) => ({ value: c.nome, label: c.nome, cor: c.cor }))} />
                </Field>
              </div>
            )}
          </div>
        )}
        {abate && pessoa.trim() && deve !== 0 && v > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-good-soft px-3 py-2 text-sm">
            <span className="text-muted">
              {pessoa.trim()} te deve <b className="text-ink tabular-nums">R$ {fmt(deve)}</b>
            </span>
            <span className="text-good">
              → passa a dever <b className="tabular-nums">R$ {fmt(deve - v)}</b>
            </span>
          </div>
        )}
        <p className="text-xs text-muted">
          {abate
            ? 'Algo que a pessoa pagou para você: diminui o que ela te deve. Se passar do que ela deve, a diferença fica como crédito dela.'
            : 'Para uma compra no seu cartão, prefira marcar “É de outra pessoa” ao lançar a compra: assim seus limites contam só a sua parte.'}
        </p>
      </div>
      {(err || finance.error) && <div className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err || finance.error}</div>}
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={finance.busy}>
          {finance.busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </Modal>
  )
}

// ---------- miúdos ----------

function Modal({ titulo, children, onClose, onSubmit }: { titulo: string; children: ReactNode; onClose: () => void; onSubmit: (e: FormEvent) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onSubmit={onSubmit}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
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

function IconeBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-md p-1 text-muted hover:bg-soft hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
