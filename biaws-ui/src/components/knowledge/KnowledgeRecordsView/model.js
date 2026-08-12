import {
  BookMarked,
  BookOpen,
  Boxes,
  FileText,
  GitBranch,
  ListChecks,
  Scale,
} from "lucide-react";

import {
  createEmptyDocumentDraft,
  documentStatusLabel,
  normalizeDocumentDraft,
} from "../knowledgeModel.js";
import { hasPermission } from "../../../permissions.js";

export const DOCUMENT_TYPES = Object.freeze({
  "business-rule": {
    label: "Regra de negócio",
    plural: "Regras de negócio",
    description: "Formalize regras, condições e exceções do negócio.",
    icon: Scale,
    statuses: [
      ["draft", "Rascunho"],
      ["active", "Ativa"],
      ["retired", "Retirada"],
    ],
    defaultStatus: "draft",
    details: { ruleCode: "", effectiveFrom: "" },
    template:
      "## Regra\n\n## Motivação\n\n## Cenários e exceções\n\n## Critérios de validação\n",
  },
  "architecture-decision": {
    label: "Decisão arquitetural",
    plural: "Decisões arquiteturais",
    description: "Registre uma decisão técnica, seu contexto e consequências.",
    icon: GitBranch,
    statuses: [
      ["proposed", "Proposta"],
      ["accepted", "Aceita"],
      ["rejected", "Rejeitada"],
      ["superseded", "Substituída"],
    ],
    defaultStatus: "proposed",
    details: { decidedAt: "" },
    template:
      "## Contexto\n\n## Decisão\n\n## Alternativas consideradas\n\n## Consequências\n",
  },
  guideline: {
    label: "Guideline",
    plural: "Guidelines",
    description: "Oriente práticas e padrões recomendados para o workspace.",
    icon: BookOpen,
    statuses: [
      ["draft", "Rascunho"],
      ["published", "Publicada"],
      ["deprecated", "Descontinuada"],
    ],
    defaultStatus: "draft",
    details: { scope: "workspace", enforcement: "recommended" },
    template:
      "## Objetivo\n\n## Diretriz\n\n## Motivação\n\n## Exemplos recomendados\n\n## Antipadrões\n\n## Exceções\n\n## Verificação\n",
  },
  feature: {
    label: "Feature",
    plural: "Features",
    description: "Descreva uma capacidade, seus fluxos e visão técnica.",
    icon: Boxes,
    statuses: [
      ["draft", "Rascunho"],
      ["published", "Publicada"],
      ["deprecated", "Descontinuada"],
    ],
    defaultStatus: "draft",
    details: { maturity: "stable" },
    template:
      "## Propósito e atores\n\n## Capacidades e fluxos\n\n## Regras relacionadas\n\n## Visão técnica\n\n## Dados e contratos\n\n## Permissões\n\n## Casos-limite\n\n## Observabilidade e testes\n",
  },
  "technical-reference": {
    label: "Referência técnica",
    plural: "Referências técnicas",
    description: "Documente arquitetura, interfaces e detalhes operacionais.",
    icon: FileText,
    statuses: [
      ["draft", "Rascunho"],
      ["published", "Publicada"],
      ["deprecated", "Descontinuada"],
    ],
    defaultStatus: "draft",
    details: { referenceKind: "architecture" },
    template:
      "## Objetivo\n\n## Desenho atual\n\n## Interfaces e modelo de dados\n\n## Invariantes\n\n## Modos de falha\n\n## Considerações operacionais\n",
  },
  procedure: {
    label: "Procedimento",
    plural: "Procedimentos",
    description: "Registre instruções operacionais reutilizáveis.",
    icon: ListChecks,
    statuses: [
      ["draft", "Rascunho"],
      ["published", "Publicado"],
      ["deprecated", "Descontinuado"],
    ],
    defaultStatus: "draft",
    details: {},
    template:
      "## Objetivo\n\n## Pré-requisitos\n\n## Passos\n\n## Validação\n\n## Rollback\n",
  },
});

export const TYPE_FILTERS = [
  ["", "Todos", BookMarked],
  ...Object.entries(DOCUMENT_TYPES).map(([type, config]) => [
    type,
    config.plural,
    config.icon,
  ]),
];

export const DOCUMENT_TABS = [
  ["overview", "Visão Geral"],
  ["content", "Conteúdo"],
  ["references", "Referências"],
  ["files", "Arquivos"],
  ["observations", "Observações"],
  ["revisions", "Revisões"],
  ["history", "Histórico"],
];

export function emptyDraft(documentType, collectionId = "") {
  return createEmptyDocumentDraft(DOCUMENT_TYPES, documentType, collectionId);
}

export function normalizedDraft(record = {}) {
  return normalizeDocumentDraft(DOCUMENT_TYPES, record);
}

export function statusLabel(document) {
  if (document.status === "archived") return "Arquivado";
  return documentStatusLabel(DOCUMENT_TYPES, document);
}

export function guidelineScope(draft, context) {
  if (!context.applicationId) return "workspace";
  if (context.affectedComponentIds?.length) return "component";
  return draft.details.scope === "workspace"
    ? "application"
    : draft.details.scope;
}

export function taxonomyIds(nodes = []) {
  return nodes.flatMap((node) => [
    node.id,
    ...taxonomyIds(node.children || []),
  ]);
}

export function documentPermissions(actor) {
  return {
    archive: hasPermission(actor, "documents.archive"),
    create: hasPermission(actor, "documents.create"),
    update: hasPermission(actor, "documents.update"),
    attachments: {
      create: hasPermission(actor, "documents.attachment.create"),
      delete: hasPermission(actor, "documents.attachment.delete"),
      read: hasPermission(actor, "documents.attachment.read"),
      update: hasPermission(actor, "documents.attachment.update"),
    },
  };
}
