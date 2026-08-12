import { useEffect } from "react";

import { dialogKeyboardAction } from "./accessibilityModel.js";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function visibleElements(container, selector) {
  return [...container.querySelectorAll(selector)].filter(
    (element) => element.getClientRects().length > 0,
  );
}

function activeModal() {
  const dialogs = visibleElements(
    document,
    '[role="dialog"][aria-modal="true"]',
  );
  return dialogs.at(-1) || null;
}

function syncTabStops() {
  for (const tabList of document.querySelectorAll('[role="tablist"]')) {
    const tabs = [...tabList.querySelectorAll('[role="tab"]:not([disabled])')];
    if (!tabs.length) continue;

    const selectedTab =
      tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ||
      tabs[0];
    for (const tab of tabs) tab.tabIndex = tab === selectedTab ? 0 : -1;
  }
}

function moveTabFocus(event) {
  const currentTab = event.target.closest?.('[role="tab"]');
  const tabList = currentTab?.closest?.('[role="tablist"]');
  if (!currentTab || !tabList) return false;

  const tabs = visibleElements(tabList, '[role="tab"]:not([disabled])');
  const currentIndex = tabs.indexOf(currentTab);
  if (currentIndex < 0) return false;

  let nextIndex = currentIndex;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  } else {
    return false;
  }

  event.preventDefault();
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
  return true;
}

function keepFocusInsideDialog(event, dialog) {
  if (event.key !== "Tab") return;

  const focusable = visibleElements(dialog, FOCUSABLE_SELECTOR);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function AccessibilityProvider({ children }) {
  useEffect(() => {
    let currentDialog = null;
    let focusBeforeDialog = null;
    let originalBodyOverflow = "";
    let focusFrame = 0;

    function syncAccessibility() {
      syncTabStops();
      const nextDialog = activeModal();
      if (nextDialog === currentDialog) return;

      if (!currentDialog && nextDialog) {
        focusBeforeDialog = document.activeElement;
        originalBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }

      currentDialog = nextDialog;
      window.cancelAnimationFrame(focusFrame);

      if (currentDialog) {
        if (!currentDialog.hasAttribute("tabindex"))
          currentDialog.setAttribute("tabindex", "-1");
        focusFrame = window.requestAnimationFrame(() => {
          const focusTarget =
            currentDialog.querySelector("[data-dialog-initial-focus]") ||
            currentDialog.querySelector("[autofocus]") ||
            visibleElements(currentDialog, FOCUSABLE_SELECTOR)[0] ||
            currentDialog;
          focusTarget.focus({ preventScroll: true });
        });
      } else {
        document.body.style.overflow = originalBodyOverflow;
        if (focusBeforeDialog?.isConnected)
          focusBeforeDialog.focus({ preventScroll: true });
        focusBeforeDialog = null;
      }
    }

    function handleKeyDown(event) {
      if (moveTabFocus(event)) return;

      const dialog = activeModal();
      if (!dialog) return;

      if (dialogKeyboardAction(event.key) === "cancel") {
        const closeButton = dialog.querySelector(
          '[data-dialog-close], button[aria-label^="Fechar"], button[title="Fechar"]',
        );
        if (closeButton && !closeButton.disabled) {
          event.preventDefault();
          closeButton.click();
        }
        return;
      }

      keepFocusInsideDialog(event, dialog);
    }

    const observer = new MutationObserver(syncAccessibility);
    observer.observe(document.body, {
      attributeFilter: ["aria-selected"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    document.addEventListener("keydown", handleKeyDown);
    syncAccessibility();

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  return children;
}
