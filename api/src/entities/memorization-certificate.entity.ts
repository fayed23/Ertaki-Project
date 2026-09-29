import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { timestampColumnType } from '../common/column-types';

@Entity('memorization_certificates')
@Unique(['studentId', 'cycleNumber'])
export class MemorizationCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studentId: string;

  @Column({ type: 'int' })
  cycleNumber: number;

  @Column()
  title: string;

  @Column()
  serialCode: string;

  @Column()
  issuedById: string;

  @Column({ type: 'varchar', nullable: true })
  assessmentId: string | null;

  @Column({ type: timestampColumnType })
  issuedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
