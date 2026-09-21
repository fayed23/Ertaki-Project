import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InfractionType } from '../common/enums';
import { User } from './user.entity';

@Entity('infractions')
export class Infraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  student: User;

  @Column()
  studentId: string;

  @Column({ type: 'varchar' })
  type: InfractionType;

  @Column()
  source: string;

  @Column({ type: 'date' })
  occurredOn: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column({ default: false })
  resolved: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
