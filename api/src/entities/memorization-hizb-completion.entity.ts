import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { timestampColumnType } from '../common/column-types';

@Entity('memorization_hizb_completions')
@Unique(['studentId', 'hizbNumber', 'cycleNumber'])
export class MemorizationHizbCompletion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @Column({ type: 'int' })
  hizbNumber: number;

  @Column({ type: 'int' })
  cycleNumber: number;

  @Column()
  recordedById: string;

  @Column({ type: timestampColumnType })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
