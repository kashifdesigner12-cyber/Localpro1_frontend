const API_URL = "https://api.localpro1.net/api";

// ==========================================
// Helper: Get Auth Headers
// ==========================================

const getAuthHeaders = (extraHeaders = {}) => {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extraHeaders,
  };

  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token");

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
};

// ==========================================
// Parse Response
// ==========================================

const parseResponse = async (response) => {
  try {
    return await response.json();
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
// Auth Service
// ==========================================

export const authService = {
  // ========================================
  // LOGIN
  // POST https://api.localpro1.net/api/auth/login
  // ========================================

  async login(email, password) {
    const response = await fetch(
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
      const token =
        data.token || data.data.token;

      localStorage.setItem("token", token);
    }

    return data;
  },

  // ========================================
  // CURRENT AUTHENTICATED USER
  // GET /api/auth/me
  // ========================================

  async me() {
    const response = await fetch(
      `${API_URL}/auth/me`,
      {
        method: "GET",
        headers: getAuthHeaders({
          "Content-Type": undefined,
        }),
        credentials: "include",
        cache: "no-store",
      }
    );

    const data = await parseResponse(response);

    if (response.status === 401) {
      return null;
    }

    if (response.status === 403) {
      throw new Error(
        getErrorMessage(
          data,
          "You do not have permission to access this account."
        )
      );
    }

    if (!response.ok || data?.success === false) {
      throw new Error(
        getErrorMessage(
          data,
          "Unable to load your account."
        )
      );
    }

    return data;
  },

  // ========================================
  // UPDATE PROFILE
  // PUT /api/auth/me
  // OR PUT /api/users/profile
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

    let response = await fetch(
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
      response = await fetch(
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
      throw new Error(
        "Your session has expired. Please login again."
      );
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

    return data;
  },

  // ========================================
  // CHANGE PASSWORD
  // PATCH /api/auth/change-password
  // ========================================

  async changePassword(
    currentPassword,
    newPassword
  ) {
    const response = await fetch(
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
      throw new Error(
        "Your session has expired or the current password is incorrect."
      );
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
  // POST /api/auth/logout
  // ========================================

  async logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("token");
    }

    const response = await fetch(
      `${API_URL}/auth/logout`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
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
  },

  // ========================================
  // TOKEN HELPERS
  // ========================================

  getToken() {
    if (typeof window === "undefined") {
      return null;
    }

    return (
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      null
    );
  },

  clearToken() {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("token");
  },
};