import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  File,
  KeyRound,
  Pencil,
  RotateCw,
} from "lucide-react";

import { formatSecretBytes } from "../model.js";

export function SecretCard({
  applicationName,
  canArchive,
  canReveal,
  canUpdate,
  canWrite,
  copied,
  detail = false,
  draggable,
  focused,
  onArchive,
  onCopyValue,
  onDownload,
  onEdit,
  onBack,
  onDragEnd,
  onDragStart,
  onReveal,
  onOpen,
  onToggleValue,
  onVersion,
  revealed,
  secret,
  showValue,
}) {
  const isFile = secret.contentKind === "file";
  const isPending = secret.provisioningStatus === "pending";
  return (
    <article
      className={[
        "securityPanel",
        "secretCard",
        detail ? "secretDetail embeddedCollectionItemDetail" : "",
        focused ? "resourceCollectionFocusedItem" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-collection-browser-item-id={secret.id}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      {detail ? (
        <div className="secretDetailNavigation">
          <button className="secondaryButton" onClick={onBack} type="button">
            <ArrowLeft size={16} /> Voltar para a coleção
          </button>
        </div>
      ) : null}
      <header className="secretCardHeader">
        <span className="secretKindIcon" aria-hidden="true">
          {isFile ? <File size={20} /> : <KeyRound size={20} />}
        </span>
        <div className="secretCardIdentity">
          <strong>{secret.name}</strong>
        </div>
        <div className="secretCardBadges">
          {isPending ? (
            <span className="secretPendingBadge">Aguardando valor</span>
          ) : null}
          <span className="typeBadge">{secret.type}</span>
          <span className="secretFormatBadge">
            {isFile ? "Arquivo" : "Texto"}
          </span>
        </div>
      </header>
      {secret.description ? (
        <p className="secretDescription">{secret.description}</p>
      ) : null}
      <div className="secretIdentifier">
        <span>Identificação técnica</span>
        <code title={secret.identifier}>{secret.identifier}</code>
        <button
          aria-label={`Copiar identificação ${secret.identifier}`}
          className="iconButton"
          onClick={() => navigator.clipboard.writeText(secret.identifier)}
          type="button"
        >
          <Copy size={14} />
        </button>
      </div>
      <dl className="secretMetadataGrid">
        <div>
          <dt>Ambiente</dt>
          <dd>{secret.environment || "Não informado"}</dd>
        </div>
        <div>
          <dt>Escopo</dt>
          <dd>{applicationName || "Workspace inteiro"}</dd>
        </div>
        <div>
          <dt>Versão</dt>
          <dd>{isPending ? "Não provisionado" : secret.currentVersion}</dd>
        </div>
      </dl>
      {isFile && !isPending ? (
        <div className="secretFileMetadata">
          <File size={17} />
          <div>
            <strong>{secret.file?.name || "Arquivo secreto"}</strong>
            <small>
              {formatSecretBytes(secret.file?.size)} ·{" "}
              {secret.file?.mediaType || "application/octet-stream"}
            </small>
          </div>
        </div>
      ) : null}
      {revealed ? (
        <div className="secretNotice secretRevealedValue">
          <code
            aria-label={showValue ? "Valor visível" : "Valor oculto"}
            className={!showValue ? "isMasked" : undefined}
          >
            {showValue ? revealed.value : "••••••••••••"}
          </code>
          <div className="securityActions">
            <button
              className="secondaryButton"
              onClick={onToggleValue}
              type="button"
            >
              {showValue ? <EyeOff size={15} /> : <Eye size={15} />}
              {showValue ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
      ) : null}
      <footer className="secretCardActions">
        <div
          aria-label="Ações do conteúdo"
          className="securityActions secretContentActions"
          role="group"
        >
          {canReveal && isFile ? (
            <button
              className="primaryButton"
              onClick={onDownload}
              type="button"
            >
              <Download size={15} /> Baixar
            </button>
          ) : null}
          {canReveal && !isFile ? (
            <>
              <button
                className="primaryButton"
                onClick={onCopyValue}
                type="button"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                className="secondaryButton"
                onClick={onReveal}
                type="button"
              >
                <Eye size={15} /> Revelar
              </button>
            </>
          ) : null}
        </div>
        <div
          aria-label="Ações de gestão"
          className="securityActions secretManagementActions"
          role="group"
        >
          {canUpdate ? (
            <button className="secondaryButton" onClick={onEdit} type="button">
              <Pencil size={15} /> Editar
            </button>
          ) : null}
          {canWrite ? (
            <button
              className="secondaryButton"
              onClick={onVersion}
              type="button"
            >
              <RotateCw size={15} />
              {isPending
                ? isFile
                  ? "Enviar arquivo"
                  : "Cadastrar valor"
                : "Nova versão"}
            </button>
          ) : null}
          {canArchive ? (
            <button className="dangerButton" onClick={onArchive} type="button">
              <Archive size={15} /> Arquivar
            </button>
          ) : null}
          {onOpen && !detail ? (
            <button className="secondaryButton" onClick={onOpen} type="button">
              Detalhes <ArrowRight size={15} />
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
