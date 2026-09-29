import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { MemorizationPace } from '../common/enums';

@Entity('memorization_plans')
@Unique(['studentId'])
export class MemorizationPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @Column({ type: 'varchar', nullable: true })
  groupId: string | null;

  @Column({ type: 'int' })
  startSurahNumber: number;

  @Column()
  startSurahName: string;

  @Column({ type: 'int' })
  startAyah: number;

  @Column({ type: 'varchar', default: MemorizationPace.HALF_PAGE })
  pace: MemorizationPace;

  @Column()
  setById: string;

  @Column({ default: true })
  studentMayEdit: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
