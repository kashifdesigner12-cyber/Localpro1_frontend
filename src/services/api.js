
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL.replace(/\/+$/, ""),
  withCredentials: true,
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});

// ----------------------------------------------------
// GET AUTH TOKEN
// ----------------------------------------------------

const getAuthToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const tokenKeys = [
    "token",
    "accessToken",
    "access_token",
    "authToken",
    "auth_token",
    "jwt",
  ];

  try {
    for (const key of tokenKeys) {
      const token =
        window.localStorage.getItem(key) ||
        window.sessionStorage.getItem(key);

      if (!token) continue;

      let parsed = token;

      try {
        parsed = JSON.parse(token);
      } catch {
        // Token is stored as a plain string.
      }

      if (typeof parsed === "string" && parsed.trim()) {
        return parsed.trim();
      }

      if (parsed && typeof parsed === "object") {
        const nestedToken =
          parsed.token ||
          parsed.accessToken ||
          parsed.access_token ||
          parsed.jwt;

        if (
          typeof nestedToken === "string" &&
          nestedToken.trim()
        ) {
          return nestedToken.trim();
        }
      }
    }
  } catch (error) {
    console.warn("[API] Unable to read stored auth token:", error.message);
  }

  return null;
};

// ----------------------------------------------------
// REQUEST INTERCEPTOR
// Attach Bearer token when available.
// Cookie authentication remains enabled.
// ----------------------------------------------------

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();

    if (!config.headers) {
      config.headers = {};
    }

    if (token) {
      const existingAuthorization =
        typeof config.headers.get === "function"
          ? config.headers.get("Authorization")
          : config.headers.Authorization ||
            config.headers.authorization;

      if (!existingAuthorization) {
        if (typeof config.headers.set === "function") {
          config.headers.set(
            "Authorization",
            `Bearer ${token}`
          );
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ----------------------------------------------------
// RESPONSE INTERCEPTOR
// ----------------------------------------------------

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      "Something went wrong. Please try again.";

    console.error("[API ERROR]", {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      status: error.response?.status || null,
      message,
    });

    return Promise.reject(error);
  }
);

export default api;
