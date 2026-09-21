import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Deadline + reminder config. Reminders fire when enabled; auto-infractions still off. */
@Entity('report_deadline_configs')
export class ReportDeadlineConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: false })
  enabled: boolean;

  @Column({ default: 'Africa/Algiers' })
  timezone: string;

  @Column({ default: '23:59' })
  closeTimeLocal: string;

  /** Minutes before closeTimeLocal for the first reminder (default 60). */
  @Column({ default: 60 })
  reminderMinutesBefore: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
