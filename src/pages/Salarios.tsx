import { escFecha } from '@/lib/utils'
import { ClipboardPaste, Pencil, Plus, TrendingUp, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { MoneyInput } from '../components/MoneyInput'
import { DatePicker } from '../components/pickers'
import { Button, Card, CardTitle, Field, Money, cx, inputCls } from '../components/kit'
import { brl, fmt, hoje } from '../lib/finance'
import { normData, num } from '../lib/model'
import type { Model, Salario } from '../lib/model'
import type { Finance } from '../lib/store'

const MOTIVOS = ['Aumento', 'Reajuste anual', 'Promoção', 'Troca de empresa', 'Primeiro emprego']

/** dd/mm/aaaa */
const dataBR = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '')
const mesAno = (d: string) => `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(d.slice(5, 7)) - 1]}/${d.slice(2, 4)}`
const dias = (de: string, ate: string) => (new Date(ate + 'T12:00').getTime() - new Date(de + 'T12:00').getTime()) / 86400000
const pctTxt = (p: number) => `${p >= 0 ? '+' : '−'}${Math.abs(p * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`

/** Tempo entre duas datas em "2 anos e 3 meses". */
function duracao(de: string, ate: string) {
  const [y1, m1] = de.split('-').map(Number)
  const [y2, m2] = ate.split('-').map(Number)
  const meses = Math.max(0, (y2 - y1) * 12 + (m2 - m1))
  const a = Math.floor(meses / 12)
  const m = meses % 12
  const partes = [a ? `${a} ${a === 1 ? 'ano' : 'anos'}` : '', m ? `${m} ${m === 1 ? 'mês' : 'meses'}` : '']
  return partes.filter(Boolean).join(' e ') || 'menos de 1 mês'
}

export function Salarios({ model, finance }: { model: Model; finance: Finance }) {
  const lista = model.salarios
  const [edit, setEdit] = useState<Salario | 'novo' | null>(null)
  const [importar, setImportar] = useState(false)
  const variacao = (k: number) => (k > 0 && lista[k - 1].valor > 0 ? lista[k].valor / lista[k - 1].valor - 1 : null)

  const primeiro = lista[0]
  const atual = lista[lista.length - 1]
  const h = hoje()
  const anos = primeiro ? Math.max(dias(primeiro.data, h) / 365.25, 0) : 0
  const crescimento = primeiro && atual ? atual.valor / primeiro.valor - 1 : 0
  const anual = primeiro && anos >= 1 ? Math.pow(atual.valor / primeiro.valor, 1 / anos) - 1 : null

  return (
    <div className="space-y-4 lg:space-y-5">
      {lista.length === 0 ? (
        <Card className="py-10 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <TrendingUp size={28} />
          </div>
          <h2 className="mt-4 text-lg font-bold">Sua progressão salarial</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Registre cada mudança de salário (data, valor, empresa, cargo e motivo). A variação em relação ao anterior é calculada sozinha.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="primary" onClick={() => setEdit('novo')}>
              <Plus size={16} /> Adicionar salário
            </Button>
            <Button variant="secondary" onClick={() => setImportar(true)}>
              <ClipboardPaste size={15} /> Colar da planilha
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* resumo */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Card className="col-span-2 !p-4 lg:col-span-1">
              <div className="text-xs font-semibold text-muted">Salário atual</div>
              <Money value={atual.valor} className="mt-1.5 text-3xl" />
              <div className="mt-1 truncate text-xs text-muted">
                {atual.cargo}
                {atual.empresa && ` · ${atual.empresa}`}
              </div>
            </Card>
            <Resumo label="Crescimento total" valor={lista.length > 1 ? pctTxt(crescimento) : '—'} detalhe={lista.length > 1 ? `${(atual.valor / primeiro.valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× desde ${mesAno(primeiro.data)}` : 'precisa de 2 registros'} bom={crescimento > 0} />
            <Resumo label="Média por ano" valor={anual !== null ? pctTxt(anual) : '—'} detalhe={anual !== null ? 'crescimento composto' : 'menos de 1 ano de histórico'} bom={(anual ?? 0) > 0} />
            <Resumo
              label="Último aumento"
              valor={lista.length > 1 && variacao(lista.length - 1) !== null ? pctTxt(variacao(lista.length - 1)!) : '—'}
              detalhe={`em ${dataBR(atual.data)} · há ${duracao(atual.data, h)}`}
              bom={(variacao(lista.length - 1) ?? 0) > 0}
            />
          </div>

          <Grafico lista={lista} />

          {/* tabela */}
          <Card>
            <CardTitle
              extra={
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setImportar(true)} title="Colar as linhas da sua planilha">
                    <ClipboardPaste size={15} /> <span className="hidden sm:inline">Colar da planilha</span>
                  </Button>
                  <Button variant="primary" onClick={() => setEdit('novo')}>
                    <Plus size={16} /> Adicionar
                  </Button>
                </div>
              }
            >
              Histórico
            </CardTitle>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-2 py-2 font-semibold">Início</th>
                    <th className="px-2 py-2 text-right font-semibold">Salário</th>
                    <th className="px-2 py-2 font-semibold">Empresa</th>
                    <th className="px-2 py-2 font-semibold">Cargo</th>
                    <th className="px-2 py-2 font-semibold">Motivo</th>
                    <th className="px-2 py-2 text-right font-semibold">Variação</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...lista].reverse().map((s) => {
                    const k = lista.indexOf(s)
                    const v = variacao(k)
                    return (
                      <tr key={s.id || s.data} className="group hover:bg-soft/60">
                        <td className="px-2 py-2.5 whitespace-nowrap tabular-nums">{dataBR(s.data)}</td>
                        <td className="px-2 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">R$ {fmt(s.valor)}</td>
                        <td className="px-2 py-2.5">{s.empresa}</td>
                        <td className="px-2 py-2.5">{s.cargo}</td>
                        <td className="px-2 py-2.5 text-muted">{s.motivo}</td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">
                          {v === null ? (
                            <span className="text-faint">—</span>
                          ) : (
                            <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', v >= 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>{pctTxt(v)}</span>
                          )}
                        </td>
                        <td className="px-1 py-2.5">
                          <button
                            type="button"
                            onClick={() => setEdit(s)}
                            aria-label={`Editar salário de ${dataBR(s.data)}`}
                            title="Editar"
                            className="rounded-md p-1 text-muted opacity-60 group-hover:opacity-100 hover:bg-soft hover:text-ink"
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">A variação compara cada salário com o anterior e é recalculada sozinha quando você adiciona, edita ou exclui um registro.</p>
          </Card>
        </>
      )}

      {edit && <SalarioModal model={model} finance={finance} item={edit === 'novo' ? null : edit} onClose={() => setEdit(null)} />}
      {importar && <ImportarModal model={model} finance={finance} onClose={() => setImportar(false)} />}
    </div>
  )
}

function Resumo({ label, valor, detalhe, bom }: { label: string; valor: string; detalhe: string; bom: boolean }) {
  return (
    <Card className="!p-4">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className={cx('mt-1.5 text-2xl font-bold tabular-nums', valor !== '—' && (bom ? 'text-good' : 'text-bad'))}>{valor}</div>
      <div className="mt-1 text-xs text-muted">{detalhe}</div>
    </Card>
  )
}

// ---------- gráfico ----------

/**
 * Curva suave que passa por todos os pontos sem "passar do ponto" (monotônica, Fritsch–Carlson):
 * nunca desenha um salário maior ou menor do que os registrados entre dois pontos.
 */
function curvaSuave(p: [number, number][]) {
  if (p.length < 2) return p.length ? `M ${p[0][0]},${p[0][1]}` : ''
  const n = p.length
  const dx = p.slice(1).map((q, i) => q[0] - p[i][0])
  const m = p.slice(1).map((q, i) => (dx[i] ? (q[1] - p[i][1]) / dx[i] : 0))
  const t = p.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const h = a * a + b * b
    if (h > 9) {
      const k = 3 / Math.sqrt(h)
      t[i] = k * a * m[i]
      t[i + 1] = k * b * m[i]
    }
  }
  let d = `M ${p[0][0]},${p[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C ${p[i][0] + h},${p[i][1] + t[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - t[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`
  }
  return d
}

/** Linha suave pelos salários (o último segue até hoje). Faixas de fundo marcam cada empresa. */
function Grafico({ lista }: { lista: Salario[] }) {
  const [foco, setFoco] = useState<number | null>(null)
  const h = hoje()
  const ini = lista[0].data
  const fim = lista[lista.length - 1].data > h ? lista[lista.length - 1].data : h
  const total = Math.max(dias(ini, fim), 1)
  const x = (d: string) => (dias(ini, d) / total) * 100
  const maxV = Math.max(...lista.map((s) => s.valor))
  // escala "redonda" a partir do zero
  const passo = [500, 1000, 2000, 2500, 5000, 10000, 20000].find((p) => maxV / p <= 6) ?? 50000
  const topo = Math.ceil((maxV * 1.08) / passo) * passo
  const y = (v: number) => 100 - (v / topo) * 100
  const ticks = Array.from({ length: topo / passo + 1 }, (_, k) => k * passo)
  const anos: string[] = []
  for (let a = Number(ini.slice(0, 4)) + 1; a <= Number(fim.slice(0, 4)); a++) anos.push(`${a}-01-01`)

  // trechos por empresa (consecutivos)
  const faixas: { empresa: string; de: string; ate: string }[] = []
  lista.forEach((s, k) => {
    const ate = lista[k + 1]?.data ?? fim
    const ult = faixas[faixas.length - 1]
    if (ult && ult.empresa === s.empresa) ult.ate = ate
    else faixas.push({ empresa: s.empresa, de: s.data, ate })
  })

  // curva suave pelos pontos; o último salário segue reto até hoje
  const pts = lista.map((s) => [x(s.data), y(s.valor)] as [number, number])
  if (fim > lista[lista.length - 1].data) pts.push([100, y(lista[lista.length - 1].valor)])
  const linha = curvaSuave(pts)
  const area = `${linha} L ${pts[pts.length - 1][0]},100 L ${pts[0][0]},100 Z`

  const sel = foco !== null ? lista[foco] : null
  return (
    <Card>
      <CardTitle extra={<span className="text-xs text-muted">faixas = empresas · passe o mouse nos pontos</span>}>Evolução salarial</CardTitle>
      <div className="flex gap-2">
        {/* eixo y */}
        <div className="relative w-14 shrink-0 text-right text-[10px] text-muted tabular-nums" style={{ height: 260 }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
              {t >= 1000 ? `${(t / 1000).toLocaleString('pt-BR')} mil` : t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height: 260 }}>
            {/* faixas das empresas */}
            {faixas.map((f, k) => (
              <div
                key={k}
                className={cx('absolute inset-y-0 border-l border-dashed border-line', k % 2 ? 'bg-soft/40' : 'bg-transparent')}
                style={{ left: `${x(f.de)}%`, width: `${x(f.ate) - x(f.de)}%` }}
              >
                <span className="absolute top-1 left-1.5 max-w-full truncate pr-1 text-[10px] font-semibold text-faint">{f.empresa}</span>
              </div>
            ))}
            {/* grade */}
            {ticks.map((t) => (
              <div key={t} className={cx('absolute inset-x-0 h-px', t === 0 ? 'bg-line' : 'bg-line/50')} style={{ top: `${y(t)}%` }} aria-hidden />
            ))}
            {/* linha */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
              <path d={area} fill="var(--color-primary)" opacity={0.07} />
              <path d={linha} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {/* pontos e valores */}
            {lista.map((s, k) => (
              <button
                key={s.id || s.data}
                type="button"
                onMouseEnter={() => setFoco(k)}
                onMouseLeave={() => setFoco(null)}
                onFocus={() => setFoco(k)}
                onBlur={() => setFoco(null)}
                aria-label={`${dataBR(s.data)}: ${brl(s.valor)} · ${s.cargo} · ${s.empresa}`}
                className="group absolute -translate-x-1/2 -translate-y-1/2 p-2"
                style={{ left: `${x(s.data)}%`, top: `${y(s.valor)}%` }}
              >
                <span className={cx('block size-3 rounded-full border-2 border-card bg-primary transition-transform', foco === k && 'scale-150')} />
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap text-ink tabular-nums">
                  {fmt(s.valor).replace(/,00$/, '')}
                </span>
              </button>
            ))}
            {/* detalhe do ponto */}
            {sel && (
              <div
                className="pointer-events-none absolute z-10 w-56 rounded-xl border border-line bg-card p-3 text-xs shadow-lg"
                style={{
                  left: `clamp(0px, calc(${x(sel.data)}% - 7rem), calc(100% - 14rem))`,
                  top: y(sel.valor) > 50 ? `calc(${y(sel.valor)}% - 9.5rem)` : `calc(${y(sel.valor)}% + 1rem)`,
                }}
              >
                <div className="font-semibold text-muted">{dataBR(sel.data)}</div>
                <div className="mt-0.5 text-base font-bold tabular-nums">{brl(sel.valor)}</div>
                <div className="mt-1">{sel.cargo}</div>
                <div className="text-muted">{sel.empresa}</div>
                {foco! > 0 && (
                  <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5">
                    <span className="text-muted">{sel.motivo || 'Variação'}</span>
                    <b className={sel.valor >= lista[foco! - 1].valor ? 'text-good' : 'text-bad'}>{pctTxt(sel.valor / lista[foco! - 1].valor - 1)}</b>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* eixo x: anos */}
          <div className="relative mt-1 h-4 text-[10px] text-muted">
            {anos.map((a) => (
              <span key={a} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${x(a)}%` }}>
                {a.slice(0, 4)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ---------- adicionar / editar ----------

function SalarioModal({ model, finance, item, onClose }: { model: Model; finance: Finance; item: Salario | null; onClose: () => void }) {
  const [f, setF] = useState({
    data: item?.data ?? hoje(),
    valor: item ? fmt(item.valor) : '',
    empresa: item?.empresa ?? model.salarios[model.salarios.length - 1]?.empresa ?? '',
    cargo: item?.cargo ?? model.salarios[model.salarios.length - 1]?.cargo ?? '',
    motivo: item?.motivo ?? '',
  })
  const [err, setErr] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  useEsc(onClose)

  // salário anterior à data escolhida (sem contar o próprio item)
  const anterior = model.salarios.filter((s) => s !== item && s.data < f.data).pop()
  const valor = num(f.valor)
  const v = anterior && valor > 0 ? valor / anterior.valor - 1 : null
  const empresas = [...new Set(model.salarios.map((s) => s.empresa).filter(Boolean))]
  const cargos = [...new Set(model.salarios.map((s) => s.cargo).filter(Boolean))]
  const motivos = [...new Set([...MOTIVOS, ...model.salarios.map((s) => s.motivo).filter(Boolean)])]

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!f.data) return setErr('Escolha a data de início.')
    if (!(valor > 0)) return setErr('Informe o salário.')
    if (model.salarios.some((s) => s !== item && s.data === f.data)) return setErr('Já existe um salário com essa data.')
    const ok = await finance.actions.salvarSalario(item?.row, {
      data_inicio: f.data,
      salario: valor,
      empresa: f.empresa.trim(),
      cargo: f.cargo.trim(),
      motivo: f.motivo.trim(),
    })
    if (ok) onClose()
  }

  async function excluir() {
    if (!item) return
    if (!confirmar) return setConfirmar(true)
    if (await finance.actions.excluirSalario(item.row)) onClose()
  }

  return (
    <Modal titulo={item ? 'Editar salário' : 'Novo salário'} onClose={onClose} onSubmit={salvar}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de início">
            <DatePicker value={f.data} onChange={set('data')} />
          </Field>
          <Field label="Salário">
            <MoneyInput value={f.valor} onChange={set('valor')} autoFocus={!item} />
          </Field>
        </div>
        <Field label="Empresa">
          <input className={inputCls} value={f.empresa} onChange={(e) => set('empresa')(e.target.value)} list="sal-empresas" />
          <datalist id="sal-empresas">
            {empresas.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <Field label="Cargo">
          <input className={inputCls} value={f.cargo} onChange={(e) => set('cargo')(e.target.value)} list="sal-cargos" />
          <datalist id="sal-cargos">
            {cargos.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <Field label="Motivo do aumento">
          <input className={inputCls} value={f.motivo} onChange={(e) => set('motivo')(e.target.value)} list="sal-motivos" placeholder="Aumento, Reajuste anual, Troca de empresa…" />
          <datalist id="sal-motivos">
            {motivos.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>

        {/* variação calculada */}
        <div className="flex items-center justify-between rounded-xl bg-soft px-3 py-2.5 text-sm">
          <span className="text-muted">
            Variação {anterior ? `sobre ${brl(anterior.valor)} (${dataBR(anterior.data)})` : ''}
          </span>
          {v === null ? (
            <span className="text-faint">{anterior ? '—' : 'primeiro registro'}</span>
          ) : (
            <b className={cx('tabular-nums', v >= 0 ? 'text-good' : 'text-bad')}>{pctTxt(v)}</b>
          )}
        </div>

        {err && <p className="text-sm font-semibold text-bad">{err}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {item ? (
            <Button variant={confirmar ? 'danger' : 'ghost'} onClick={() => void excluir()} disabled={finance.busy}>
              {confirmar ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={finance.busy}>
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ---------- colar da planilha ----------

/** Colunas: Data início, Salário, Empresa, Cargo, Motivo (a variação, se vier, é ignorada). */
function lerLinhas(txt: string) {
  return txt
    .split(/\r?\n/)
    .map((l) => l.split('\t'))
    .map((c) => {
      const t = (c[1] ?? '').replace(/[R$\s]/g, '')
      const valor = !t.includes(',') && /\.\d{3}$/.test(t) ? Number(t.replace(/\./g, '')) || 0 : num(t)
      return { data_inicio: normData((c[0] ?? '').trim()), salario: valor, empresa: (c[2] ?? '').trim(), cargo: (c[3] ?? '').trim(), motivo: (c[4] ?? '').trim() }
    })
    .filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.data_inicio) && l.salario > 0)
}

function ImportarModal({ model, finance, onClose }: { model: Model; finance: Finance; onClose: () => void }) {
  const [txt, setTxt] = useState('')
  useEsc(onClose)
  const existentes = new Set(model.salarios.map((s) => s.data))
  const lidas = lerLinhas(txt)
  const novas = lidas.filter((l) => !existentes.has(l.data_inicio))
  const repetidas = lidas.length - novas.length

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (novas.length && (await finance.actions.importarSalarios(novas))) onClose()
  }

  return (
    <Modal titulo="Colar da planilha" onClose={onClose} onSubmit={salvar}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Selecione as linhas na sua planilha (de <b className="text-ink">Data Início</b> até <b className="text-ink">Motivo</b>), copie com Ctrl+C e cole aqui. A variação é calculada sozinha.
        </p>
        <textarea
          autoFocus
          className={cx(inputCls, 'min-h-36 font-mono text-xs')}
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          placeholder={'01/06/2021\tR$ 1.100,00\tEmpresa\tCargo\tMotivo'}
        />
        {lidas.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-xl bg-soft px-3 py-2 text-xs">
            {novas.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 py-0.5">
                <span className="truncate">
                  <span className="text-faint tabular-nums">{dataBR(l.data_inicio)}</span> {l.cargo} <span className="text-muted">· {l.empresa}</span>
                </span>
                <span className="shrink-0 tabular-nums">{fmt(l.salario)}</span>
              </div>
            ))}
            {repetidas > 0 && (
              <div className="pt-1 text-muted">
                {repetidas} {repetidas === 1 ? 'linha já existe (mesma data) e será ignorada' : 'linhas já existem (mesma data) e serão ignoradas'}.
              </div>
            )}
          </div>
        )}
        {txt.trim() && lidas.length === 0 && <p className="text-sm text-bad">Não reconheci nenhuma linha. A 1ª coluna precisa ser a data (dd/mm/aaaa) e a 2ª o salário.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={finance.busy || novas.length === 0}>
            Importar {novas.length || ''} {novas.length === 1 ? 'registro' : 'registros'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- peças ----------

function useEsc(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escFecha(e, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

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
