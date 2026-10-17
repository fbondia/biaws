import { useCallback, useEffect, useRef, useState } from "react";
import { navigate, useRoute } from "./location.js";
import { readRoute, entityReference, entityUrl, matchesReference } from "./model.js";

// Restore from the URL independently of paginated/filtered lists. Loaders must use
// the authorized API; a URL is a selection, never an authorization grant.
export function useEntityState(type, initialValue, options = {}) {
  const route = useRoute();
  const [value, setValue] = useState(initialValue);
  const [loadError, setLoadError] = useState(null);
  const latest = useRef();
  latest.current = { value, options, route, type };
  const previousReference = useRef("");
  const previousScope = useRef("");
  const version = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      version.current += 1;
    };
  }, []);
  const reference = route.selections[type] || "";
  const scopeKey = options.scopeKey || "";
  const enabled = options.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    setLoadError(null);
    const currentVersion = ++version.current;
    const { options: config, value: current } = latest.current;
    const scopeChanged = previousScope.current !== `${type}:${scopeKey}`;
    previousScope.current = `${type}:${scopeKey}`;
    const previous = previousReference.current;
    previousReference.current = reference;
    if (!reference) {
      if (previous) {
        setValue(initialValue);
        config.onRestore?.(initialValue);
      }
      return;
    }
    if (!scopeChanged && matchesReference(config.getEntity?.(current) ?? current, reference)) return;
    setValue(initialValue);
    config.onRestore?.(initialValue);
    Promise.resolve()
      .then(() => config.load(reference))
      .then((loaded) => {
        if (currentVersion !== version.current) return;
        if (loaded === undefined || loaded === null || loaded === "")
          throw new Error("Registro não encontrado ou sem acesso.");
        setValue(config.toValue ? config.toValue(loaded) : loaded);
        latest.current.value = config.toValue ? config.toValue(loaded) : loaded;
        config.onRestore?.(loaded);
      })
      .catch((error) => {
        if (currentVersion === version.current) {
          setLoadError(error);
          config.onError?.(error);
        }
      });
    return () => {
      version.current += 1;
    };
  }, [type, reference, enabled, scopeKey]);

  const select = useCallback((update) => {
    if (!mounted.current) return;
    const current = latest.current;
    const next = typeof update === "function" ? update(current.value) : update;
    const entity = current.options.getEntity?.(next) ?? next;
    const oldEntity = current.options.getEntity?.(current.value) ?? current.value;
    current.value = next;
    setValue(next);
    setLoadError(null);
    if (entityReference(entity) === entityReference(oldEntity)) return;
    const activeRoute = readCurrentRoute();
    if (activeRoute.view !== current.route.view) return;
    if (!current.options.isActive?.(activeRoute) && current.options.isActive) return;
    navigate(
      entityUrl(
        current.options.typeOf?.(next) || current.type,
        entity,
        activeRoute,
        current.options.workspaceId ?? activeRoute.workspaceId,
      ),
    );
  }, []);
  return [value, select, loadError];
}

function readCurrentRoute() {
  return readRoute(window.location);
}
