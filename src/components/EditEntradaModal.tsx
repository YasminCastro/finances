import { escFecha } from '@/lib/utils'
import { Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { fmt } from '../lib/finance'
import { num } from '../lib/model'
import type { Entrada, Model } from '../lib/model'
import type { Finance } from '../lib/store'
import { Button, Field, inputCls } from './kit'
import { MonthPicker } from './pickers'
import { MoneyInput } from './MoneyInput'

export function EditEntradaModal({ entrada: e, onClose, model, finance }: { entrada: Entrada; onClose: () => void; model: Model; finance: Finance }) {
  const [f, setF] = useState({ descricao: e.descricao, valor: fmt(e.valor), mes_ref: e.mes_ref })
  const [err, setErr] = useState<string | null>(null)
  const [apagar, setApagar] = useState(false)
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => escFecha(ev, onClose)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // entrada com o mesmo nome de uma entrada fixa é a confirmação dela no mês
  const nomeFixa = (d: string) => model.entradasFixas.some((x) => x.ativo && x.descricao.toLowerCase() === d.trim().toLowerCase())
  const eraFixa = nomeFixa(e.descricao)
  const saiuDaFixa = eraFixa && !nomeFixa(f.descricao)

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setErr(null)
    const valor = num(f.valor)
    if (!f.descricao.trim()) return setErr('Preencha a descrição.')
    if (!valor) return setErr('Informe um valor.')
    if (await finance.actions.editarEntrada(e, { descricao: f.descricao.trim(), valor, mes_ref: f.mes_ref })) onClose()
  }

  async function excluir() {
    if (await finance.actions.excluirEntrada(e)) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        onMouseDown={(ev) => ev.stopPropagation()}
        className="sheet max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Editar entrada</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-soft" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Descrição">
              <input autoFocus className={inputCls} value={f.descricao} onChange={(ev) => set('descricao')(ev.target.value)} />
            </Field>
            <Field label="Valor (R$)">
              <MoneyInput value={f.valor} onChange={set('valor')} />
            </Field>
          </div>
          <Field label="Mês de referência">
            <MonthPicker value={f.mes_ref} onChange={set('mes_ref')} />
          </Field>
          {eraFixa && (
            <p className="text-xs text-muted">
              {saiuDaFixa
                ? `Com outro nome, esta deixa de confirmar a entrada fixa “${e.descricao}”, que volta a aparecer estimada no mês.`
                : 'Esta é a confirmação de uma entrada fixa neste mês. Mudar o valor aqui vale só para este mês; para os próximos, use a página Fixos.'}
            </p>
          )}
        </div>

        {(err || finance.error) && <div className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err || finance.error}</div>}
        {apagar ? (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-bad/30 bg-bad-soft p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-bad">{eraFixa ? 'Excluir? A entrada fixa volta a aparecer estimada no mês.' : 'Excluir esta entrada?'}</span>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setApagar(false)}>
                Voltar
              </Button>
              <Button variant="danger" disabled={finance.busy} onClick={excluir}>
                {finance.busy ? 'Excluindo…' : 'Excluir'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="sheet-footer mt-6 flex items-center justify-between gap-2">
            <Button variant="ghost" className="text-bad hover:bg-bad-soft hover:text-bad" onClick={() => setApagar(true)}>
              <Trash2 size={16} /> Excluir
            </Button>
            <div className="flex gap-2">
              <Button onClick={onClose}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={finance.busy}>
                {finance.busy ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
