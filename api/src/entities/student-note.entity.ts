import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NoteVisibility } from '../common/enums';
import { User } from './user.entity';

@Entity('student_notes')
export class StudentNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  student: User;

  @Column()
  studentId: string;

  @ManyToOne(() => User, { eager: true })
  author: User;

  @Column()
  authorId: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', default: NoteVisibility.INTERNAL })
  visibility: NoteVisibility;

  @Column({ type: 'date' })
  noteDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
