/**
 * Conteúdo de ajuda por ecrã — partilhado entre o ícone de ajuda contextual
 * (canto de cada página) e o ecrã "Como Funciona" (pedido do utilizador:
 * "cria ajudas nos vários ecrãs... e detalhe o que se faz e como funciona
 * no ecrã que a pessoa está a ver"). Escrito para quem usa a aplicação no
 * dia a dia, não para quem a construiu — sem jargão técnico.
 */
export interface AjudaEcra {
  id: string;
  titulo: string;
  paragrafos: string[];
}

export const AJUDA_ECRAS: AjudaEcra[] = [
  {
    id: 'dashboard',
    titulo: 'Dashboard',
    paragrafos: [
      'A primeira página que vês ao entrar — um resumo rápido do estado da organização (ou só da tua equipa, se fores gestor).',
      'Mostra quantas pessoas já cumpriram os seus objetivos, um gráfico com a evolução ao longo do tempo, e uma lista de colaboradores com a "prontidão" de cada um — uma percentagem que resume o quão perto estão de cumprir o que lhes é exigido.',
      'Em baixo aparecem avisos automáticos (por exemplo, alguém pronto para o próximo passo de carreira há muito tempo, ou uma equipa sem gestor definido) — vale a pena olhar para essa lista de vez em quando.',
      'Podes filtrar por Direção, Área, Núcleo ou Cargo para veres só uma parte da organização, e agrupar os números de formas diferentes.',
    ],
  },
  {
    id: 'colaboradores',
    titulo: 'Colaboradores',
    paragrafos: [
      'A lista de todas as pessoas na organização. Podes pesquisar por nome, filtrar por Direção/Área/Núcleo/Cargo, e clicar em qualquer linha para abrir a ficha completa dessa pessoa.',
      'Os botões "Novo colaborador", "Download" e "Upload" permitem criar uma pessoa de cada vez, ou fazer alterações em massa através de um ficheiro Excel — útil para atualizar muitos colaboradores de uma vez sem ser um a um.',
      'Um colaborador marcado como "Inativo" deixa de contar nos resumos e gráficos (Dashboard, Skill Matrix, Candidatos), mas continua acessível aqui — nada é apagado só por sair da empresa.',
    ],
  },
  {
    id: 'colaborador-perfil',
    titulo: 'Ficha do Colaborador',
    paragrafos: [
      'Tudo sobre uma pessoa, num único sítio: os dados pessoais/organizacionais no topo, e por baixo várias secções — as LOBs que precisa de cumprir, as competências técnicas e comportamentais que já tem, as certificações, o histórico de formações, e o Plano de Desenvolvimento Individual (PDI).',
      'A secção de LOBs mostra o progresso em cada uma; clica numa LOB para veres exatamente o que falta — que competências, que certificações. A partir daí consegues avaliar uma competência (dizer o nível que a pessoa tem) diretamente.',
      'O PDI é a lista de "coisas a trabalhar" — podes gerar sugestões automáticas (com base no que falta para as LOBs, ou para o cargo atual/seguinte) ou adicionar itens à mão. Marcar um item como concluído pode subir automaticamente o nível de uma competência.',
      'Quem pode editar o quê depende do teu papel: um gestor só edita a sua própria equipa, um colaborador só vê a sua própria ficha.',
    ],
  },
  {
    id: 'lobs',
    titulo: 'LOBs',
    paragrafos: [
      'Uma LOB é um conjunto de exigências que define um determinado nível ou especialização — pensa nela como um "crachá" que a pessoa ganha quando cumpre um conjunto de competências e, às vezes, certificações.',
      'Este ecrã lista todas as LOBs existentes. Clica numa para veres exatamente o que exige: que competências (e a que nível), e que certificações são precisas.',
      'Na ficha de cada colaborador consegues ver se essa LOB já foi atingida, e o que falta caso não tenha sido.',
    ],
  },
  {
    id: 'candidatos',
    titulo: 'Candidatos',
    paragrafos: [
      'Ajuda a responder à pergunta "quem está pronto para o próximo passo de carreira?". Escolhe uma Carreira e, se quiseres, um Cargo específico dentro dela.',
      'A lista mostra os colaboradores cujo cargo atual pode progredir para esse cargo, se cumprem os requisitos de antiguidade e de LOBs, e a sua prontidão atual — para perceberes rapidamente quem já pode avançar e quem ainda precisa de desenvolver algo.',
    ],
  },
  {
    id: 'evolucao-carreiras',
    titulo: 'Evolução de Carreiras',
    paragrafos: [
      'Um mapa visual de como os cargos se ligam uns aos outros dentro de uma carreira — de que cargo se pode progredir para que outro cargo.',
      'Útil para perceberes, de forma visual, os caminhos possíveis de progressão antes de ires ver candidatos específicos a cada um.',
    ],
  },
  {
    id: 'skill-matrix',
    titulo: 'Skill Matrix',
    paragrafos: [
      'Uma grelha grande: colaboradores numa direção, LOBs ou competências na outra — para veres tudo de uma vez, em vez de abrir ficha a ficha.',
      'No separador "Por Competência", clicar numa célula abre logo o formulário de avaliação — atualizas o nível dessa pessoa nessa competência sem sair do ecrã.',
      '"Download níveis" e "Upload níveis" permitem exportar a grelha para Excel, editar em massa, e voltar a importar — só grava o que realmente mudou.',
      'Podes agrupar os colaboradores por Direção, Área, Núcleo, e filtrar as colunas mostradas.',
    ],
  },
  {
    id: 'gestao-dados',
    titulo: 'Gestão de Dados',
    paragrafos: [
      'A zona de administração — só para quem tem o papel Admin RH. Aqui vivem todas as "tabelas de referência" da aplicação: Direções, Áreas, Cargos, Competências, Certificações, LOBs, e por aí fora, organizadas em grupos que podes expandir à esquerda.',
      'Cada tabela pode ser editada diretamente (clica numa linha para editar, ou "Nova entrada" para criar), ou em massa através de Download/Upload de um ficheiro Excel.',
      'O grupo "Dados de Colaboradores" é diferente dos outros — em vez de configuração da organização, gere os dados reais de cada pessoa (competências, certificações, formações). Tem uma tabela própria por baixo do Download/Upload para editares linha a linha.',
      'Uma coluna "DELETE" nos ficheiros Excel permite eliminar linhas em massa: escreve a palavra "DELETE" nessa célula e volta a importar o ficheiro.',
    ],
  },
  {
    id: 'atribuicoes',
    titulo: 'Atribuição em Massa',
    paragrafos: [
      'Para quando precisas de dar a mesma competência ou certificação a várias pessoas de uma vez, em vez de abrir ficha a ficha.',
      'Seleciona os colaboradores à esquerda (usa os filtros para os encontrares mais depressa), escolhe a competência e o nível (ou a certificação e a data), e confirma — a alteração é aplicada a todos os selecionados de uma só vez.',
    ],
  },
];

export function ajudaDoEcra(id: string): AjudaEcra | undefined {
  return AJUDA_ECRAS.find((a) => a.id === id);
}
