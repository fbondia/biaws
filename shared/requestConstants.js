export const REQUEST_CHECKLIST_ITEMS = [
  "Solicitação",
  "Especificação Técnica",
  "Aprovação",
  "Desenvolvimento",
  "Homologação",
  "MOP",
  "Implantação",
  "Acompanhamento",
];

export const REQUEST_STATUS_COLORS = {
  Sugerido: {
    foreground: "#475467",
    background: "#f2f4f7",
    border: "#d0d5dd",
  },
  Solicitado: {
    foreground: "#174ea6",
    background: "#f0f6ff",
    border: "#b9d3ff",
  },
  "Aguardando Aprovação": {
    foreground: "#8a5700",
    background: "#fff8e8",
    border: "#f2cf8d",
  },
  Desenvolvimento: {
    foreground: "#1f7a45",
    background: "#e7f6ec",
    border: "#b8e7c8",
  },
  Homologação: {
    foreground: "#5d3b9c",
    background: "#f5f0ff",
    border: "#d7c6ff",
  },
  Concluído: {
    foreground: "#344054",
    background: "#eef1f5",
    border: "#d9dee7",
  },
};

export const REQUEST_STATUS_OPTIONS = Object.keys(REQUEST_STATUS_COLORS);

export const DEFAULT_REQUEST_STATUS = "Sugerido";

export const REQUEST_TASK_STATUS_COLORS = {
  Pendente: {
    foreground: "#b42318",
    background: "#fff1f1",
    border: "#f5b6b6",
  },
  Andamento: {
    foreground: "#175cd3",
    background: "#eef4ff",
    border: "#b2ccff",
  },
  "Aguardando Resposta": {
    foreground: "#8a5700",
    background: "#fff8e8",
    border: "#f2cf8d",
  },
  "Aguardando Reunião": {
    foreground: "#8a5700",
    background: "#fff8e8",
    border: "#f2cf8d",
  },
  "Aguardando Decisão": {
    foreground: "#8a5700",
    background: "#fff8e8",
    border: "#f2cf8d",
  },
  "Aguardando Aprovação": {
    foreground: "#8a5700",
    background: "#fff8e8",
    border: "#f2cf8d",
  },
  "Aguardando Disponibilização": {
    foreground: "#8a5700",
    background: "#fff8e8",
    border: "#f2cf8d",
  },
  Concluído: {
    foreground: "#1f7a45",
    background: "#e7f6ec",
    border: "#b8e7c8",
  },
};

export const REQUEST_TASK_STATUS_OPTIONS = Object.keys(REQUEST_TASK_STATUS_COLORS);

export const DEFAULT_REQUEST_TASK_STATUS = "Pendente";

export const REQUEST_SPECIFICATION_SECTION_TITLES = [
  "Objetivo",
  "Escopo de Atuação",
  "Impacto no Sistema",
  "Considerações",
  "Esforço",
  "Plano de Entregas",
];
