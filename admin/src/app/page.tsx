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

const STATUS_AR: Record<string, string> = {
  pending: "قيد المراجعة",
  accepted: "مقبول",
  rejected: "مرفوض",
  cancelled: "ملغى",
  open: "مفتوحة",
  full: "مكتملة",
  closed: "مغلقة",
  paused: "متوقفة",
};

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
      <main
        style={{
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          padding: "2rem 1rem",
        }}
      >
        <div
          className="orb"
          style={{
            width: 280,
            height: 280,
            background: "rgba(23, 107, 77, 0.35)",
            top: "-4rem",
            insetInlineEnd: "-3rem",
          }}
        />
        <div
          className="orb"
          style={{
            width: 220,
            height: 220,
            background: "rgba(184, 146, 62, 0.28)",
            bottom: "-3rem",
            insetInlineStart: "-2rem",
            animationDelay: "1.5s",
          }}
        />

        <div className="shell" style={{ width: "min(440px, 100%)", position: "relative", zIndex: 1 }}>
          <header className="anim-brand" style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <p
              className="brand-mark"
              style={{ fontSize: "clamp(3.4rem, 12vw, 5rem)", margin: 0 }}
            >
              ارتق
            </p>
            <p
              style={{
                margin: "0.85rem 0 0",
                color: "var(--muted)",
                fontSize: "1.05rem",
                lineHeight: 1.7,
              }}
            >
              متابعة حفظ القرآن الكريم
            </p>
          </header>

          <form
            onSubmit={onLogin}
            className="panel anim-rise-delay"
            style={{ padding: "1.75rem 1.5rem 1.5rem" }}
          >
            <h1
              style={{
                margin: "0 0 1.25rem",
                fontSize: "1.35rem",
                fontWeight: 700,
                color: "var(--ink-soft)",
              }}
            >
              دخول المشرف
            </h1>
            <div style={{ display: "grid", gap: "1rem" }}>
              <label className="field">
                <span>رقم الهاتف</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="username"
                  dir="ltr"
                  style={{ textAlign: "right" }}
                />
              </label>
              <label className="field">
                <span>كلمة المرور</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
            </div>
            {error && (
              <p style={{ color: "var(--danger)", margin: "1rem 0 0", fontSize: "0.92rem" }}>
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "1.35rem" }}>
              دخول إلى اللوحة
            </button>
            <p
              style={{
                margin: "1rem 0 0",
                color: "var(--muted)",
                fontSize: "0.78rem",
                lineHeight: 1.6,
              }}
            >
              حساب تجريبي: 0500000001 · password123
            </p>
          </form>
        </div>
      </main>
    );
  }

  const metrics = dashboard
    ? [
        ["الطلبة", dashboard.students],
        ["المعلمون", dashboard.teachers],
        ["المجموعات", dashboard.groups],
        ["طلبات معلّقة", dashboard.pendingJoins],
        ["نشطون", dashboard.activeStudents],
        ["تقصير مفتوح", dashboard.openInfractions],
        ["تقارير اليوم", dashboard.reportsToday],
      ]
    : [];

  return (
    <main style={{ minHeight: "100vh", paddingBlock: "1.5rem 2.5rem" }}>
      <div className="shell">
        <header
          className="anim-rise"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1.75rem",
            paddingBottom: "1.25rem",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div>
            <p
              className="brand-mark"
              style={{ fontSize: "clamp(2.4rem, 6vw, 3.4rem)", margin: 0 }}
            >
              ارتق
            </p>
            <p style={{ margin: "0.45rem 0 0", color: "var(--muted)", fontSize: "1rem" }}>
              لوحة المشرف · مرحباً {user?.firstName} {user?.lastName}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={logout}>
            خروج
          </button>
        </header>

        <nav className="nav-rail anim-rise-delay" style={{ marginBottom: "1.5rem" }}>
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
              type="button"
              data-active={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        {error && (
          <p
            className="panel"
            style={{
              padding: "0.9rem 1rem",
              marginBottom: "1rem",
              color: "var(--danger)",
              fontSize: "0.92rem",
            }}
          >
            {error}
          </p>
        )}

        {tab === "dash" && dashboard && (
          <section className="anim-rise-delay-2">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "1.35rem", color: "var(--ink-soft)" }}>
                  نظرة اليوم
                </h2>
                <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.95rem" }}>
                  ملخص البرنامج ليوم {dashboard.today}
                </p>
              </div>
              <span
                style={{
                  alignSelf: "center",
                  color: "var(--gold)",
                  fontFamily: "var(--font-display)",
                  fontSize: "1.15rem",
                }}
              >
                بسم الله نبدأ
              </span>
            </div>

            <div
              className="panel"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "0 1.5rem",
                padding: "0.35rem 1.4rem 0.5rem",
              }}
            >
              {metrics.map(([label, value]) => (
                <div key={String(label)} className="metric">
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
                    {label}
                  </p>
                  <p
                    style={{
                      margin: "0.35rem 0 0",
                      fontSize: "2rem",
                      fontWeight: 700,
                      color: "var(--forest)",
                      fontFamily: "var(--font-display)",
                      lineHeight: 1.1,
                    }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "joins" && (
          <section className="anim-rise-delay-2">
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem" }}>طلبات الانضمام</h2>
            <p style={{ margin: "0 0 1rem", color: "var(--muted)" }}>
              قبول أو رفض طلبات الطلبة للمجموعات
            </p>
            <div className="panel">
              {joins.length === 0 && (
                <p className="row-item" style={{ color: "var(--muted)", margin: 0 }}>
                  لا توجد طلبات حالياً.
                </p>
              )}
              {joins.map((j) => (
                <div
                  key={j.id}
                  className="row-item"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    gap: "0.85rem",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      {j.student.firstName} {j.student.lastName}
                      <span style={{ color: "var(--muted)", fontWeight: 500 }}> ← </span>
                      {j.group.name}
                    </p>
                    <p style={{ margin: "0.3rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                      الحالة: {STATUS_AR[j.status] || j.status}
                    </p>
                  </div>
                  {j.status === "pending" && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: "0.55rem 1rem", boxShadow: "none" }}
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
                        type="button"
                        className="btn-ghost"
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
            </div>
          </section>
        )}

        {tab === "groups" && (
          <section className="anim-rise-delay-2">
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem" }}>المجموعات</h2>
            <p style={{ margin: "0 0 1rem", color: "var(--muted)" }}>
              مواعيد المجالس وروابط واتساب الخارجية
            </p>
            <div className="panel">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="row-item"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    gap: "0.85rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1.2rem",
                        fontFamily: "var(--font-display)",
                        color: "var(--forest)",
                      }}
                    >
                      {g.name}
                    </h3>
                    <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: "0.92rem" }}>
                      {g.weeklySessionDay} · {g.weeklySessionTime} ·{" "}
                      {g.currentStudentCount}/{g.seatCount} مقعد ·{" "}
                      {STATUS_AR[g.status] || g.status}
                    </p>
                    {g.teacher && (
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.92rem" }}>
                        المعلم: {g.teacher.firstName} {g.teacher.lastName}
                      </p>
                    )}
                  </div>
                  {g.whatsappUrl && (
                    <a
                      href={g.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost"
                      style={{ background: "var(--gold-soft)", borderColor: "transparent" }}
                    >
                      واتساب المجموعة
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "policies" && (
          <section className="anim-rise-delay-2">
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem" }}>سياسات التقصير</h2>
            <p style={{ margin: "0 0 1rem", color: "var(--muted)", maxWidth: 560 }}>
              العواقب تُقرأ من الإعدادات فقط — لا عتبات ثابتة في منطق التطبيق. السياسات
              المعطّلة لا تُنفَّذ.
            </p>
            <div className="panel" style={{ marginBottom: "1rem" }}>
              {policies.map((p) => (
                <div
                  key={p.id}
                  className="row-item"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    gap: "0.85rem",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      {p.infractionType}
                      <span className={`status-dot ${p.enabled ? "" : "off"}`} />
                    </p>
                    <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                      عتبة {p.thresholdCount} → {p.action}
                      {p.actionLabel ? ` · ${p.actionLabel}` : ""} ·{" "}
                      {p.enabled ? "مفعّلة" : "معطّلة"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost"
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
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ boxShadow: "none" }}
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
      </div>
    </main>
  );
}
