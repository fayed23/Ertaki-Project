import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Future-ready deadline config — not enforced in MVP behavior. */
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

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
