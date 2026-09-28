import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { timestampColumnType } from '../common/column-types';
import { User } from './user.entity';
import { Group } from './group.entity';

@Entity('weekly_reports')
@Unique(['studentId', 'weekStartDate'])
export class WeeklyReport {
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
  weekStartDate: string;

  @Column({ type: 'date' })
  weekEndDate: string;

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

  @Column({ type: 'simple-json', nullable: true })
  summaryJson: Record<string, unknown> | null;

  @Column({ type: timestampColumnType, nullable: true })
  studentConfirmedAt: Date | null;

  @Column({ type: timestampColumnType })
  generatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
