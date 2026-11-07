
/* =====================================================
   CAMPUS 95 — CENTRAL AUTHENTICATED API CLIENT
   ===================================================== */

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "") + "/";

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const targetUrl = new URL(endpoint, API_URL);

  // Prevent JWT credentials from being sent to other websites.
  if (targetUrl.origin !== new URL(API_URL).origin) {
    throw new Error(
      "External URLs are not supported by apiFetch."
    );
  }

  let token = "";

  try {
    const savedUser = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    if (typeof savedUser.token === "string") {
      token = savedUser.token;
    }
  } catch {
    token = "";
  }

  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Let browser set multipart boundary for FormData.
  if (options.body instanceof FormData) {
    headers.delete("Content-Type");
  } else if (
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await window.fetch(
    targetUrl.toString(),
    {
      ...options,
      headers,
      cache: options.cache ?? "no-store"
    }
  );

  // Expired or invalid login session.
  if (response.status === 401 && token) {
    localStorage.removeItem("user");

    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }

  return response;
};
