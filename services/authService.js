const API_URL = "https://api.localpro1.net/api";

// ==========================================
// AUTH USER CACHE / REQUEST DEDUPLICATION
// ==========================================

let cachedUser = null;
let cachedUserAt = 0;
let cachedUserPromise = null;

// Keep the authenticated user briefly in memory (increased slightly to 10s for better performance across layout/navbar/dashboard mounts).
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

  return normalizeToken(
    localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token")
  );
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
  const response = await safeFetch(
    `${API_URL}/auth/me`,
    {
      method: "GET",
      headers: getAuthHeaders(false),
      credentials: "include",
      cache: "no-store",
    }
  );

  const data = await parseResponse(response);

  if (response.status === 401) {
    clearUserCache();
    return null;
  }

  if (response.status === 403) {
    const error = new Error(
      getErrorMessage(
        data,
        "You do not have permission to access this account."
      )
    );

    error.code = "AUTH_FORBIDDEN";

    throw error;
  }

  if (!response.ok || data?.success === false) {
    const error = new Error(
      getErrorMessage(
        data,
        "Unable to load your account."
      )
    );

    error.code = "AUTH_SERVER_ERROR";
    error.status = response.status;

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
  async login(email, password) {
    clearUserCache();

    const response = await safeFetch(
      `${API_URL}/auth/login`,
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

    if (
      typeof window !== "undefined" &&
      (data?.token || data?.data?.token)
    ) {
      const token = normalizeToken(
        data.token || data.data.token
      );

      if (token) {
        localStorage.setItem("token", token);
        localStorage.removeItem("authToken");
        sessionStorage.removeItem("token");
      }
    }

    clearUserCache();

    return data;
  },

  async me() {
    const now = Date.now();

    if (
      cachedUser &&
      now - cachedUserAt < USER_CACHE_TTL
    ) {
      return cachedUser;
    }

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

    let response = await safeFetch(
      `${API_URL}/auth/me`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      }
    );

    let data = await parseResponse(response);

    if (response.status === 404) {
      response = await safeFetch(
        `${API_URL}/users/profile`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      data = await parseResponse(response);
    }

    if (response.status === 401) {
      clearUserCache();

      const error = new Error(
        "Your session has expired. Please login again."
      );

      error.code = "AUTH_EXPIRED";

      throw error;
    }

    if (response.status === 403) {
      throw new Error(
        getErrorMessage(
          data,
          "You do not have permission to update this profile."
        )
      );
    }

    if (!response.ok || data?.success === false) {
      throw new Error(
        getErrorMessage(
          data,
          "Unable to update profile."
        )
      );
    }

    clearUserCache();

    return data;
  },

  async changePassword(
    currentPassword,
    newPassword
  ) {
    const response = await safeFetch(
      `${API_URL}/auth/change-password`,
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

  async logout() {
    const token = getStoredToken();

    clearUserCache();

    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("token");
    }

    try {
      const response = await safeFetch(
        `${API_URL}/auth/logout`,
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

  getToken() {
    return getStoredToken();
  },

  clearToken() {
    clearUserCache();

    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("token");
  },

  clearUserCache() {
    clearUserCache();
  },
};