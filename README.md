# Finanças

Painel de finanças pessoais. É um site estático (React + Vite) que lê e grava direto numa planilha do Google Sheets, com login Google. Não tem servidor nem banco de dados.

## Rodar no computador

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

## Configuração (`.env`)

| Variável | O que é |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Client ID OAuth (Google Cloud → Google Auth Platform → Clientes) |
| `VITE_SPREADSHEET_ID` | ID da planilha "Finanças App - Dados" (o trecho entre `/d/` e `/edit` na URL) |
| `VITE_GOOGLE_API_KEY` | Chave de API usada só pelo seletor de arquivos (Google Cloud → APIs e serviços → Credenciais). Restrinja à **Google Picker API** e aos sites do app |

Nenhum dos dois é segredo. Na Vercel, cadastre as duas variáveis em *Settings → Environment Variables*.
Cada endereço novo onde o site rodar (ex.: `https://seu-app.vercel.app`) precisa estar em **Origens JavaScript autorizadas** no Client ID do Google Cloud.

## Segurança

- `vercel.json` define os cabeçalhos de segurança (Content-Security-Policy, anti-iframe etc.). A CSP só libera o próprio site, o login do Google, a Sheets API e o Google Fonts. Um domínio externo novo (script, imagem, API) precisa entrar nela, senão o navegador bloqueia.
- Scripts inline não são permitidos: o script do tema fica em `public/theme.js`.
- `npm run build && npm run preview` serve o build em `http://localhost:5173` com os mesmos cabeçalhos (pare o `npm run dev` antes), para testar a CSP com login antes do deploy.
- O token de login fica no `sessionStorage`: vale só para a aba e some ao fechá-la.
- O login pede só o escopo `drive.file`: o token alcança apenas os arquivos liberados para o app, não todas as planilhas da conta. No primeiro acesso, o app abre o seletor do Google (Picker) para você escolher a planilha. A liberação fica gravada na conta, então isso acontece uma vez só.

## Estrutura

- `src/lib/google.ts`: login (Google Identity Services) e chamadas à Sheets API
- `src/lib/model.ts`: converte as linhas da planilha em dados tipados
- `src/lib/finance.ts`: cálculos (saldo, faturas, contas a pagar, categorias, parcelas)
- `src/lib/store.ts`: estado do app e ações que gravam na planilha
- `src/components/cards/`: cards do painel
- `src/pages/`: Visão geral e Lançamentos

A planilha tem uma aba **LEIA-ME** que explica cada aba e coluna.
# finances
