import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExcuseRequestStatus } from '../common/enums';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity('absence_excuse_requests')
export class AbsenceExcuseRequest {
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

  @Column({ type: 'date' })
  sessionDate: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', default: ExcuseRequestStatus.PENDING })
  status: ExcuseRequestStatus;

  @Column({ type: 'varchar', nullable: true  })
  reviewedById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
