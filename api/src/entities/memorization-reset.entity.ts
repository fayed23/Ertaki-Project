import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('memorization_resets')
export class MemorizationReset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @Column({ type: 'simple-json' })
  previousProgressJson: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  historyId: string | null;

  @Column({ type: 'varchar', nullable: true })
  newProgressId: string | null;

  @Column()
  resetById: string;

  @Column({ type: 'text' })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
