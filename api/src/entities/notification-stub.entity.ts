import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notification_stubs')
export class NotificationStub {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recipientId: string;

  @Column()
  type: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'simple-json', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ default: false })
  delivered: boolean;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
