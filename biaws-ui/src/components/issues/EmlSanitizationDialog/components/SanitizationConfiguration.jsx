import { Plus, Trash2 } from "lucide-react";

const FINISHING_OPTIONS = [
  ["collapseBlankLines", "Reduzir linhas em branco consecutivas"],
  ["trimLineEndings", "Remover espaços no fim das linhas"],
  ["replaceCidReferences", "Trocar referências CID pelo nome do anexo"],
];

export function SanitizationConfiguration({ config, updateConfig }) {
  return (
    <>
      <section className="sanitizationSection">
        <div>
          <h3>Prefixos do assunto</h3>
          <p>
            Um prefixo por linha. Eles são removidos repetidamente do início do
            assunto.
          </p>
        </div>
        <textarea
          onChange={(event) =>
            updateConfig({
              subjectPrefixes: event.target.value.split(/\r?\n/u),
            })
          }
          rows={5}
          value={config.subjectPrefixes.join("\n")}
        />
      </section>

      <section className="sanitizationSection">
        <div>
          <h3>Trechos removidos do corpo</h3>
          <p>
            As expressões regulares ativas são aplicadas na ordem apresentada.
          </p>
        </div>
        <RuleEditor
          onChange={(bodyRules) => updateConfig({ bodyRules })}
          rules={config.bodyRules}
        />
      </section>

      <section className="sanitizationSection">
        <div>
          <h3>Separadores da conversa</h3>
          <p>
            Expressões que identificam o começo de cada mensagem encaminhada.
          </p>
        </div>
        <SeparatorEditor config={config} updateConfig={updateConfig} />
      </section>

      <section className="sanitizationSection">
        <div>
          <h3>Acabamento</h3>
          <p>Normalizações aplicadas depois das regras de remoção.</p>
        </div>
        <div className="sanitizationOptions">
          {FINISHING_OPTIONS.map(([key, label]) => (
            <label key={key}>
              <input
                checked={config.options[key]}
                onChange={(event) =>
                  updateConfig({
                    options: {
                      ...config.options,
                      [key]: event.target.checked,
                    },
                  })
                }
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </div>
      </section>
    </>
  );
}

function RuleEditor({ rules, onChange }) {
  function update(index, patch) {
    onChange(
      rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule,
      ),
    );
  }

  return (
    <div className="sanitizationRules">
      {rules.map((rule, index) => (
        <div className="sanitizationRule" key={rule.id || index}>
          <label className="sanitizationRuleEnabled">
            <input
              checked={rule.enabled !== false}
              onChange={(event) =>
                update(index, { enabled: event.target.checked })
              }
              type="checkbox"
            />
            Ativa
          </label>
          <label>
            <span>Nome</span>
            <input
              onChange={(event) => update(index, { label: event.target.value })}
              value={rule.label}
            />
          </label>
          <label className="sanitizationPatternField">
            <span>Expressão regular</span>
            <textarea
              onChange={(event) =>
                update(index, { pattern: event.target.value })
              }
              rows={2}
              spellCheck={false}
              value={rule.pattern}
            />
          </label>
          <label className="sanitizationFlagsField">
            <span>Flags</span>
            <input
              onChange={(event) => update(index, { flags: event.target.value })}
              spellCheck={false}
              value={rule.flags}
            />
          </label>
          <button
            className="iconButton"
            onClick={() =>
              onChange(rules.filter((_, ruleIndex) => ruleIndex !== index))
            }
            title="Excluir regra"
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        className="secondaryButton sanitizationAddButton"
        onClick={() =>
          onChange([
            ...rules,
            {
              id: crypto.randomUUID(),
              label: "Nova regra",
              pattern: "",
              flags: "giu",
              enabled: true,
            },
          ])
        }
        type="button"
      >
        <Plus size={15} /> Adicionar regra
      </button>
    </div>
  );
}

function SeparatorEditor({ config, updateConfig }) {
  return (
    <div className="sanitizationSeparators">
      {config.threadSeparators.map((pattern, index) => (
        <div key={index}>
          <textarea
            onChange={(event) =>
              updateConfig({
                threadSeparators: config.threadSeparators.map(
                  (item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                ),
              })
            }
            rows={3}
            spellCheck={false}
            value={pattern}
          />
          <button
            className="iconButton"
            onClick={() =>
              updateConfig({
                threadSeparators: config.threadSeparators.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              })
            }
            title="Excluir separador"
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        className="secondaryButton sanitizationAddButton"
        onClick={() =>
          updateConfig({
            threadSeparators: [...config.threadSeparators, ""],
          })
        }
        type="button"
      >
        <Plus size={15} /> Adicionar separador
      </button>
    </div>
  );
}
