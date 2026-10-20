import { useEffect, useRef } from "react";

import { useMessages } from "../../../../infrastructure/messages/MessagesProvider.jsx";

export function MarkdownLink({ children, href }) {
  const { confirm } = useMessages();
  const pending = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function openLink(event) {
    if (event.defaultPrevented || (event.button !== 0 && event.button !== 1)) return;
    event.preventDefault();
    if (pending.current) return;
    const destination = event.currentTarget.href;
    pending.current = true;
    try {
      const confirmed = await confirm({
        title: "Abrir link?",
        message: `Abrir links pode levar a sites maliciosos, golpes ou downloads perigosos. Verifique o endereço e continue somente se confiar no destino. O link será aberto em uma nova janela:\n\n${destination}`,
        confirmLabel: "Abrir link",
        cancelLabel: "Cancelar",
      });
      if (confirmed && active.current) window.open(destination, "_blank", "noopener,noreferrer");
    } finally {
      pending.current = false;
    }
  }

  return (
    <a href={href} onAuxClick={openLink} onClick={openLink} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}
