import {
  MonitorFormSection,
  TemplateFields,
} from "../../ActiveMonitorFields.jsx";

export function MonitorInterpretationTab({ draft, onChange, rest, templates }) {
  if (rest) {
    return (
      <MonitorFormSection
        description="Associe uma versão específica para interpretar a evidência."
        title="Interpretação"
      >
        <TemplateFields
          draft={draft}
          onChange={onChange}
          templates={templates}
        />
      </MonitorFormSection>
    );
  }

  return (
    <MonitorFormSection
      description="O estado é definido exclusivamente pelo código de término do script."
      title="Resultado Shell"
    >
      <small className="catalogWideField">
        Código 0 gera healthy. Outros códigos usam o estado de falha escolhido.
        Shell não aceita templates.
      </small>
      {draft.templateId ? (
        <small className="catalogMonitorTemplateEmpty catalogWideField">
          Este monitor legado ainda referencia um template. Ao salvar, a
          referência incompatível será removida.
        </small>
      ) : null}
    </MonitorFormSection>
  );
}
