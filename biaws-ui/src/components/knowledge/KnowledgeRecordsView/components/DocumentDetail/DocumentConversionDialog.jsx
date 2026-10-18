import { ArrowRightLeft, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { fetchDocuments } from "../../../../../api.js";
import { DOCUMENT_TYPE_CATALOG } from "../../../../../../../shared/documentTypes.js";
import { DOCUMENT_TYPES } from "../../model.js";
import { fetchAllDocumentPages } from "../../models/documentModel.js";

export function DocumentConversionDialog({ draft, catalog, onClose, onConvert }) {
  const titleId = useId();
  const selectRef = useRef(null);
  const [targetType, setTargetType] = useState("");
  const [additionalData, setAdditionalData] = useState("append");
  const [mode, setMode] = useState("convert");
  const [applicationId, setApplicationId] = useState(draft.applicationId || "");
  const [targetCatalogId, setTargetCatalogId] = useState("");
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const intoCatalog = targetType === "catalog" && mode === "catalog-item";
  const applicationRequired = DOCUMENT_TYPE_CATALOG[targetType]?.applicationRequired;

  useEffect(() => {
    const previous = document.activeElement;
    selectRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (!intoCatalog) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    setTargetCatalogId("");
    fetchAllDocumentPages(fetchDocuments, { documentType: "catalog" })
      .then((result) => {
        if (active)
          setCatalogs((result.items || []).filter(({ id, status }) => id !== draft.id && status !== "archived"));
      })
      .catch((error) => {
        if (active) {
          setCatalogs([]);
          setLoadError(error.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [draft.id, intoCatalog, retry]);

  function handleKeys(event) {
    event.stopPropagation();
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const controls = [
      ...event.currentTarget.querySelectorAll("button:not([disabled]), select:not([disabled]), input:not([disabled])"),
    ];
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConvert({
        targetType,
        additionalData,
        mode: intoCatalog ? "catalog-item" : "convert",
        ...(intoCatalog
          ? { targetCatalogId }
          : {
              applicationId,
              affectedComponentIds: applicationId === draft.applicationId ? draft.affectedComponentIds : [],
            }),
      });
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="dialogBackdrop knowledgeConversionBackdrop"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="knowledgeConversionDialog"
        onKeyDown={handleKeys}
        role="dialog"
      >
        <header>
          <h2 id={titleId}>
            <ArrowRightLeft size={20} /> Trocar tipo de documento
          </h2>
          <button aria-label="Fechar conversão" className="iconButton" disabled={busy} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <form className="dialogForm" onSubmit={submit}>
          <p>
            Tipo atual: <strong>{DOCUMENT_TYPES[draft.documentType].label}</strong>. As alterações pendentes serão
            salvas antes da operação.
          </p>
          <label className="field">
            <span>Tipo de destino</span>
            <select
              aria-label="Tipo de destino"
              ref={selectRef}
              disabled={busy}
              required
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value);
                setError("");
                setMode(event.target.value === draft.documentType ? "catalog-item" : "convert");
              }}
            >
              <option value="">Selecione o tipo</option>
              {Object.entries(DOCUMENT_TYPES)
                .filter(([type]) => type !== draft.documentType || type === "catalog")
                .map(([type, config]) => (
                  <option key={type} value={type}>
                    {config.label}
                  </option>
                ))}
            </select>
          </label>
          {targetType === "catalog" ? (
            <fieldset disabled={busy}>
              <legend>Como deseja usar o catálogo?</legend>
              <label>
                <input
                  type="radio"
                  name="catalogConversionMode"
                  checked={mode === "convert"}
                  disabled={draft.documentType === "catalog"}
                  onChange={() => setMode("convert")}
                />{" "}
                Converter este documento em um catálogo
              </label>
              <label>
                <input
                  type="radio"
                  name="catalogConversionMode"
                  checked={mode === "catalog-item"}
                  onChange={() => setMode("catalog-item")}
                />{" "}
                Incorporar como item de um catálogo existente
              </label>
            </fieldset>
          ) : null}
          <fieldset disabled={busy}>
            <legend>O que fazer com os dados adicionais do tipo atual?</legend>
            <label>
              <input
                type="radio"
                name="conversionAdditionalData"
                checked={additionalData === "append"}
                onChange={() => setAdditionalData("append")}
              />{" "}
              Incorporar no rodapé do Markdown
            </label>
            <label>
              <input
                type="radio"
                name="conversionAdditionalData"
                checked={additionalData === "discard"}
                onChange={() => setAdditionalData("discard")}
              />{" "}
              Descartar os dados adicionais
            </label>
            {draft.documentType === "catalog" ? (
              <small>Essa escolha também se aplica aos elementos e à árvore do catálogo atual.</small>
            ) : null}
          </fieldset>
          {intoCatalog ? (
            <>
              <label className="field">
                <span>Catálogo de destino</span>
                <select
                  aria-label="Catálogo de destino"
                  required
                  disabled={busy || loading || Boolean(loadError)}
                  value={targetCatalogId}
                  onChange={(event) => setTargetCatalogId(event.target.value)}
                >
                  <option value="">{loading ? "Carregando catálogos..." : "Selecione um catálogo"}</option>
                  {catalogs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              {!loading && !loadError && !catalogs.length ? (
                <p>Nenhum outro catálogo disponível neste workspace.</p>
              ) : null}
              {loadError ? (
                <div role="alert">
                  {loadError}{" "}
                  <button className="secondaryButton" onClick={() => setRetry((value) => value + 1)} type="button">
                    Tentar novamente
                  </button>
                </div>
              ) : null}
              <p>
                O título e o conteúdo serão incluídos como um novo elemento. O documento original, seus anexos e seu
                histórico serão mantidos; o item terá um link para o original.
              </p>
            </>
          ) : applicationRequired ? (
            <label className="field">
              <span>Aplicação do documento</span>
              <select
                aria-label="Aplicação do documento"
                required
                disabled={busy}
                value={applicationId}
                onChange={(event) => setApplicationId(event.target.value)}
              >
                <option value="">Selecione uma aplicação</option>
                {catalog.applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {!intoCatalog ? (
            <p>
              O conteúdo Markdown, o identificador, os anexos e o histórico serão preservados. Os campos do novo tipo
              começarão com os valores padrão.
            </p>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
          <footer>
            <button className="secondaryButton" disabled={busy} onClick={onClose} type="button">
              Cancelar
            </button>
            <button
              className="primaryButton"
              disabled={
                busy ||
                !targetType ||
                (intoCatalog
                  ? !targetCatalogId || loading || Boolean(loadError)
                  : applicationRequired && !applicationId)
              }
              type="submit"
            >
              {busy ? "Processando..." : intoCatalog ? "Incorporar ao catálogo" : "Converter documento"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
