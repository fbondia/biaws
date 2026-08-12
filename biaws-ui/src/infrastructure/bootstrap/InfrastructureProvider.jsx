import { useEffect, useState } from "react";

import { AuthGate } from "../../components/auth/AuthGate.jsx";
import { AccessibilityProvider } from "../../components/shared/AccessibilityProvider.jsx";
import { LoadingProvider } from "../../components/shared/LoadingProvider.jsx";
import {
  BOOTSTRAP_STATUS,
  createInitialBootstrapState,
  disposeInfrastructureSafely,
  initializeInfrastructure,
} from "./bootstrap.js";
import { DEFAULT_INFRASTRUCTURE_CAPABILITIES } from "./capabilities.js";

function BootstrapStatus({ status }) {
  if (status === BOOTSTRAP_STATUS.FAILED) {
    return (
      <main className="loginPage">
        <section className="loginCard" role="alert">
          <h1>Não foi possível iniciar a aplicação</h1>
          <p>Recarregue a página para tentar novamente.</p>
        </section>
      </main>
    );
  }

  return <div className="authLoading">Validando sessão…</div>;
}

export function InfrastructureProvider({
  capabilities = DEFAULT_INFRASTRUCTURE_CAPABILITIES,
  children,
  onDisposeError,
  onStateChange,
}) {
  const [bootstrapState, setBootstrapState] = useState(() =>
    createInitialBootstrapState(capabilities),
  );

  useEffect(() => {
    let active = true;
    let bootstrap;

    initializeInfrastructure({
      capabilities,
      onStateChange(nextState) {
        if (!active) return;
        setBootstrapState(nextState);
        onStateChange?.(nextState);
      },
    }).then((result) => {
      bootstrap = result;
      if (!active) {
        void disposeInfrastructureSafely(result, onDisposeError);
      }
    });

    return () => {
      active = false;
      void disposeInfrastructureSafely(bootstrap, onDisposeError);
    };
  }, [capabilities, onDisposeError, onStateChange]);

  if (
    ![BOOTSTRAP_STATUS.READY, BOOTSTRAP_STATUS.DEGRADED].includes(
      bootstrapState.status,
    )
  ) {
    return <BootstrapStatus status={bootstrapState.status} />;
  }

  return (
    <AccessibilityProvider>
      <LoadingProvider>
        <AuthGate>{children}</AuthGate>
      </LoadingProvider>
    </AccessibilityProvider>
  );
}
