export const STATUS_AR: Record<string, string> = {
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

export function groupStatusLabel(status: string) {
  if (status === "pending_approval") return "بانتظار الموافقة";
  return STATUS_AR[status] || status;
}
