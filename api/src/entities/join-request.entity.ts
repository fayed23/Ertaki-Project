import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JoinRequestStatus } from '../common/enums';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity('join_requests')
export class JoinRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  student: User;

  @Column()
  studentId: string;

  @ManyToOne(() => Group, { eager: true })
  group: Group;

  @Column()
  groupId: string;

  @Column({ type: 'varchar', default: JoinRequestStatus.PENDING })
  status: JoinRequestStatus;

  @Column({ type: 'varchar', nullable: true  })
  reviewedById: string | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
