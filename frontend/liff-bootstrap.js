const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

const STRICT_DB_LIFF = true;

const fallbackLiffMap = {
  // Development fallback map only.
  // Keep empty in production when LIFF ID is managed in database.
  // "shop-a": "1650000000-xxxxxxx",
  // "shop-b": "1650000000-yyyyyyy",
};

function setStatus(text) {
  statusEl.textContent = text;
}

function showResult(data) {
  resultEl.textContent = JSON.stringify(data, null, 2);
}

function getApiBase() {
  const params = new URLSearchParams(window.location.search);

  // Priority 1: query string for quick verification
  const queryApiBase = params.get("api_base");
  if (queryApiBase) {
    return queryApiBase.replace(/\/$/, "");
  }

  // Priority 2: global config injected by hosting page
  if (window.APP_CONFIG?.apiBase) {
    return window.APP_CONFIG.apiBase.replace(/\/$/, "");
  }

  // Priority 3: localStorage for static hosting environments
  const localApiBase = window.localStorage.getItem("api_base");
  if (localApiBase) {
    return localApiBase.replace(/\/$/, "");
  }

  // Fallback: same-origin (works when frontend and backend are same host)
  return window.location.origin;
}

function getShopCodeFromUrl() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  // Convention: /s/{shopCode} or /{repo}/s/{shopCode} (GitHub Pages)
  const sIndex = pathParts.findIndex((part) => part === "s");
  if (sIndex !== -1 && pathParts.length > sIndex + 1) {
    return pathParts[sIndex + 1];
  }

  // Alternative: ?shop_code=xxx
  const params = new URLSearchParams(window.location.search);
  return params.get("shop_code");
}

async function resolveLiffConfig() {
  const params = new URLSearchParams(window.location.search);
  const apiBase = getApiBase();

  // Highest priority: explicit query override (development or emergency use)
  const queryLiffId = params.get("liff_id");
  if (queryLiffId && !STRICT_DB_LIFF) {
    return { liffId: queryLiffId, source: "query", shopId: params.get("shop_id") || null };
  }

  const shopCode = getShopCodeFromUrl();

  // Primary path: ask backend to resolve from host/path/shopCode
  const resolveUrl = new URL("/api/public/liff/resolve", apiBase);
  resolveUrl.searchParams.set("host", window.location.host);
  resolveUrl.searchParams.set("path", window.location.pathname);
  if (shopCode) {
    resolveUrl.searchParams.set("shop_code", shopCode);
  }

  const response = await fetch(resolveUrl.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (response.ok) {
    const data = await response.json();
    if (data?.liffId) {
      return {
        liffId: data.liffId,
        source: "backend",
        shopId: data.shopId || null,
        apiBase,
      };
    }
  }

  if (STRICT_DB_LIFF) {
    throw new Error("LIFF ID not found from backend resolver. Please verify DB mapping in petsalon.shop.sh_liff_id.");
  }

  // Final fallback: local map by shopCode
  if (shopCode && fallbackLiffMap[shopCode]) {
    return {
      liffId: fallbackLiffMap[shopCode],
      source: "fallback_map",
      shopId: shopCode,
      apiBase,
    };
  }

  throw new Error("Unable to resolve LIFF ID. Please configure backend /api/public/liff/resolve.");
}

async function bootstrap() {
  setStatus("Resolving LIFF ID...");
  const resolved = await resolveLiffConfig();
  const apiBase = resolved.apiBase || getApiBase();

  setStatus(`Initializing LIFF (${resolved.source})...`);
  await liff.init({ liffId: resolved.liffId });

  if (!liff.isLoggedIn()) {
    setStatus("Redirecting to LINE Login...");
    liff.login({ redirectUri: window.location.href });
    return;
  }

  setStatus("Fetching LINE profile...");
  const profile = await liff.getProfile();

  // Send user identity to backend for upsert to petsalon."user"
  const bindResponse = await fetch(new URL("/api/public/line/bind-user", apiBase), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shopId: resolved.shopId,
      liffId: resolved.liffId,
      lineUserId: profile.userId,
      lineDisplayName: profile.displayName,
      pictureUrl: profile.pictureUrl || null,
    }),
  });

  const bindData = bindResponse.ok ? await bindResponse.json() : { ok: false };

  setStatus("Ready");
  showResult({
    resolved,
    profile,
    bindData,
    runtime: {
      origin: window.location.origin,
      apiBase,
    },
  });
}

bootstrap().catch((error) => {
  console.error(error);
  setStatus("Failed");
  showResult({
    error: error.message,
    hint: "Check LIFF ID config and backend resolver endpoint.",
  });
});
