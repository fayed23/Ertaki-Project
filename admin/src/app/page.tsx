"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:43124/api";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  status: string;
};

type Dashboard = {
  today: string;
  students: number;
  teachers: number;
  groups: number;
  pendingJoins: number;
  activeStudents: number;
  openInfractions: number;
  reportsToday: number;
};

type JoinRequest = {
  id: string;
  status: string;
  student: User;
  group: { id: string; name: string };
  reviewNote?: string | null;
};

type Policy = {
  id: string;
  infractionType: string;
  thresholdCount: number;
  action: string;
  actionLabel?: string | null;
  enabled: boolean;
};

type Group = {
  id: string;
  name: string;
  whatsappUrl?: string | null;
  currentStudentCount: number;
  seatCount: number;
  status: string;
  weeklySessionDay: string;
  weeklySessionTime: string;
  teacher?: User;
};

async function api<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export default function AdminHome() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState("0500000001");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [joins, setJoins] = useState<JoinRequest[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<"dash" | "joins" | "groups" | "policies">(
    "dash",
  );

  const authed = useMemo(() => !!token && !!user, [token, user]);

  useEffect(() => {
    const saved = localStorage.getItem("ertaki_admin_token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const me = await api<User>("/auth/me", token);
        setUser(me);
        setError(null);
      } catch (e) {
        setToken(null);
        localStorage.removeItem("ertaki_admin_token");
        setError(e instanceof Error ? e.message : "فشل التحقق");
      }
    })();
  }, [token]);

  async function refresh() {
    if (!token) return;
    const [d, j, p, g] = await Promise.all([
      api<Dashboard>("/dashboards/supervisor", token),
      api<JoinRequest[]>("/join-requests", token),
      api<Policy[]>("/infraction-policies", token),
      api<Group[]>("/groups", token),
    ]);
    setDashboard(d);
    setJoins(j);
    setPolicies(p);
    setGroups(g);
  }

  useEffect(() => {
    if (!authed) return;
    refresh().catch((e) => setError(String(e.message || e)));
  }, [authed]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api<{ accessToken: string; user: User }>(
        "/auth/login",
        null,
        {
          method: "POST",
          body: JSON.stringify({ phone, password }),
        },
      );
      localStorage.setItem("ertaki_admin_token", res.accessToken);
      setToken(res.accessToken);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الدخول");
    }
  }

  function logout() {
    localStorage.removeItem("ertaki_admin_token");
    setToken(null);
    setUser(null);
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <form
          onSubmit={onLogin}
          className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 shadow-sm"
        >
          <p className="text-sm text-[var(--muted)] mb-1">برنامج ارتق</p>
          <h1 className="text-3xl font-bold mb-6 text-[var(--accent)]">
            لوحة المشرف
          </h1>
          <label className="block mb-4">
            <span className="text-sm text-[var(--muted)]">الهاتف</span>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="block mb-6">
            <span className="text-sm text-[var(--muted)]">كلمة المرور</span>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--accent)] text-white py-2.5 font-semibold"
          >
            دخول
          </button>
          <p className="mt-4 text-xs text-[var(--muted)]">
            تجريبي: 0500000001 / password123 — API: {API_BASE}
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">ارتق · إدارة</p>
          <h1 className="text-2xl md:text-3xl font-bold">
            مرحباً، {user?.firstName} {user?.lastName}
          </h1>
        </div>
        <button
          onClick={logout}
          className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm"
        >
          خروج
        </button>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["dash", "لوحة المؤشرات"],
            ["joins", "طلبات الانضمام"],
            ["groups", "المجموعات"],
            ["policies", "سياسات التقصير"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm ${
              tab === key
                ? "bg-[var(--accent)] text-white"
                : "bg-white border border-[var(--line)]"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {tab === "dash" && dashboard && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["الطلبة", dashboard.students],
            ["المعلمون", dashboard.teachers],
            ["المجموعات", dashboard.groups],
            ["طلبات معلّقة", dashboard.pendingJoins],
            ["نشطون", dashboard.activeStudents],
            ["تقصير مفتوح", dashboard.openInfractions],
            ["تقارير اليوم", dashboard.reportsToday],
            ["اليوم", dashboard.today],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5"
            >
              <p className="text-sm text-[var(--muted)]">{label}</p>
              <p className="mt-2 text-3xl font-bold text-[var(--accent)]">
                {value}
              </p>
            </div>
          ))}
        </section>
      )}

      {tab === "joins" && (
        <section className="space-y-3">
          {joins.length === 0 && (
            <p className="text-[var(--muted)]">لا توجد طلبات.</p>
          )}
          {joins.map((j) => (
            <div
              key={j.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold">
                  {j.student.firstName} {j.student.lastName} → {j.group.name}
                </p>
                <p className="text-sm text-[var(--muted)]">الحالة: {j.status}</p>
              </div>
              {j.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    className="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-white text-sm"
                    onClick={async () => {
                      await api(`/join-requests/${j.id}`, token, {
                        method: "PATCH",
                        body: JSON.stringify({ accept: true }),
                      });
                      await refresh();
                    }}
                  >
                    قبول
                  </button>
                  <button
                    className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-sm"
                    onClick={async () => {
                      await api(`/join-requests/${j.id}`, token, {
                        method: "PATCH",
                        body: JSON.stringify({ accept: false }),
                      });
                      await refresh();
                    }}
                  >
                    رفض
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "groups" && (
        <section className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{g.name}</h2>
                  <p className="text-sm text-[var(--muted)]">
                    {g.weeklySessionDay} {g.weeklySessionTime} ·{" "}
                    {g.currentStudentCount}/{g.seatCount} · {g.status}
                  </p>
                  {g.teacher && (
                    <p className="text-sm mt-1">
                      المعلم: {g.teacher.firstName} {g.teacher.lastName}
                    </p>
                  )}
                </div>
                {g.whatsappUrl && (
                  <a
                    href={g.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent)]"
                  >
                    واتساب المجموعة
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "policies" && (
        <section className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            العواقب تُقرأ من الإعدادات فقط — لا توجد عتبات ثابتة في منطق التطبيق.
            السياسات المعطّلة لا تُنفَّذ.
          </p>
          {policies.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold">
                  {p.infractionType} · عتبة {p.thresholdCount} → {p.action}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {p.actionLabel || "—"} ·{" "}
                  {p.enabled ? "مفعّلة" : "معطّلة"}
                </p>
              </div>
              <button
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-sm"
                onClick={async () => {
                  await api("/infraction-policies", token, {
                    method: "POST",
                    body: JSON.stringify({ ...p, enabled: !p.enabled }),
                  });
                  await refresh();
                }}
              >
                {p.enabled ? "تعطيل" : "تفعيل"}
              </button>
            </div>
          ))}
          <button
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-white text-sm"
            onClick={async () => {
              await api("/infraction-policies", token, {
                method: "POST",
                body: JSON.stringify({
                  infractionType: "unexcused_absence",
                  thresholdCount: 2,
                  action: "warn",
                  actionLabel: "تنبيه بعد غيابين بلا عذر",
                  enabled: false,
                }),
              });
              await refresh();
            }}
          >
            إضافة سياسة مثال (معطّلة)
          </button>
        </section>
      )}
    </main>
  );
}
