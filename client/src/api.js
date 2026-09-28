const call = async (path, options = {}) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Request failed.");
    err.status = res.status;
    throw err;
  }
  return data;
};

export const login = (email, password) =>
  call("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const sendMail = (payload) =>
  call("/mail/send", { method: "POST", body: JSON.stringify(payload) });
export const getHistory = (page = 1) => call(`/mail?page=${page}`);
export const getMail = (id) => call(`/mail/${id}`);
