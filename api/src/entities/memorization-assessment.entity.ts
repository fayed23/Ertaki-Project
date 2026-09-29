import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MemorizationAssessmentStatus } from '../common/enums';
import { timestampColumnType } from '../common/column-types';

@Entity('memorization_assessments')
export class MemorizationAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @Column({ type: 'int' })
  cycleNumber: number;

  @Column({ type: 'varchar', default: MemorizationAssessmentStatus.PENDING })
  status: MemorizationAssessmentStatus;

  @Column({ type: 'varchar', nullable: true })
  assessedById: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: timestampColumnType, nullable: true })
  scheduledAt: Date | null;

  @Column({ type: timestampColumnType, nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
