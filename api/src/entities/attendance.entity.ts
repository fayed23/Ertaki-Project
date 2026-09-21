import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AttendanceStatus } from '../common/enums';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity('attendance')
@Unique(['studentId', 'groupId', 'sessionDate'])
export class Attendance {
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

  @Column({ type: 'varchar' })
  status: AttendanceStatus;

  @Column({ default: false })
  arrivedLate: boolean;

  @Column({ default: false })
  leftEarly: boolean;

  @Column()
  recordedById: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
