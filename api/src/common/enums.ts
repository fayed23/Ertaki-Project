export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  SUPERVISOR = 'supervisor',
  ADMIN = 'admin',
}

export enum UserStatus {
  NEW = 'new',
  PENDING_GROUP = 'pending_group',
  ACTIVE = 'active',
  PAUSED = 'paused',
  WITHDRAWN = 'withdrawn',
  SUSPENDED = 'suspended',
  COMPLETED = 'completed',
}

export enum GroupGender {
  MEN = 'men',
  WOMEN = 'women',
}

export enum GroupStatus {
  OPEN = 'open',
  FULL = 'full',
  CLOSED = 'closed',
  PAUSED = 'paused',
}

export enum JoinRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  EXCUSED = 'excused',
  UNEXCUSED = 'unexcused',
}

export enum ExcuseRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum InfractionType {
  MISSING_DAILY_REPORT = 'missing_daily_report',
  MISSED_QUOTA = 'missed_quota',
  MISSED_50_REPS = 'missed_50_reps',
  MISSED_SINGLE_SITTING = 'missed_single_sitting',
  MISSED_REVIEW = 'missed_review',
  UNEXCUSED_ABSENCE = 'unexcused_absence',
  OTHER = 'other',
}

export enum InfractionAction {
  WARN = 'warn',
  FREEZE = 'freeze',
  REMOVE = 'remove',
  CUSTOM = 'custom',
}

export enum NoteVisibility {
  INTERNAL = 'internal',
  STUDENT_VISIBLE = 'student_visible',
}
