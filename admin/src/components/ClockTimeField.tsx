export function ClockTimeField({
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
