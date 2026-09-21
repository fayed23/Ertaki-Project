import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity('group_memberships')
export class GroupMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Group, { eager: true })
  group: Group;

  @Column()
  groupId: string;

  @Column({ type: 'datetime' })
  joinedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  leftAt: Date | null;

  @Column({ type: 'varchar', nullable: true  })
  leaveReason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
