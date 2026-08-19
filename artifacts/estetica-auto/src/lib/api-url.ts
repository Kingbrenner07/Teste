const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const apiBaseUrl = configuredApiUrl
  ? configuredApiUrl.replace(/\/+$/, "")
  : null;