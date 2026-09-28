export type User = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  status: string;
};

export type Dashboard = {
  today: string;
  students: number;
  teachers: number;
  groups: number;
  pendingJoins: number;
  pendingAccounts: number;
  activeStudents: number;
  openInfractions: number;
};

export type JoinRequest = {
  id: string;
  status: string;
  student: User;
  group: { id: string; name: string };
  reviewNote?: string | null;
};

export type PendingAccount = {
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

export type Policy = {
  id: string;
  infractionType: string;
  thresholdCount: number;
  action: string;
  actionLabel?: string | null;
  enabled: boolean;
};

export type Group = {
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

export type Directory = {
  students: User[];
  teachers: User[];
  groups: Group[];
};

export type DeadlineConfig = {
  id?: string;
  enabled: boolean;
  timezone: string;
  closeTimeLocal: string;
  reminderMinutesBefore?: number;
  notes?: string | null;
};

export type AdminTab =
  | "dash"
  | "accounts"
  | "joins"
  | "groups"
  | "directory"
  | "policies";
