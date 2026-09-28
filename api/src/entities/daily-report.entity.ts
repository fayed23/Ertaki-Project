import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DailyReportStatus } from '../common/enums';
import { timestampColumnType } from '../common/column-types';
import { User } from './user.entity';

@Entity('daily_reports')
@Unique(['studentId', 'reportDate'])
export class DailyReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  student: User;

  @Column()
  studentId: string;

  @Column({ type: 'date' })
  reportDate: string;

  @Column({ type: 'varchar', default: DailyReportStatus.SUBMITTED })
  status: DailyReportStatus;

  @Column({ type: 'varchar', nullable: true })
  excuseRequestId: string | null;

  @Column({ default: false })
  memorizedQuota: boolean;

  @Column({ type: 'varchar', nullable: true })
  memorizationFrom: string | null;

  @Column({ type: 'varchar', nullable: true })
  memorizationTo: string | null;

  @Column({ type: 'int', nullable: true })
  memorizationSurahNumber: number | null;

  @Column({ type: 'varchar', nullable: true })
  memorizationSurahName: string | null;

  @Column({ type: 'int', nullable: true })
  memorizationAyahFrom: number | null;

  @Column({ type: 'int', nullable: true })
  memorizationAyahTo: number | null;

  @Column({ type: 'varchar', nullable: true })
  reviewPortion: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewFrom: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewTo: string | null;

  @Column({ default: false })
  completedFiftyRepetitions: boolean;

  @Column({ default: false })
  repeatedInOneSitting: boolean;

  @Column({ default: false })
  readTafsir: boolean;

  @Column({ type: timestampColumnType })
  submittedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
