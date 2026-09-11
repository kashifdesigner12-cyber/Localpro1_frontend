import { authService } from "./authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

// ==========================================
// Parse Backend Response
// ==========================================

const parseResponse = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

// ==========================================
// Get Request Headers with Authorization Support
// ==========================================

const getAuthHeaders = () => {
  let token = null;

  try {
    if (typeof authService.getToken === "function") {
      token = authService.getToken();
    }
  } catch (error) {
    console.error("Unable to retrieve auth token:", error);
  }

  return {
    Accept: "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
};

// ==========================================
// Handle API Errors
// ==========================================

const handleResponse = async (response) => {
  const data = await parseResponse(response);

  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (response.status === 403) {
    throw new Error("FORBIDDEN");
  }

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Dashboard request failed."
    );
  }

  return data;
};

// ==========================================
// Dashboard Service
// ==========================================

export const dashboardService = {
  // ========================================
  // GET /api/dashboard/stats
  // Admin / Manager
  // ========================================

  async getStats() {
    const response = await fetch(
      `${API_URL}/dashboard/stats`,
      {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
        cache: "no-store",
      }
    );

    return handleResponse(response);
  },

  // ========================================
  // GET /api/dashboard/summary
  // Authenticated User
  // ========================================

  async getSummary() {
    const response = await fetch(
      `${API_URL}/dashboard/summary`,
      {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
        cache: "no-store",
      }
    );

    return handleResponse(response);
  },

  // ========================================
  // GET /api/dashboard/activity
  // Admin / Manager
  // ========================================

  async getActivity() {
    const response = await fetch(
      `${API_URL}/dashboard/activity`,
      {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
        cache: "no-store",
      }
    );

    return handleResponse(response);
  },

  // ========================================
  // GET /api/dashboard/chart-data
  // Admin / Manager
  // ========================================

  async getChartData() {
    const response = await fetch(
      `${API_URL}/dashboard/chart-data`,
      {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
        cache: "no-store",
      }
    );

    return handleResponse(response);
  },
};