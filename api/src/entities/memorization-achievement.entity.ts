import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MemorizationAchievementType } from '../common/enums';
import { timestampColumnType } from '../common/column-types';

@Entity('memorization_achievements')
export class MemorizationAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @Column({ type: 'varchar' })
  type: MemorizationAchievementType;

  @Column()
  title: string;

  @Column({ type: 'int', nullable: true })
  hizbNumber: number | null;

  @Column({ type: 'int', nullable: true })
  cycleNumber: number | null;

  @Column({ type: 'varchar', nullable: true })
  certificateId: string | null;

  @Column({ type: timestampColumnType })
  earnedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
