import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MemorizationPlanChangeKind } from '../common/enums';

@Entity('memorization_plan_changes')
export class MemorizationPlanChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @Column()
  planId: string;

  @Column({ type: 'varchar' })
  changeKind: MemorizationPlanChangeKind;

  @Column({ type: 'simple-json', nullable: true })
  previousJson: Record<string, unknown> | null;

  @Column({ type: 'simple-json' })
  newJson: Record<string, unknown>;

  @Column()
  changedById: string;

  @Column({ type: 'text' })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
