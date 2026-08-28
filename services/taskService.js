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
// Handle Response
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
        "Task request failed."
    );
  }

  return data;
};

// ==========================================
// Task Service
// ==========================================

export const taskService = {
  // ========================================
  // GET /api/tasks
  // Admin / Manager
  // ========================================

  async getTasks() {
    const response = await fetch(
      `${API_URL}/tasks`,
      {
        method: "GET",

        headers: {
          Accept: "application/json",
        },

        credentials: "include",

        cache: "no-store",
      }
    );

    return handleResponse(response);
  },

  // ========================================
  // GET /api/tasks/:id
  // ========================================

  async getTask(id) {
    if (!id) {
      throw new Error("Task ID is required.");
    }

    const response = await fetch(
      `${API_URL}/tasks/${id}`,
      {
        method: "GET",

        headers: {
          Accept: "application/json",
        },

        credentials: "include",

        cache: "no-store",
      }
    );

    return handleResponse(response);
  },

  // ========================================
  // POST /api/tasks
  // ========================================

  async createTask(taskData) {
    const response = await fetch(
      `${API_URL}/tasks`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        credentials: "include",

        body: JSON.stringify(taskData),
      }
    );

    return handleResponse(response);
  },

  // ========================================
  // PUT /api/tasks/:id
  // ========================================

  async updateTask(id, taskData) {
    if (!id) {
      throw new Error("Task ID is required.");
    }

    const response = await fetch(
      `${API_URL}/tasks/${id}`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        credentials: "include",

        body: JSON.stringify(taskData),
      }
    );

    return handleResponse(response);
  },
};