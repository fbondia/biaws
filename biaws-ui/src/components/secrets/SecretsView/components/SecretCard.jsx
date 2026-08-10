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
  X,
} from "lucide-react";

import { formatSecretBytes } from "../model.js";

function SecretContentActions({
  canReveal,
  copied,
  isFile,
  onCopyValue,
  onDownload,
  onReveal,
}) {
  if (!canReveal) return null;
  if (isFile) {
    return (
      <button className="primaryButton" onClick={onDownload} type="button">
        <Download size={15} /> Baixar
      </button>
    );
  }
  return (
    <>
      <button className="primaryButton" onClick={onCopyValue} type="button">
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
      <button className="secondaryButton" onClick={onReveal} type="button">
        <Eye size={15} /> Revelar
      </button>
    </>
  );
}

function SecretManagementActions({
  canArchive,
  canUpdate,
  canWrite,
  isFile,
  isPending,
  onArchive,
  onEdit,
  onVersion,
}) {
  return (
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
        <button className="secondaryButton" onClick={onVersion} type="button">
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
    </div>
  );
}

function SecretDetail({
  applicationName,
  canArchive,
  canReveal,
  canUpdate,
  canWrite,
  copied,
  isFile,
  isPending,
  onArchive,
  onCopyValue,
  onDownload,
  onEdit,
  onReveal,
  onToggleValue,
  onVersion,
  revealed,
  secret,
  showValue,
}) {
  return (
    <>
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
          <SecretContentActions
            canReveal={canReveal}
            copied={copied}
            isFile={isFile}
            onCopyValue={onCopyValue}
            onDownload={onDownload}
            onReveal={onReveal}
          />
        </div>
        <SecretManagementActions
          canArchive={canArchive}
          canUpdate={canUpdate}
          canWrite={canWrite}
          isFile={isFile}
          isPending={isPending}
          onArchive={onArchive}
          onEdit={onEdit}
          onVersion={onVersion}
        />
      </footer>
    </>
  );
}

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
      <header className="secretCardHeader">
        <span className="secretKindIcon" aria-hidden="true">
          {isFile ? <File size={20} /> : <KeyRound size={20} />}
        </span>
        <div className="secretCardIdentity">
          <strong>{secret.name}</strong>
          <div className="secretCardBadges">
            {isPending ? (
              <span className="secretPendingBadge">Aguardando valor</span>
            ) : null}
            <span className="typeBadge">{secret.type}</span>
            <span className="secretFormatBadge">
              {isFile ? "Arquivo" : "Texto"}
            </span>
          </div>
        </div>
        <div className="secretCardActions">
          {detail ? (
            <button
              aria-label="Fechar detalhes do secret"
              className="secondaryButton"
              onClick={onBack}
              type="button"
            >
              <X size={16} />
            </button>
          ) : (
            <button className="secondaryButton" onClick={onOpen} type="button">
              Detalhes <Eye size={15} />
            </button>
          )}
        </div>
      </header>
      {secret.description ? (
        <p className="secretDescription">{secret.description}</p>
      ) : null}

      {detail ? (
        <SecretDetail
          applicationName={applicationName}
          canArchive={canArchive}
          canReveal={canReveal}
          canUpdate={canUpdate}
          canWrite={canWrite}
          copied={copied}
          isFile={isFile}
          isPending={isPending}
          onArchive={onArchive}
          onCopyValue={onCopyValue}
          onDownload={onDownload}
          onEdit={onEdit}
          onReveal={onReveal}
          onToggleValue={onToggleValue}
          onVersion={onVersion}
          revealed={revealed}
          secret={secret}
          showValue={showValue}
        />
      ) : null}
    </article>
  );
}
