import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  StudentRequestStatus,
  StudentRequestType,
} from '../common/enums';
import { timestampColumnType } from '../common/column-types';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity('student_requests')
@Index(['studentId', 'type', 'relevantDate'])
@Index(['status', 'createdAt'])
export class StudentRequest {
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

  @Column({ type: 'varchar', nullable: true })
  teacherId: string | null;

  @Column({ type: 'varchar' })
  type: StudentRequestType;

  @Column({ type: 'date' })
  relevantDate: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', nullable: true })
  attachmentPath: string | null;

  @Column({ type: 'varchar', nullable: true })
  attachmentOriginalName: string | null;

  @Column({ type: 'varchar', nullable: true })
  attachmentMime: string | null;

  @Column({ type: 'int', nullable: true })
  attachmentSize: number | null;

  @Column({ type: 'varchar', default: StudentRequestStatus.PENDING })
  status: StudentRequestStatus;

  @Column({ type: 'varchar', nullable: true })
  reviewerId: string | null;

  @Column({ type: 'text', nullable: true })
  reviewerNote: string | null;

  @Column({ type: timestampColumnType, nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
