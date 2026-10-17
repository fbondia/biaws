import { FileText, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { fetchDocuments } from "../../../../api/knowledge.js";

const SEARCH_DELAY_MS = 250;
const PAGE_SIZE = 20;

export function DocumentLinkDialog({ workspaceId, onClose, onSelect }) {
  const titleId = useId();
  const searchRef = useRef(null);
  const selectedRef = useRef(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [documents, setDocuments] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const selected = documents.find(({ id }) => id === selectedId);

  useEffect(() => {
    const previousFocus = document.activeElement;
    searchRef.current?.focus();
    return () => {
      if (!selectedRef.current && previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(
      async () => {
        try {
          const payload = await fetchDocuments({ search: search.trim(), page, limit: PAGE_SIZE });
          if (!active) return;
          setDocuments(payload.items || []);
          setTotalPages(payload.meta?.totalPages || 1);
        } catch (error) {
          if (active) {
            setDocuments([]);
            setError(error.message);
          }
        } finally {
          if (active) setLoading(false);
        }
      },
      search ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [workspaceId, search, page, retry]);

  function changePage(nextPage) {
    setSelectedId("");
    setLoading(true);
    setDocuments([]);
    setPage(nextPage);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "Tab") {
      event.stopPropagation();
      const items = [...event.currentTarget.querySelectorAll("button:not([disabled]), input:not([disabled])")];
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return createPortal(
    <div
      className="dialogBackdrop markdownDocumentLinkBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="markdownDocumentLinkDialog"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <header>
          <div>
            <h2 id={titleId}>Inserir link de documento</h2>
            <p>Busque documentos acessíveis no workspace atual.</p>
          </div>
          <button
            aria-label="Fechar seleção de documento"
            className="iconButton"
            data-dialog-close
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="markdownDocumentLinkBody">
          <label className="field">
            <span>
              <Search aria-hidden="true" size={15} /> Buscar documentos
            </span>
            <input
              autoComplete="off"
              data-dialog-initial-focus
              maxLength={240}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setSelectedId("");
                setDocuments([]);
                setLoading(true);
              }}
              placeholder="Título, identificador ou conteúdo"
              ref={searchRef}
              type="search"
              value={search}
            />
          </label>
          {error ? (
            <div className="errorBox" role="alert">
              {error}
              <button className="secondaryButton" onClick={() => setRetry((value) => value + 1)} type="button">
                Tentar novamente
              </button>
            </div>
          ) : null}
          <div aria-busy={loading} className="markdownDocumentLinkResults">
            {loading ? <p role="status">Buscando documentos…</p> : null}
            {!loading && !error && !documents.length ? <p role="status">Nenhum documento encontrado.</p> : null}
            {!loading && !error
              ? documents.map((item) => (
                  <label className="markdownDocumentLinkOption" key={item.id}>
                    <input
                      checked={selectedId === item.id}
                      name={titleId}
                      onChange={() => setSelectedId(item.id)}
                      type="radio"
                      value={item.id}
                    />
                    <FileText aria-hidden="true" size={18} />
                    <span>
                      <strong>{item.title || "Sem título"}</strong>
                      <small>{item.identifier || item.id}</small>
                      {item.summary ? <small>{item.summary}</small> : null}
                    </span>
                  </label>
                ))
              : null}
          </div>
          <nav aria-label="Páginas de documentos" className="markdownDocumentLinkPagination">
            <button
              className="secondaryButton"
              disabled={loading || page <= 1}
              onClick={() => changePage(page - 1)}
              type="button"
            >
              Anterior
            </button>
            <span aria-live="polite">
              Página {page} de {totalPages}
            </span>
            <button
              className="secondaryButton"
              disabled={loading || page >= totalPages}
              onClick={() => changePage(page + 1)}
              type="button"
            >
              Próxima
            </button>
          </nav>
        </div>
        <footer>
          <button className="secondaryButton" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="primaryButton"
            disabled={loading || Boolean(error) || !selected}
            onClick={() => {
              try {
                selectedRef.current = true;
                onSelect(selected);
              } catch (error) {
                selectedRef.current = false;
                setError(error.message);
              }
            }}
            type="button"
          >
            Inserir link
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
