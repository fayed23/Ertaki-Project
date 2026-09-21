import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InfractionAction, InfractionType } from '../common/enums';

@Entity('infraction_policies')
export class InfractionPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  infractionType: InfractionType;

  @Column({ type: 'int' })
  thresholdCount: number;

  @Column({ type: 'varchar' })
  action: InfractionAction;

  @Column({ type: 'text', nullable: true })
  actionLabel: string | null;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
