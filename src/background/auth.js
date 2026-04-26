import { API_ENDPOINTS } from "../config/api.js";

export async function refreshAccessToken(refreshToken) {
  console.log("refreshAccessToken called");
  if (!refreshToken) throw new Error("Missing refresh token");

  const res = await fetch(API_ENDPOINTS.refresh, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!res.ok) throw new Error("Invalid or expired refresh token");

  const data = await res.json().catch(() => ({}));
  if (!data?.access) {
    console.error("Failed to refresh access token:", data);
    throw new Error("Failed to refresh access token");
  }
  console.log('Access token refreshed successfully');
  return data.access;
}
