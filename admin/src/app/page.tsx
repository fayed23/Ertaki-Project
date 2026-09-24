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
  pendingAccounts: number;
  activeStudents: number;
  openInfractions: number;
};


type JoinRequest = {
  id: string;
  status: string;
  student: User;
  group: { id: string; name: string };
  reviewNote?: string | null;
};

type PendingAccount = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  status: string;
  city?: string | null;
  accountReviewNote?: string | null;
  createdAt?: string;
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
  sessionStartTime?: string | null;
  sessionEndTime?: string | null;
  teacherName?: string | null;
  gender?: string;
  description?: string | null;
  teacher?: User;
};


type Directory = {
  students: User[];
  teachers: User[];
  groups: Group[];
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

const TIME_STEP = 5;
const DAY_MIN = 24 * 60 - TIME_STEP;

function clampMin(m: number) {
  const snapped = Math.round(m / TIME_STEP) * TIME_STEP;
  return Math.max(0, Math.min(DAY_MIN, snapped));
}

function parseHhMm(raw: string | null | undefined, fallback = 0) {
  if (!raw) return clampMin(fallback);
  const [h, m] = raw.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return clampMin(fallback);
  return clampMin(h * 60 + m);
}

function formatHhMm(minutes: number) {
  const m = clampMin(minutes);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function ClockTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value || "23:59")}
          aria-label={label}
          dir="ltr"
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--forest)",
            padding: "0.45rem 0.65rem",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--paper)",
          }}
        />
      </div>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.78rem" }}>
        اختيار بساعة النظام (مثل إنشاء المجموعة في التطبيق)
      </p>
    </div>
  );
}


type DeadlineConfig = {
  id?: string;
  enabled: boolean;
  timezone: string;
  closeTimeLocal: string;
  reminderMinutesBefore?: number;
  notes?: string | null;
};

const STATUS_AR: Record<string, string> = {
  pending: "قيد المراجعة",
  pending_approval: "بانتظار التفعيل",
  accepted: "مقبول",
  rejected: "مرفوض",
  cancelled: "ملغى",
  open: "مفتوحة",
  full: "مكتملة",
  closed: "مغلقة",
  paused: "متوقفة",
  student: "طالب",
  teacher: "معلم",
};

function groupStatusLabel(status: string) {
  if (status === "pending_approval") return "بانتظار الموافقة";
  return STATUS_AR[status] || status;
}

export default function AdminHome() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState("0500000001");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [joins, setJoins] = useState<JoinRequest[]>([]);
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [deadline, setDeadline] = useState<DeadlineConfig | null>(null);
  const [closeMinutes, setCloseMinutes] = useState(23 * 60 + 55);
  const [tab, setTab] = useState<
    "dash" | "accounts" | "joins" | "groups" | "directory" | "policies"
  >("dash");

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
    const [d, a, j, p, g, dl, dir] = await Promise.all([
      api<Dashboard>("/dashboards/supervisor", token),
      api<PendingAccount[]>("/account-approvals", token),
      api<JoinRequest[]>("/join-requests", token),
      api<Policy[]>("/infraction-policies", token),
      api<Group[]>("/groups", token),
      api<DeadlineConfig[] | DeadlineConfig>("/report-deadline-config", token),
      api<Directory>("/directory", token),
    ]);
    setDashboard(d);
    setAccounts(a);
    setJoins(j);
    setPolicies(p);
    setGroups(g);
    setDirectory(dir);
    const row = Array.isArray(dl) ? dl[0] : dl;
    if (row) {
      setDeadline(row);
      setCloseMinutes(parseHhMm(row.closeTimeLocal, 23 * 60 + 55));
    }
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

  const pendingJoins = joins.filter((j) => j.status === "pending");
  const pendingAccounts = accounts.filter((a) => a.status === "pending_approval");
  const metrics = dashboard
    ? [
        ["تفعيل معلمين", dashboard.pendingAccounts ?? pendingAccounts.length],
        ["طلبات انضمام", dashboard.pendingJoins],
        ["تقصير مفتوح", dashboard.openInfractions],
        ["نشطون", dashboard.activeStudents],
        ["الطلبة", dashboard.students],
        ["المعلمون", dashboard.teachers],
        ["المجموعات", dashboard.groups],
      ]
    : [];

  function chip(label: string, tone: "ok" | "warn" | "danger" | "neutral" = "neutral") {
    const bg =
      tone === "ok"
        ? "rgba(42,143,104,0.15)"
        : tone === "warn"
          ? "var(--gold-soft)"
          : tone === "danger"
            ? "rgba(143,47,47,0.12)"
            : "var(--mist-deep, #d3e2da)";
    const color =
      tone === "ok"
        ? "var(--forest-mid)"
        : tone === "warn"
          ? "var(--gold)"
          : tone === "danger"
            ? "var(--danger)"
            : "var(--ink-soft)";
    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.2rem 0.65rem",
          borderRadius: 8,
          background: bg,
          color,
          fontSize: "0.78rem",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
    );
  }

  function toast(msg: string) {
    setError(null);
    // reuse error banner as success via temporary message without danger style
    const el = document.getElementById("ertaki-toast");
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
      window.setTimeout(() => {
        el.style.display = "none";
      }, 2500);
    }
  }

  return (
    <main style={{ minHeight: "100vh", paddingBlock: "1.25rem 2rem" }}>
      <div className="shell">
        <div
          id="ertaki-toast"
          style={{
            display: "none",
            marginBottom: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: 12,
            background: "var(--forest)",
            color: "#f7faf8",
            fontSize: "0.92rem",
            fontWeight: 600,
          }}
        />
        <header
          className="anim-rise"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1.25rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div>
            <p
              className="brand-mark"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3rem)", margin: 0 }}
            >
              ارتق
            </p>
            <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.95rem" }}>
              لوحة المشرف · مرحباً {user?.firstName} {user?.lastName}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={logout}>
            خروج
          </button>
        </header>

        <nav className="nav-rail anim-rise-delay" style={{ marginBottom: "1.15rem" }}>
          {(
            [
              ["dash", "لوحة المؤشرات"],
              ["accounts", `تفعيل المعلمين${pendingAccounts.length ? ` (${pendingAccounts.length})` : ""}`],
              ["joins", `طلبات الانضمام${pendingJoins.length ? ` (${pendingJoins.length})` : ""}`],
              ["groups", "المجموعات"],
              ["directory", "الدليل"],
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
            {pendingAccounts.length > 0 && (
              <div
                className="panel"
                style={{
                  padding: "1rem 1.15rem",
                  marginBottom: "1rem",
                  borderColor: "var(--gold)",
                  background: "linear-gradient(135deg, var(--gold-soft), rgba(247,250,248,0.9))",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
                      حسابات بانتظار التفعيل ({pendingAccounts.length})
                    </h2>
                    <p style={{ margin: "0.3rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                      وافق أو ارفض تسجيلات المعلمين (الطلبة يُفعَّلون فوراً ويختارون مجموعة)
                    </p>
                  </div>
                  <button type="button" className="btn-primary" style={{ boxShadow: "none" }} onClick={() => setTab("accounts")}>
                    مراجعة الحسابات
                  </button>
                </div>
              </div>
            )}
            {pendingAccounts.length === 0 && pendingJoins.length > 0 && (
              <div
                className="panel"
                style={{
                  padding: "1rem 1.15rem",
                  marginBottom: "1rem",
                  borderColor: "var(--gold)",
                  background: "linear-gradient(135deg, var(--gold-soft), rgba(247,250,248,0.9))",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
                      طلبات انضمام بانتظارك ({pendingJoins.length})
                    </h2>
                    <p style={{ margin: "0.3rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                      المعلم أو المشرف يقبل — قبول واحد يُنهي الطلب للطرفين
                    </p>
                  </div>
                  <button type="button" className="btn-primary" style={{ boxShadow: "none" }} onClick={() => setTab("joins")}>
                    فتح الطلبات
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "0.75rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--ink-soft)" }}>
                نظرة اليوم · {dashboard.today}
              </h2>
            </div>

            <div
              className="panel"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "0 1rem",
                padding: "0.2rem 1.1rem 0.35rem",
              }}
            >
              {metrics.map(([label, value]) => (
                <div key={String(label)} className="metric" style={{ padding: "0.85rem 0" }}>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.82rem" }}>
                    {label}
                  </p>
                  <p
                    style={{
                      margin: "0.25rem 0 0",
                      fontSize: "1.65rem",
                      fontWeight: 700,
                      color: "var(--forest)",
                      fontFamily: "var(--font-body)",
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

        {tab === "accounts" && (
          <section className="anim-rise-delay-2">
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.25rem" }}>تفعيل الحسابات</h2>
            <p style={{ margin: "0 0 0.85rem", color: "var(--muted)" }}>
              تفعيل حسابات المعلمين فقط — الطلبة يُفعَّلون فوراً ويختارون مجموعة (منفصل عن طلبات الانضمام)
            </p>
            <div className="panel">
              {accounts.length === 0 && (
                <p className="row-item" style={{ color: "var(--muted)", margin: 0 }}>
                  لا حسابات بانتظار التفعيل حالياً.
                </p>
              )}
              {accounts.map((a) => (
                <div
                  key={a.id}
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
                      {a.firstName} {a.lastName}
                      <span style={{ color: "var(--muted)", fontWeight: 500 }}>
                        {" "}
                        · {STATUS_AR[a.role] || a.role} · {a.phone}
                      </span>
                    </p>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {chip(
                        STATUS_AR[a.status] || a.status,
                        a.status === "pending_approval"
                          ? "warn"
                          : a.status === "rejected"
                            ? "danger"
                            : "neutral",
                      )}
                      {a.city && (
                        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{a.city}</span>
                      )}
                      {a.status === "rejected" && a.accountReviewNote && (
                        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                          السبب: {a.accountReviewNote}
                        </span>
                      )}
                    </div>
                  </div>
                  {a.status === "pending_approval" && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ boxShadow: "none", minHeight: 44 }}
                        onClick={async () => {
                          try {
                            await api(`/account-approvals/${a.id}`, token, {
                              method: "PATCH",
                              body: JSON.stringify({ approve: true }),
                            });
                            toast("تم تفعيل الحساب");
                            await refresh();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      >
                        تفعيل
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ minHeight: 44 }}
                        onClick={async () => {
                          const note = window.prompt("سبب الرفض (اختياري)");
                          if (note === null) return;
                          try {
                            await api(`/account-approvals/${a.id}`, token, {
                              method: "PATCH",
                              body: JSON.stringify({
                                approve: false,
                                reviewNote: note.trim() || undefined,
                              }),
                            });
                            toast("تم رفض الحساب");
                            await refresh();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : String(e));
                          }
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
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.25rem" }}>المجموعات</h2>
            <p style={{ margin: "0 0 0.85rem", color: "var(--muted)" }}>
              مواعيد المجالس · موافقة طلبات إنشاء المعلم · روابط واتساب
            </p>
            <div className="panel">
              {groups.length === 0 && (
                <p className="row-item" style={{ color: "var(--muted)", margin: 0 }}>
                  لا مجموعات بعد.
                </p>
              )}
              {groups.map((g) => {
                const ratio = g.seatCount ? Math.min(1, g.currentStudentCount / g.seatCount) : 0;
                const start = g.sessionStartTime || g.weeklySessionTime;
                const timeLabel = g.sessionEndTime ? `${start} → ${g.sessionEndTime}` : start;
                return (
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
                  <div style={{ flex: "1 1 240px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1.15rem",
                          fontFamily: "var(--font-body)",
                          fontWeight: 700,
                          color: "var(--forest)",
                        }}
                      >
                        {g.name}
                      </h3>
                      {chip(
                        groupStatusLabel(g.status),
                        g.status === "open"
                          ? "ok"
                          : g.status === "pending_approval"
                            ? "warn"
                            : g.status === "full"
                              ? "warn"
                              : "neutral",
                      )}
                    </div>
                    <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                      {g.weeklySessionDay} · {timeLabel}
                      {g.teacher
                        ? ` · المعلم: ${g.teacher.firstName} ${g.teacher.lastName}`
                        : g.teacherName
                          ? ` · ${g.teacherName}`
                          : ""}
                    </p>
                    <div style={{ marginTop: 8, maxWidth: 280 }}>
                      <div style={{ height: 8, borderRadius: 6, background: "var(--mist-deep, #d3e2da)", overflow: "hidden" }}>
                        <div style={{ width: `${ratio * 100}%`, height: "100%", background: "var(--forest-mid)" }} />
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                        {g.currentStudentCount}/{g.seatCount} مقعد
                      </p>
                    </div>
                    {g.status === "pending_approval" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ boxShadow: "none" }}
                          onClick={async () => {
                            try {
                              await api(`/groups/${g.id}/approval`, token, {
                                method: "PATCH",
                                body: JSON.stringify({ approve: true }),
                              });
                              await refresh();
                            } catch (e) {
                              setError(String((e as Error).message || e));
                            }
                          }}
                        >
                          موافقة
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={async () => {
                            try {
                              await api(`/groups/${g.id}/approval`, token, {
                                method: "PATCH",
                                body: JSON.stringify({ approve: false }),
                              });
                              await refresh();
                            } catch (e) {
                              setError(String((e as Error).message || e));
                            }
                          }}
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                  {g.whatsappUrl && (
                    <a
                      href={g.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost"
                      style={{ background: "var(--gold-soft)", borderColor: "transparent", minHeight: 44 }}
                    >
                      واتساب المجموعة
                    </a>
                  )}
                </div>
              );})}
            </div>
          </section>
        )}

        {tab === "directory" && (
          <section className="anim-rise-delay-2">
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.25rem" }}>الدليل الشامل</h2>
            <p style={{ margin: "0 0 0.85rem", color: "var(--muted)" }}>
              كل المعلمين والطلبة والمجموعات
            </p>
            {!directory && <p style={{ color: "var(--muted)" }}>جاري التحميل…</p>}
            {directory && (
              <div style={{ display: "grid", gap: "1rem" }}>
                {(
                  [
                    ["المعلمون", directory.teachers],
                    ["الطلبة", directory.students],
                  ] as const
                ).map(([title, rows]) => (
                  <div key={title} className="panel">
                    <h3 style={{ margin: "0.75rem 1rem", fontSize: "1.1rem" }}>{title} ({rows.length})</h3>
                    {rows.map((u) => (
                      <div key={u.id} className="row-item">
                        {u.firstName} {u.lastName} · {u.phone} · {STATUS_AR[u.status] || u.status}
                      </div>
                    ))}
                  </div>
                ))}
                <div className="panel">
                  <h3 style={{ margin: "0.75rem 1rem", fontSize: "1.1rem" }}>
                    المجموعات ({directory.groups.length})
                  </h3>
                  {directory.groups.map((g) => (
                    <div key={g.id} className="row-item">
                      {g.name} · {g.teacherName || ""} · {groupStatusLabel(g.status)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "policies" && (
          <section className="anim-rise-delay-2">
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem" }}>سياسات التقصير</h2>
            <p style={{ margin: "0 0 1rem", color: "var(--muted)", maxWidth: 560 }}>
              العواقب تُقرأ من الإعدادات فقط — لا عتبات ثابتة في منطق التطبيق. السياسات
              المعطّلة لا تُنفَّذ.
            </p>

            <div className="panel" style={{ padding: "1.15rem", marginBottom: "1rem", display: "grid", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>وقت إغلاق التقرير اليومي</h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                يُضبط بساعة النظام (HH:mm) — نفس أسلوب إنشاء المجموعة
              </p>
              <ClockTimeField
                label="إغلاق النافذة"
                value={formatHhMm(closeMinutes)}
                onChange={(hhmm) => setCloseMinutes(parseHhMm(hhmm, 23 * 60 + 59))}
              />
              <button
                type="button"
                className="btn-primary"
                style={{ boxShadow: "none", justifySelf: "start" }}
                onClick={async () => {
                  if (!token) return;
                  try {
                    await api("/report-deadline-config", token, {
                      method: "POST",
                      body: JSON.stringify({
                        enabled: deadline?.enabled ?? true,
                        timezone: deadline?.timezone || "Africa/Algiers",
                        closeTimeLocal: formatHhMm(closeMinutes),
                        reminderMinutesBefore: deadline?.reminderMinutesBefore ?? 60,
                        notes: deadline?.notes ?? null,
                      }),
                    });
                    toast(`تم حفظ وقت الإغلاق ${formatHhMm(closeMinutes)}`);
                    await refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                حفظ وقت الإغلاق
              </button>
            </div>


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
