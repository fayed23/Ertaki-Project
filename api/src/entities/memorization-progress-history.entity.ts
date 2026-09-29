import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { timestampColumnType } from '../common/column-types';

@Entity('memorization_progress_history')
export class MemorizationProgressHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @Column({ type: 'varchar', nullable: true })
  resetId: string | null;

  @Column({ type: 'simple-json' })
  snapshotJson: Record<string, unknown>;

  @Column()
  archivedById: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: timestampColumnType })
  archivedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
