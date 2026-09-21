import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import {
  GroupGender,
  GroupStatus,
  InfractionAction,
  InfractionType,
  UserRole,
  UserStatus,
} from '../common/enums';
import { User } from '../entities/user.entity';
import { Group } from '../entities/group.entity';
import { InfractionPolicy } from '../entities/infraction-policy.entity';
import { ProgramContent } from '../entities/program-content.entity';
import { ReportDeadlineConfig } from '../entities/report-deadline-config.entity';
import { StudentQuota } from '../entities/student-quota.entity';
import { GroupMembership } from '../entities/group-membership.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(InfractionPolicy)
    private readonly policies: Repository<InfractionPolicy>,
    @InjectRepository(ProgramContent)
    private readonly content: Repository<ProgramContent>,
    @InjectRepository(ReportDeadlineConfig)
    private readonly deadlines: Repository<ReportDeadlineConfig>,
    @InjectRepository(StudentQuota)
    private readonly quotas: Repository<StudentQuota>,
    @InjectRepository(GroupMembership)
    private readonly memberships: Repository<GroupMembership>,
  ) {}

  async onModuleInit() {
    const count = await this.users.count();
    if (count > 0) {
      this.logger.log('قاعدة البيانات تحتوي بيانات — تخطي البذر');
      return;
    }
    this.logger.log('بذر بيانات التطوير…');
    const passwordHash = await bcrypt.hash('password123', 10);

    const supervisor = await this.users.save(
      this.users.create({
        firstName: 'أحمد',
        lastName: 'المشرف',
        phone: '0500000001',
        email: 'supervisor@ertaki.local',
        passwordHash,
        role: UserRole.SUPERVISOR,
        status: UserStatus.ACTIVE,
        city: 'الجزائر',
      }),
    );

    const teacher = await this.users.save(
      this.users.create({
        firstName: 'يوسف',
        lastName: 'المعلم',
        phone: '0500000002',
        email: 'teacher@ertaki.local',
        passwordHash,
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
        city: 'الجزائر',
      }),
    );

    const student = await this.users.save(
      this.users.create({
        firstName: 'محمد',
        lastName: 'الطالب',
        phone: '0500000003',
        email: 'student@ertaki.local',
        passwordHash,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        gender: 'male',
        city: 'وهران',
        currentMemorization: 'الجزء 1',
        memorizationLevel: 'متوسط',
      }),
    );

    const peer = await this.users.save(
      this.users.create({
        firstName: 'علي',
        lastName: 'زميل',
        phone: '0500000004',
        passwordHash,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        gender: 'male',
        city: 'وهران',
      }),
    );

    const group = await this.groups.save(
      this.groups.create({
        name: 'مجموعة الفجر — رجال',
        teacher,
        teacherId: teacher.id,
        gender: GroupGender.MEN,
        seatCount: 20,
        currentStudentCount: 2,
        weeklySessionDay: 'السبت',
        weeklySessionTime: '20:00',
        status: GroupStatus.OPEN,
        whatsappUrl: 'https://chat.whatsapp.com/example-ertaki',
        description: 'مجموعة حفظ ومراجعة للمبتدئين',
      }),
    );

    await this.memberships.save([
      this.memberships.create({
        userId: student.id,
        groupId: group.id,
        joinedAt: new Date(),
        leftAt: null,
      }),
      this.memberships.create({
        userId: peer.id,
        groupId: group.id,
        joinedAt: new Date(),
        leftAt: null,
      }),
    ]);

    await this.quotas.save(
      this.quotas.create({
        studentId: student.id,
        dailyQuotaDescription: 'صفحة واحدة من سورة البقرة',
        requiredRepetitions: 50,
        setById: teacher.id,
      }),
    );

    // Empty policy table by default — admin configures consequences.
    // Seed one disabled example so the admin UI has a template row shape.
    await this.policies.save(
      this.policies.create({
        infractionType: InfractionType.MISSED_QUOTA,
        thresholdCount: 3,
        action: InfractionAction.WARN,
        actionLabel: 'تنبيه بعد 3 مرات عدم حفظ القسط (مثال — يمكن تعديله)',
        enabled: false,
      }),
    );

    await this.content.save([
      this.content.create({
        key: 'intro',
        title: 'تعريف برنامج ارتق',
        body: 'برنامج ارتق لمتابعة حفظ القرآن الكريم والالتزام اليومي بالحفظ والمراجعة.',
        videoUrl: 'https://example.com/ertaki-intro',
      }),
      this.content.create({
        key: 'rules',
        title: 'شروط وقواعد البرنامج',
        body: 'الالتزام بالتقرير اليومي، حضور مجلس التسميع، وإتمام القسط والتكرار حسب توجيه المعلم.',
        videoUrl: null,
      }),
    ]);

    await this.deadlines.save(
      this.deadlines.create({
        enabled: false,
        timezone: 'Africa/Algiers',
        closeTimeLocal: '23:59',
        notes: 'معطّل في MVP — جاهز للتفعيل لاحقاً من لوحة المشرف',
      }),
    );

    this.logger.log(
      `بذور جاهزة — مشرف ${supervisor.phone} / معلم ${teacher.phone} / طالب ${student.phone} — كلمة المرور: password123`,
    );
  }
}
