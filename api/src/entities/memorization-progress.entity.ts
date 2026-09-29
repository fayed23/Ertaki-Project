import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { timestampColumnType } from '../common/column-types';

@Entity('memorization_progress')
@Unique(['studentId'])
export class MemorizationProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @Column()
  planId: string;

  @Column({ type: 'int' })
  currentSurahNumber: number;

  @Column()
  currentSurahName: string;

  @Column({ type: 'int' })
  currentAyah: number;

  @Column({ type: 'int', default: 1 })
  cycleNumber: number;

  @Column({ type: 'int', default: 0 })
  hizbsInCycle: number;

  @Column({ type: timestampColumnType })
  startedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
