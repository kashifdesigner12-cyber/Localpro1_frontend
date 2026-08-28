"use client";

import { useCallback, useEffect, useState } from "react";
import { authService } from "@/services/authService";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authService.me();

      if (!response || response.success === false) {
        setUser(null);
        return null;
      }

      const authenticatedUser =
        response?.user ||
        response?.data?.user ||
        response?.data ||
        null;

      if (!authenticatedUser) {
        setUser(null);
        return null;
      }

      setUser(authenticatedUser);

      return authenticatedUser;
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email, password) => {
    try {
      setLoggingIn(true);
      setError("");

      const response = await authService.login(
        email,
        password
      );

      if (!response || response.success === false) {
        throw new Error(
          response?.message ||
            response?.error ||
            "Invalid email or password."
        );
      }

      const authenticatedUser =
        response?.user ||
        response?.data?.user ||
        response?.data ||
        null;

      if (!authenticatedUser) {
        throw new Error(
          "Login successful, but user information was not returned."
        );
      }

      setUser(authenticatedUser);

      return {
        success: true,
        user: authenticatedUser,
        response,
      };
    } catch (error) {
      const message =
        error?.message ||
        "Unable to sign in. Please try again.";

      console.error("Login failed:", error);

      setError(message);
      setUser(null);

      return {
        success: false,
        user: null,
        error: message,
      };
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setError("");
    }
  }, []);

  const role = String(user?.role || "")
    .trim()
    .toLowerCase() || null;

  return {
    user,
    role,
    loading,
    loggingIn,
    error,
    isAuthenticated: Boolean(user),
    login,
    logout,
    checkAuth,
    setUser,
  };
}