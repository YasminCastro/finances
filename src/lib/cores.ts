/**
 * Paleta categórica (8 cores, validada para daltonismo na ordem abaixo).
 * As categorias recebem cores nesta ordem, seguindo a ordem alfabética, e a cor fica
 * gravada na planilha: uma categoria nova não muda a cor das que já existem.
 */
export const PALETA_CATEGORIAS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']

export const ordemAlfabetica = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })

/** Cor sugerida para a categoria na posição `i` da ordem alfabética. */
export const corDaPosicao = (i: number) => PALETA_CATEGORIAS[((i % PALETA_CATEGORIAS.length) + PALETA_CATEGORIAS.length) % PALETA_CATEGORIAS.length]
