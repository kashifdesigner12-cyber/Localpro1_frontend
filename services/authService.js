"use client";

// ==========================================
// API URL
// ==========================================

const ENV_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

const PRODUCTION_API = "https://api.localpro1.net/api";
const LOCAL_API = "http://localhost:5000/api";

const getApiUrl = () => {
  if (typeof window === "undefined") {
    return ENV_API_URL || PRODUCTION_API;
  }

  const hostname = window.location.hostname;

  const isLocalFrontend =
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  // Never use localhost API from deployed frontend.
  if (!isLocalFrontend) {
    if (
      !ENV_API_URL ||
      ENV_API_URL.includes("localhost") ||
      ENV_API_URL.includes("127.0.0.1")
    ) {
      return PRODUCTION_API;
    }

    return ENV_API_URL.replace(/\/+$/, "");
  }

  return (ENV_API_URL || LOCAL_API).replace(/\/+$/, "");
};

// ==========================================
// AUTH USER CACHE / REQUEST DEDUPLICATION
// ==========================================

let cachedUser = null;
let cachedUserAt = 0;
let cachedUserPromise = null;

// Keep the authenticated user briefly in memory
// for better performance across layout/navbar/dashboard mounts.
const USER_CACHE_TTL = 10000;

// ==========================================
// Helper: Clear Current User Cache
// ==========================================

const clearUserCache = () => {
  cachedUser = null;
  cachedUserAt = 0;
  cachedUserPromise = null;
};

// ==========================================
// Helper: Normalize Token
// ==========================================

const normalizeToken = (value) => {
  if (!value) {
    return null;
  }

  let token = String(value).trim();

  if (!token) {
    return null;
  }

  try {
    const parsed = JSON.parse(token);

    if (typeof parsed === "string") {
      token = parsed.trim();
    } else if (parsed?.token) {
      token = String(parsed.token).trim();
    } else if (parsed?.accessToken) {
      token = String(parsed.accessToken).trim();
    }
  } catch {
    // Token is already a normal string.
  }

  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }

  return token || null;
};

// ==========================================
// Helper: Get Stored Token
// ==========================================

const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeToken(
      localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("token")
    );
  } catch {
    return null;
  }
};

// ==========================================
// Helper: Get Auth Headers
// ==========================================

const getAuthHeaders = (
  includeContentType = true,
  extraHeaders = {}
) => {
  const headers = {
    Accept: "application/json",
    ...extraHeaders,
  };

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  const token = getStoredToken();

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

// ==========================================
// Parse Response
// ==========================================

const parseResponse = async (response) => {
  try {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        message: text,
      };
    }
  } catch {
    return null;
  }
};

// ==========================================
// Build Error Message
// ==========================================

const getErrorMessage = (
  data,
  fallback = "Something went wrong."
) => {
  return (
    data?.message ||
    data?.error ||
    data?.errors?.[0]?.message ||
    fallback
  );
};

// ==========================================
// Safe Fetch
// ==========================================

const safeFetch = async (url, options = {}) => {
  try {
    return await fetch(url, {
      ...options,
      cache: options.cache || "no-store",
    });
  } catch (error) {
    const networkError = new Error(
      "Unable to connect to the server. Please check your internet connection or try again."
    );

    networkError.code = "NETWORK_ERROR";
    networkError.originalError = error;

    throw networkError;
  }
};

// ==========================================
// Fetch Current User
// ==========================================

const fetchCurrentUser = async () => {
  const apiUrl = getApiUrl();

  const response = await safeFetch(
    `${apiUrl}/auth/me`,
    {
      method: "GET",
      headers: getAuthHeaders(false),
      credentials: "include",
      cache: "no-store",
    }
  );

  const data = await parseResponse(response);

  // Session/token expired
  if (response.status === 401) {
    clearUserCache();
    return null;
  }

  // User authenticated but not allowed
  if (response.status === 403) {
    const error = new Error(
      getErrorMessage(
        data,
        "You do not have permission to access this account."
      )
    );

    error.code = "AUTH_FORBIDDEN";
    error.status = 403;

    throw error;
  }

  // Other API/server errors
  if (!response.ok || data?.success === false) {
    const error = new Error(
      getErrorMessage(
        data,
        `Unable to load your account. Server returned ${response.status}.`
      )
    );

    error.code = "AUTH_SERVER_ERROR";
    error.status = response.status;
    error.data = data;

    throw error;
  }

  cachedUser = data;
  cachedUserAt = Date.now();

  return data;
};

// ==========================================
// Auth Service
// ==========================================

export const authService = {
  // ========================================
  // LOGIN
  // ========================================

  async login(email, password) {
    clearUserCache();

    const apiUrl = getApiUrl();

    const response = await safeFetch(
      `${apiUrl}/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email?.trim().toLowerCase(),
          password,
        }),
      }
    );

    const data = await parseResponse(response);

    if (!response.ok || data?.success === false) {
      throw new Error(
        getErrorMessage(
          data,
          "Invalid email or password."
        )
      );
    }

    // Store JWT token if backend returns one
    if (
      typeof window !== "undefined" &&
      (data?.token || data?.data?.token)
    ) {
      const token = normalizeToken(
        data.token || data.data.token
      );

      if (token) {
        try {
          localStorage.setItem("token", token);
          localStorage.removeItem("authToken");
          sessionStorage.removeItem("token");
        } catch {
          // Ignore storage errors.
        }
      }
    }

    clearUserCache();

    return data;
  },

  // ========================================
  // CURRENT USER
  // ========================================

  async me() {
    const now = Date.now();

    // Return cached user if still valid
    if (
      cachedUser &&
      now - cachedUserAt < USER_CACHE_TTL
    ) {
      return cachedUser;
    }

    // Prevent duplicate simultaneous requests
    if (cachedUserPromise) {
      return cachedUserPromise;
    }

    cachedUserPromise = fetchCurrentUser();

    try {
      return await cachedUserPromise;
    } finally {
      cachedUserPromise = null;
    }
  },

  // ========================================
  // UPDATE PROFILE
  // ========================================

  async updateProfile(profileData = {}) {
    const payload = {
      ...profileData,

      name:
        profileData.name !== undefined
          ? profileData.name.trim()
          : undefined,

      email:
        profileData.email !== undefined
          ? profileData.email.trim().toLowerCase()
          : undefined,

      phone:
        profileData.phone !== undefined
          ? profileData.phone.trim()
          : undefined,

      avatar:
        profileData.avatar !== undefined
          ? profileData.avatar
          : undefined,

      preferences:
        profileData.preferences !== undefined
          ? profileData.preferences
          : undefined,

      attendanceSchedule:
        profileData.attendanceSchedule !== undefined
          ? profileData.attendanceSchedule
          : undefined,

      workSchedule:
        profileData.workSchedule !== undefined
          ? profileData.workSchedule
          : undefined,

      attendanceSettings:
        profileData.attendanceSettings !== undefined
          ? profileData.attendanceSettings
          : undefined,
    };

    const apiUrl = getApiUrl();

    let response = await safeFetch(
      `${apiUrl}/auth/me`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      }
    );

    let data = await parseResponse(response);

    // Fallback endpoint
    if (response.status === 404) {
      response = await safeFetch(
        `${apiUrl}/users/profile`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      data = await parseResponse(response);
    }

    // Session expired
    if (response.status === 401) {
      clearUserCache();

      const error = new Error(
        "Your session has expired. Please login again."
      );

      error.code = "AUTH_EXPIRED";
      error.status = 401;

      throw error;
    }

    // Forbidden
    if (response.status === 403) {
      throw new Error(
        getErrorMessage(
          data,
          "You do not have permission to update this profile."
        )
      );
    }

    // Other errors
    if (!response.ok || data?.success === false) {
      throw new Error(
        getErrorMessage(
          data,
          "Unable to update profile."
        )
      );
    }

    clearUserCache();

    // Immediately prime cache with updated profile
    if (data) {
      cachedUser = data;
      cachedUserAt = Date.now();
    }

    return data;
  },

  // ========================================
  // CHANGE PASSWORD
  // ========================================

  async changePassword(
    currentPassword,
    newPassword
  ) {
    const apiUrl = getApiUrl();

    const response = await safeFetch(
      `${apiUrl}/auth/change-password`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      }
    );

    const data = await parseResponse(response);

    if (response.status === 401) {
      clearUserCache();

      const error = new Error(
        "Your session has expired or the current password is incorrect."
      );

      error.code = "AUTH_EXPIRED";
      error.status = 401;

      throw error;
    }

    if (!response.ok || data?.success === false) {
      throw new Error(
        getErrorMessage(
          data,
          "Unable to change password."
        )
      );
    }

    return data;
  },

  // ========================================
  // LOGOUT
  // ========================================

  async logout() {
    const token = getStoredToken();
    const apiUrl = getApiUrl();

    clearUserCache();

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        sessionStorage.removeItem("token");
      } catch {
        // Ignore storage errors.
      }
    }

    try {
      const response = await safeFetch(
        `${apiUrl}/auth/logout`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          credentials: "include",
        }
      );

      const data = await parseResponse(response);

      if (
        !response.ok &&
        response.status !== 401
      ) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to logout."
          )
        );
      }

      return (
        data || {
          success: true,
          message: "Logout successful.",
        }
      );
    } catch (error) {
      if (error?.code === "NETWORK_ERROR") {
        return {
          success: true,
          message: "Logged out locally.",
        };
      }

      throw error;
    }
  },

  // ========================================
  // GET TOKEN
  // ========================================

  getToken() {
    return getStoredToken();
  },

  // ========================================
  // CLEAR TOKEN
  // ========================================

  clearToken() {
    clearUserCache();

    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("token");
    } catch {
      // Ignore storage errors.
    }
  },

  // ========================================
  // CLEAR USER CACHE
  // ========================================

  clearUserCache() {
    clearUserCache();
  },
};
