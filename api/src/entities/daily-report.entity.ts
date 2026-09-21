import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('daily_reports')
@Unique(['studentId', 'reportDate'])
export class DailyReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  student: User;

  @Column()
  studentId: string;

  @Column({ type: 'date' })
  reportDate: string;

  @Column({ default: false })
  memorizedQuota: boolean;

  @Column({ type: 'varchar', nullable: true  })
  memorizationFrom: string | null;

  @Column({ type: 'varchar', nullable: true  })
  memorizationTo: string | null;

  @Column({ type: 'varchar', nullable: true  })
  reviewPortion: string | null;

  @Column({ type: 'varchar', nullable: true  })
  reviewFrom: string | null;

  @Column({ type: 'varchar', nullable: true  })
  reviewTo: string | null;

  @Column({ default: false })
  completedFiftyRepetitions: boolean;

  @Column({ default: false })
  repeatedInOneSitting: boolean;

  @Column({ default: false })
  readTafsir: boolean;

  @Column({ type: 'datetime' })
  submittedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
