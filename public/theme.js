// Aplica o tema escuro antes da página desenhar (evita piscar claro). Fica num arquivo
// separado porque a Content-Security-Policy do site não permite scripts inline.
try {
  var t = localStorage.getItem('financas.theme')
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark')
} catch (e) {}
