const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

import { authService } from "./authService";

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
// Get Request Headers with Authorization Support
// ==========================================

const getAuthHeaders = (hasBody = false) => {
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
    ...(hasBody
      ? {
          "Content-Type": "application/json",
        }
      : {}),
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
};

// ==========================================
// Request Helper
// ==========================================

const request = async (url, options = {}) => {
  const hasBody = Boolean(options.body);
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...getAuthHeaders(hasBody),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

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
        `Request failed with status ${response.status}`
    );
  }

  return data;
};

// ==========================================
// User Service
// ==========================================

export const userService = {
  // ========================================
  // GET ALL USERS
  // GET /api/users
  // Admin + Manager
  // ========================================

  async getUsers() {
    return request(`${API_URL}/users`, {
      method: "GET",
    });
  },

  // ========================================
  // GET USER BY ID
  // GET /api/users/:id
  // Admin + Manager
  // ========================================

  async getUserById(id) {
    if (!id) {
      throw new Error("User ID is required.");
    }

    return request(`${API_URL}/users/${id}`, {
      method: "GET",
    });
  },

  // ========================================
  // CREATE USER
  // POST /api/users
  // Admin + Manager
  // ========================================

  async createUser(userData) {
    return request(`${API_URL}/users`, {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },

  // ========================================
  // UPDATE USER
  // PUT /api/users/:id
  // ========================================

  async updateUser(id, userData) {
    if (!id) {
      throw new Error("User ID is required.");
    }

    return request(`${API_URL}/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  },

  // ========================================
  // UPDATE USER STATUS
  // PATCH /api/users/:id/status
  // ========================================

  async updateUserStatus(id, status) {
    if (!id) {
      throw new Error("User ID is required.");
    }

    return request(`${API_URL}/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    });
  },

  // ========================================
  // UPDATE USER ROLE
  // PATCH /api/users/:id/role
  // Admin only
  // ========================================

  async updateUserRole(id, role) {
    if (!id) {
      throw new Error("User ID is required.");
    }

    return request(`${API_URL}/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({
        role,
      }),
    });
  },

  // ========================================
  // DELETE USER
  // DELETE /api/users/:id
  // Admin only
  // ========================================

  async deleteUser(id) {
    if (!id) {
      throw new Error("User ID is required.");
    }

    return request(`${API_URL}/users/${id}`, {
      method: "DELETE",
    });
  },

  // ========================================
  // GET USER STATS
  // GET /api/users/stats
  // Admin + Manager
  // ========================================

  async getUserStats() {
    return request(`${API_URL}/users/stats`, {
      method: "GET",
    });
  },
};