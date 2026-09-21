import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GroupGender, GroupStatus } from '../common/enums';
import { User } from './user.entity';

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => User, { eager: true })
  teacher: User;

  @Column()
  teacherId: string;

  @Column({ type: 'varchar' })
  gender: GroupGender;

  @Column({ type: 'int' })
  seatCount: number;

  @Column({ type: 'int', default: 0 })
  currentStudentCount: number;

  @Column()
  weeklySessionDay: string;

  @Column()
  weeklySessionTime: string;

  @Column({ type: 'varchar', default: GroupStatus.OPEN })
  status: GroupStatus;

  @Column({ type: 'varchar', nullable: true  })
  whatsappUrl: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
