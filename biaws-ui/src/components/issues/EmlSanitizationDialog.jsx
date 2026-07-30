import {
  Check,
  FileSearch,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  fetchEmlSanitizationConfiguration,
  importEml,
  saveEmlSanitizationConfiguration,
} from "../../api.js";

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

export function EmlSanitizationDialog({
  applicationId,
  onClose,
  onSaved,
  sampleFile,
  workspaceId,
}) {
  const [config, setConfig] = useState(null);
  const [source, setSource] = useState("");
  const [previewFile, setPreviewFile] = useState(sampleFile || null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchEmlSanitizationConfiguration()
      .then((result) => {
        if (!active) return;
        setConfig(result.config);
        setSource(result.source);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function updateConfig(patch) {
    setConfig((current) => ({ ...current, ...patch }));
    setPreview(null);
  }

  async function calculatePreview() {
    if (!previewFile || !config || !applicationId) return;
    setPreviewing(true);
    setError("");
    try {
      setPreview(
        await importEml(previewFile, {
          dryRun: true,
          workspaceId,
          applicationId,
          sanitizationConfig: config,
        }),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await saveEmlSanitizationConfiguration(config);
      setConfig(result.config);
      setSource(result.source);
      await onSaved?.(result);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving || previewing;

  return (
    <div className="dialogBackdrop sanitizationBackdrop" role="presentation">
      <section
        aria-labelledby="sanitization-title"
        aria-modal="true"
        className="issueDialog sanitizationDialog"
        role="dialog"
      >
        <header className="dialogHeader">
          <div className="dialogTitleBlock">
            <div className="dialogKicker">
              <span className="typeBadge">Configuração por workspace</span>
              {source === "default" ? (
                <span className="sanitizationSource">Padrões do sistema</span>
              ) : null}
            </div>
            <h2 id="sanitization-title">Sanitização de e-mails</h2>
          </div>
          <button
            className="iconButton"
            disabled={busy}
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="dialogBody sanitizationDialogBody">
          {loading ? (
            <p className="loadingLine">
              <LoaderCircle className="spinIcon" size={16} /> Carregando
              configuração…
            </p>
          ) : null}
          {error ? <div className="errorBanner">{error}</div> : null}
          {config ? (
            <>
              <section className="sanitizationSection">
                <div>
                  <h3>Prefixos do assunto</h3>
                  <p>
                    Um prefixo por linha. Eles são removidos repetidamente do
                    início do assunto.
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
                    As expressões regulares ativas são aplicadas na ordem
                    apresentada.
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
                    Expressões que identificam o começo de cada mensagem
                    encaminhada.
                  </p>
                </div>
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
              </section>

              <section className="sanitizationSection">
                <div>
                  <h3>Acabamento</h3>
                  <p>Normalizações aplicadas depois das regras de remoção.</p>
                </div>
                <div className="sanitizationOptions">
                  {[
                    [
                      "collapseBlankLines",
                      "Reduzir linhas em branco consecutivas",
                    ],
                    ["trimLineEndings", "Remover espaços no fim das linhas"],
                    [
                      "replaceCidReferences",
                      "Trocar referências CID pelo nome do anexo",
                    ],
                  ].map(([key, label]) => (
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

              <section className="sanitizationSection sanitizationPreviewSection">
                <div>
                  <h3>Pré-visualização</h3>
                  <p>Teste as alterações sem salvar nem importar o e-mail.</p>
                </div>
                <div className="sanitizationPreviewToolbar">
                  <button
                    className="secondaryButton"
                    onClick={() => previewInputRef.current?.click()}
                    type="button"
                  >
                    <FileSearch size={16} />{" "}
                    {previewFile ? previewFile.name : "Selecionar EML"}
                  </button>
                  <button
                    className="primaryButton"
                    disabled={!previewFile || !applicationId || previewing}
                    onClick={() => void calculatePreview()}
                    type="button"
                  >
                    {previewing ? (
                      <LoaderCircle className="spinIcon" size={16} />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                    Gerar prévia
                  </button>
                  <input
                    accept=".eml,message/rfc822"
                    hidden
                    onChange={(event) => {
                      setPreviewFile(event.target.files?.[0] || null);
                      setPreview(null);
                      event.target.value = "";
                    }}
                    ref={previewInputRef}
                    type="file"
                  />
                </div>
                {!applicationId ? (
                  <span className="fieldHint">
                    Selecione a aplicação na tela anterior para gerar a prévia.
                  </span>
                ) : null}
                {preview ? (
                  <div className="sanitizedEmlPreview">
                    <div>
                      <span>Assunto sanitizado</span>
                      <strong>{preview.issue.title}</strong>
                    </div>
                    <div>
                      <span>Corpo sanitizado</span>
                      <pre>{preview.issue.text || "Sem conteúdo textual."}</pre>
                    </div>
                    <span>
                      {preview.comments.total} mensagem(ns) ·{" "}
                      {preview.attachments.length} anexo(s)
                    </span>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </div>

        <footer className="importDialogFooter">
          <span>
            As alterações serão usadas nas próximas análises e importações deste
            workspace.
          </span>
          <div>
            <button
              className="secondaryButton"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="primaryButton"
              disabled={busy || !config}
              onClick={() => void save()}
              type="button"
            >
              {saving ? (
                <LoaderCircle className="spinIcon" size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              Salvar configuração
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
