import { AJUDA_ECRAS } from './ajudaEcras';

/**
 * Documentação dinâmica da aplicação (pedido do utilizador: "criar
 * documentação dinâmica e chatbot para ajudar") — fonte única de verdade,
 * partilhada por três consumidores: "Os conceitos principais" em
 * ComoFuncionaPage (com ícone, ver ICONE_CONCEITO lá), o chatbot de ajuda
 * (ChatbotWidget, que monta o contexto a partir daqui) e qualquer pesquisa
 * sobre a documentação. Mover prosa daqui para outro sítio arrisca
 * desalinhar o que o chatbot "sabe" do que o "Como Funciona" mostra —
 * mantém tudo neste ficheiro (+ ajudaEcras.ts, para o ecrã-a-ecrã).
 */
export interface ConceitoDoc {
  chave: string;
  titulo: string;
  paragrafos: string[];
}

export const CONCEITOS_DOC: ConceitoDoc[] = [
  {
    chave: 'competencia',
    titulo: 'Competência',
    paragrafos: [
      'Uma capacidade que uma pessoa tem — por exemplo "SAP ABAP" ou "Liderança". Cada colaborador tem um nível nessa competência, de 0 (não tem) a 5 (é uma referência).',
      'Há dois tipos: Técnica (conhecimento de uma ferramenta, tecnologia ou área de trabalho) e Comportamental (uma soft skill, como comunicação ou liderança). O histórico de competências técnicas fica sempre guardado — não podem ser apagadas, só reavaliadas para um nível diferente. As comportamentais podem ser removidas, porque são atribuídas manualmente.',
    ],
  },
  {
    chave: 'certificacao',
    titulo: 'Certificação',
    paragrafos: [
      'Um certificado externo (de um fornecedor como a SAP, por exemplo) que uma pessoa obteve. Regista-se a data em que foi obtida e, se aplicável, até quando é válida.',
      'Se a data de validade passar, a certificação deixa de contar como "válida" — mesmo continuando registada. E se apagares a data de obtenção por engano, a certificação volta a ficar "em falta" (nunca fica uma linha vazia guardada).',
    ],
  },
  {
    chave: 'formacao',
    titulo: 'Formação',
    paragrafos: [
      'Um curso ou ação de formação do catálogo. Cada vez que um colaborador conclui uma, fica registada no seu histórico com a data, as horas e se foi Aprovado, Reprovado ou se Faltou — e a mesma formação pode repetir-se (ex. reprovar e voltar a fazer).',
      'Concluir uma formação com Aprovado pode subir automaticamente o nível de uma competência, se essa formação estiver associada a ela — mas nunca desce um nível já alcançado.',
    ],
  },
  {
    chave: 'lob',
    titulo: 'LOB',
    paragrafos: [
      'Uma LOB é um conjunto de exigências que define um objetivo a atingir — pensa nela como um crachá que se ganha ao reunir um conjunto de competências (a um certo nível) e, por vezes, certificações.',
      'Cada colaborador tem uma "próxima LOB" sugerida automaticamente, e pode ainda ter LOBs recomendadas pelo seu gestor direto (BUD).',
    ],
  },
  {
    chave: 'prontidao',
    titulo: 'Prontidão',
    paragrafos: [
      'Uma percentagem que resume o quanto falta a uma pessoa para atingir uma LOB. 100% significa que está tudo cumprido; abaixo disso, falta pelo menos uma coisa (uma competência, uma certificação, ou pontos suficientes).',
      'É sempre uma combinação de 3 partes — competências obrigatórias, certificações obrigatórias e pontos — cada uma com um peso configurável (por omissão 40%/40%/20%, só um Admin RH pode mudar em Gestão de Dados).',
    ],
  },
  {
    chave: 'cargo-carreira',
    titulo: 'Cargo e Carreira',
    paragrafos: [
      'Um Cargo é uma posição concreta (ex. "Arquiteto Sénior"). Uma Carreira é o caminho — a sequência de Cargos por onde uma pessoa pode ir progredindo.',
      'A app sabe de que Cargo se pode progredir para que outro ("Progressão de Cargos"), e usa isso para sugerir quem já pode avançar ("Candidatos") e para calcular o "Próximo Cargo" de cada colaborador.',
    ],
  },
  {
    chave: 'proximo-cargo',
    titulo: 'Próximo Cargo',
    paragrafos: [
      'O cargo seguinte previsto para um colaborador, sempre visível na sua ficha. É sugerido automaticamente com base na Progressão de Cargos a partir do cargo atual — se houver mais que uma opção possível, prefere a categoria "Principal" (pensado para quem é Sénior).',
      'Um Admin RH pode substituir essa sugestão manualmente (ou por ficheiro Excel, coluna "proximoCargoIdManual") — uma vez alterado à mão, o sistema nunca mais volta a sugerir automaticamente, até o override ser removido.',
    ],
  },
  {
    chave: 'pdi',
    titulo: 'PDI — Plano de Desenvolvimento Individual',
    paragrafos: [
      'A lista de "próximos passos" de cada pessoa. Pode ser gerada automaticamente (com base no que falta para as suas LOBs, ou para o cargo atual/seguinte) ou criada à mão — e também pode ser gerada ou eliminada em massa para muitos colaboradores de uma vez, no ecrã Colaboradores.',
      'Cada item pode ser marcado como Pendente, Em Curso ou Concluído — e concluir um item de Certificação ou Formação pode subir automaticamente o nível de competência associado.',
      'Há também uma tabela "Planos de Desenvolvimento Individual" em Gestão de Dados que lista o PDI de toda a gente, com o nível atual, o nível esperado, a formação sugerida e o nível que essa formação/certificação transmite.',
    ],
  },
  {
    chave: 'projetos',
    titulo: 'Projetos',
    paragrafos: [
      'Uma forma alternativa de subir de nível numa competência, para além de Formações e Certificações: ao participar numa vertente de um projeto, a competência ligada a essa vertente sobe 1 nível (até ao máximo da escala). Cada pessoa só conta a participação num dado projeto uma vez.',
    ],
  },
];

export interface PapelRbacDoc {
  papel: string;
  label: string;
  descricao: string;
}

export const RBAC_DOC: PapelRbacDoc[] = [
  { papel: 'ADMIN_RH', label: 'Admin RH', descricao: 'Vê e edita tudo — todos os colaboradores, Gestão de Dados, administração de utilizadores.' },
  { papel: 'MANAGER', label: 'Gestor', descricao: 'Vê o Dashboard, Candidatos e Skill Matrix da organização, mas só edita a ficha da sua própria equipa direta.' },
  { papel: 'EMPLOYEE', label: 'Colaborador', descricao: 'Só vê a sua própria ficha — sem acesso ao Dashboard, à lista de Colaboradores ou à Skill Matrix.' },
  { papel: 'VIEWER', label: 'Leitura', descricao: 'Vê tudo (Dashboard, Colaboradores, Candidatos, Skill Matrix, todas as fichas) mas não pode editar nada.' },
];

/** Texto único (conceitos + ecrã-a-ecrã + papéis) enviado ao chatbot como contexto — ver ChatbotWidget. */
export function construirContextoDocumentacao(): string {
  const secoes: string[] = [];

  secoes.push(
    '## Conceitos\n' +
      CONCEITOS_DOC.map((c) => `### ${c.titulo}\n${c.paragrafos.join('\n')}`).join('\n\n'),
  );
  secoes.push('## Ecrã a ecrã\n' + AJUDA_ECRAS.map((a) => `### ${a.titulo}\n${a.paragrafos.join('\n')}`).join('\n\n'));
  secoes.push('## Quem vê o quê (papéis)\n' + RBAC_DOC.map((r) => `- ${r.label}: ${r.descricao}`).join('\n'));

  return secoes.join('\n\n');
}
