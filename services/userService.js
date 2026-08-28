const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

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
// Request Helper
// ==========================================

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body
        ? {
            "Content-Type": "application/json",
          }
        : {}),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const data = await parseResponse(response);

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