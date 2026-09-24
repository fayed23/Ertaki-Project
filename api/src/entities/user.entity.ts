import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, UserStatus } from '../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Exclude()
  @Column()
  passwordHash: string;

  @Column({ type: 'varchar' })
  role: UserRole;

  @Column({ type: 'varchar', default: UserStatus.NEW })
  status: UserStatus;

  @Column({ type: 'text', nullable: true })
  accountReviewNote: string | null;

  @Column({ type: 'varchar', nullable: true })
  gender: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'varchar', nullable: true  })
  city: string | null;

  @Column({ type: 'varchar', nullable: true  })
  currentMemorization: string | null;

  @Column({ type: 'varchar', nullable: true  })
  memorizationLevel: string | null;

  @Column({ default: false })
  previousErtakiParticipant: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
