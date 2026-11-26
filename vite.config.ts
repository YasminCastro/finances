import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// No Windows, o terminal do VS Code abre a pasta como "c:\..." (drive minúsculo). Com isso o pré-empacotamento
// do Vite 8 (Rolldown) resolve o React por dois caminhos ("c:" e "C:") e gera duas cópias dele, quebrando os
// hooks ("Invalid hook call" e página em branco). Normaliza a letra do drive para maiúscula.
const raiz = (p: string) => p.replace(/^[a-z]:/, (d) => d.toUpperCase())
if (raiz(process.cwd()) !== process.cwd()) process.chdir(raiz(process.cwd()))
const dir = raiz(import.meta.dirname)

// `npm run preview` usa os mesmos cabeçalhos de segurança da Vercel (vercel.json), para testar a CSP localmente.
// Sem HTTPS no localhost, tira o upgrade-insecure-requests e o HSTS.
const vercel = JSON.parse(readFileSync(path.resolve(dir, 'vercel.json'), 'utf-8')) as {
  headers: { headers: { key: string; value: string }[] }[]
}
const previewHeaders = Object.fromEntries(
  vercel.headers[0].headers
    .filter((h) => h.key !== 'Strict-Transport-Security')
    .map((h) => [h.key, h.value.replace(/;\s*upgrade-insecure-requests/, '')]),
)

// https://vite.dev/config/
export default defineConfig({
  root: dir,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(dir, './src') } },
  server: { port: 5173, strictPort: true },
  // mesma porta do dev: é a origem já autorizada no Client ID do Google
  preview: { port: 5173, strictPort: true, headers: previewHeaders },
})
