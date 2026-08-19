const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const requiresExternalApiUrl =
  import.meta.env.VITE_REQUIRE_EXTERNAL_API_URL === "true";

if (requiresExternalApiUrl && !configuredApiUrl) {
  throw new Error(
    "VITE_API_URL must be configured when building the GitHub Pages site.",
  );
}

export const apiBaseUrl = configuredApiUrl
  ? configuredApiUrl.replace(/\/+$/, "")
  : null;