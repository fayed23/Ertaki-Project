const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "/api";

export { API_BASE };

export async function api<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      `تعذر الاتصال بالخادم (${API_BASE}). افتح الموقع عبر نفس العنوان الذي يعمل مع /api/health، أو أعد البناء بـ NEXT_PUBLIC_API_URL=/api`,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}
