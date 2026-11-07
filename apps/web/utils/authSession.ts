export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("readerFiles");
  window.dispatchEvent(new Event("auth-change"));
}

export function setAuthSession(data: { token?: string; user?: string }) {
  if (!data?.token || !data.user) throw new Error("Sign-in did not return a valid session. Please try again.");
  sessionStorage.removeItem("readerFiles");
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", data.user);
  window.dispatchEvent(new Event("auth-change"));
}
