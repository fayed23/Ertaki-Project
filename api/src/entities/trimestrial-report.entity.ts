import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Group } from './group.entity';

@Entity('trimestrial_reports')
@Unique(['studentId', 'groupId', 'periodStartDate'])
export class TrimestrialReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  student: User;

  @Column()
  studentId: string;

  @ManyToOne(() => Group, { eager: true, nullable: true })
  group: Group | null;

  @Column({ type: 'varchar', nullable: true })
  groupId: string | null;

  @Column({ type: 'date' })
  periodStartDate: string;

  @Column({ type: 'date' })
  periodEndDate: string;

  @Column({ type: 'int', default: 0 })
  weeksCount: number;

  @Column({ type: 'int', default: 0 })
  dailyReportsSubmitted: number;

  @Column({ type: 'int', default: 0 })
  quotaDaysMet: number;

  @Column({ type: 'int', default: 0 })
  fiftyRepsDaysMet: number;

  @Column({ type: 'int', default: 0 })
  presentSessions: number;

  @Column({ type: 'int', default: 0 })
  excusedAbsences: number;

  @Column({ type: 'int', default: 0 })
  unexcusedAbsences: number;

  @Column({ type: 'int', default: 0 })
  missedDailyReports: number;

  @Column({ type: 'int', default: 0 })
  missedQuota: number;

  @Column({ type: 'int', default: 0 })
  missedFiftyReps: number;

  @Column({ type: 'int', default: 0 })
  missedSingleSitting: number;

  @Column({ type: 'int', default: 0 })
  missedReview: number;

  @Column({ type: 'int', default: 0 })
  weeksAttendedMajlis: number;

  @Column({ type: 'simple-json', nullable: true })
  summaryJson: Record<string, unknown> | null;

  @Column({ type: 'datetime' })
  generatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
