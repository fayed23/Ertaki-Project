import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  actorId: string;

  @Column()
  action: string;

  @Column()
  entityType: string;

  @Column({ type: 'varchar', nullable: true  })
  entityId: string | null;

  @Column({ type: 'simple-json', nullable: true })
  beforeJson: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  afterJson: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
