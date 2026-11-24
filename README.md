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

Nenhum dos dois é segredo. Na Vercel, cadastre as duas variáveis em *Settings → Environment Variables*.
Cada endereço novo onde o site rodar (ex.: `https://seu-app.vercel.app`) precisa estar em **Origens JavaScript autorizadas** no Client ID do Google Cloud.

## Estrutura

- `src/lib/google.ts`: login (Google Identity Services) e chamadas à Sheets API
- `src/lib/model.ts`: converte as linhas da planilha em dados tipados
- `src/lib/finance.ts`: cálculos (saldo, faturas, contas a pagar, categorias, parcelas)
- `src/lib/store.ts`: estado do app e ações que gravam na planilha
- `src/components/cards/`: cards do painel
- `src/pages/`: Visão geral e Lançamentos

A planilha tem uma aba **LEIA-ME** que explica cada aba e coluna.
