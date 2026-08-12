export function createRuntimeOptionListsLoader({ apply, load }) {
  let active = true;
  let version = 0;

  return Object.freeze({
    dispose() {
      active = false;
      version += 1;
    },
    async load() {
      const requestVersion = version + 1;
      version = requestVersion;
      const payload = await load();

      if (!active || requestVersion !== version) return false;
      apply(payload.items || []);
      return true;
    },
  });
}
