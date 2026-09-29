import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  MemorizationAchievementType,
  MemorizationAssessmentStatus,
  MemorizationPace,
  MemorizationPlanChangeKind,
  UserRole,
} from '../common/enums';
import { User } from '../entities/user.entity';
import { MemorizationPlan } from '../entities/memorization-plan.entity';
import { MemorizationProgress } from '../entities/memorization-progress.entity';
import { DomainContext } from './domain-context';

const CYCLE_HIZB_TARGET = 10;

@Injectable()
export class MemorizationService {
  constructor(private readonly ctx: DomainContext) {}

  private paceLabel(pace: MemorizationPace): string {
    return pace === MemorizationPace.ONE_PAGE ? 'صفحة يومياً' : 'نصف صفحة يومياً';
  }

  private planSnapshot(plan: MemorizationPlan) {
    return {
      startSurahNumber: plan.startSurahNumber,
      startSurahName: plan.startSurahName,
      startAyah: plan.startAyah,
      pace: plan.pace,
      groupId: plan.groupId,
      studentMayEdit: plan.studentMayEdit,
    };
  }

  private progressSnapshot(progress: MemorizationProgress) {
    return {
      id: progress.id,
      planId: progress.planId,
      currentSurahNumber: progress.currentSurahNumber,
      currentSurahName: progress.currentSurahName,
      currentAyah: progress.currentAyah,
      cycleNumber: progress.cycleNumber,
      hizbsInCycle: progress.hizbsInCycle,
      startedAt: progress.startedAt,
    };
  }

  private resolveStudentId(actor: User, studentId?: string): string {
    if (actor.role === UserRole.STUDENT) {
      if (studentId && studentId !== actor.id) {
        throw new ForbiddenException();
      }
      return actor.id;
    }
    if (!studentId) {
      throw new BadRequestException('معرّف الطالب مطلوب');
    }
    return studentId;
  }

  private async assertCanView(actor: User, studentId: string) {
    if (actor.role === UserRole.STUDENT) {
      if (actor.id !== studentId) throw new ForbiddenException();
      return;
    }
    if (this.ctx.isSupervisor(actor)) return;
    this.ctx.requireTeacher(actor);
    const membership = await this.ctx.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
      relations: ['group'],
    });
    if (!membership?.group || membership.group.teacherId !== actor.id) {
      throw new ForbiddenException('لا صلاحية على ملف هذا الطالب');
    }
  }

  private async assertCanEditPlan(actor: User, studentId: string, plan?: MemorizationPlan | null) {
    await this.assertCanView(actor, studentId);
    if (actor.role === UserRole.STUDENT) {
      if (plan && plan.studentMayEdit === false) {
        throw new ForbiddenException('تعديل الخطة غير مفعّل للطالب');
      }
      return;
    }
    if (this.ctx.isSupervisor(actor) || actor.role === UserRole.TEACHER) return;
    throw new ForbiddenException();
  }

  private assertCanReset(actor: User) {
    if (!this.ctx.isSupervisor(actor)) {
      throw new ForbiddenException(
        'إعادة ضبط التقدم للمشرف/الإدارة فقط (المعلم غير مفعّل حالياً)',
      );
    }
  }

  private validateStartPoint(surahNumber: number, ayah: number) {
    const map = this.ctx.loadQalunSurahCounts();
    const surah = map.get(Number(surahNumber));
    if (!surah) {
      throw new BadRequestException('رقم السورة غير صالح حسب قالون');
    }
    const a = Number(ayah);
    if (!Number.isInteger(a) || a < 1 || a > surah.ayahCount) {
      throw new BadRequestException(
        `الآية غير صالحة لسورة ${surah.nameAr} (1–${surah.ayahCount})`,
      );
    }
    return { surahNumber: Number(surahNumber), surahName: surah.nameAr, ayah: a };
  }

  private validatePace(pace?: string): MemorizationPace {
    if (
      pace !== MemorizationPace.HALF_PAGE &&
      pace !== MemorizationPace.ONE_PAGE
    ) {
      throw new BadRequestException('الوتيرة يجب أن تكون نصف صفحة أو صفحة');
    }
    return pace;
  }

  async getSnapshot(actor: User, studentId?: string) {
    const id = this.resolveStudentId(actor, studentId);
    await this.assertCanView(actor, id);

    const [plan, progress, hizbs, achievements, assessments, certificates, planChanges, resets, history] =
      await Promise.all([
        this.ctx.memorizationPlans.findOne({ where: { studentId: id } }),
        this.ctx.memorizationProgress.findOne({ where: { studentId: id } }),
        this.ctx.memorizationHizbCompletions.find({
          where: { studentId: id },
          order: { cycleNumber: 'ASC', hizbNumber: 'ASC' },
        }),
        this.ctx.memorizationAchievements.find({
          where: { studentId: id },
          order: { earnedAt: 'DESC' },
        }),
        this.ctx.memorizationAssessments.find({
          where: { studentId: id },
          order: { cycleNumber: 'DESC', createdAt: 'DESC' },
        }),
        this.ctx.memorizationCertificates.find({
          where: { studentId: id },
          order: { cycleNumber: 'DESC' },
        }),
        this.ctx.memorizationPlanChanges.find({
          where: { studentId: id },
          order: { createdAt: 'DESC' },
          take: 50,
        }),
        this.ctx.memorizationResets.find({
          where: { studentId: id },
          order: { createdAt: 'DESC' },
          take: 50,
        }),
        this.ctx.memorizationProgressHistory.find({
          where: { studentId: id },
          order: { archivedAt: 'DESC' },
          take: 50,
        }),
      ]);

    const cycleNumber = progress?.cycleNumber ?? 1;
    const cycleHizbs = hizbs.filter((h) => h.cycleNumber === cycleNumber);
    const cycleCompleted = cycleHizbs.length;
    const membership = await this.ctx.memberships.findOne({
      where: { userId: id, leftAt: IsNull() },
    });

    return {
      needsSetup: !plan || !progress,
      hasMembership: !!membership,
      plan: plan
        ? {
            ...this.planSnapshot(plan),
            id: plan.id,
            studentId: plan.studentId,
            setById: plan.setById,
            paceLabel: this.paceLabel(plan.pace),
            updatedAt: plan.updatedAt,
            createdAt: plan.createdAt,
          }
        : null,
      progress: progress
        ? {
            ...this.progressSnapshot(progress),
            studentId: progress.studentId,
            updatedAt: progress.updatedAt,
          }
        : null,
      cycle: {
        number: cycleNumber,
        targetHizbs: CYCLE_HIZB_TARGET,
        completedHizbs: cycleCompleted,
        percent: Math.min(
          100,
          Math.round((cycleCompleted / CYCLE_HIZB_TARGET) * 100),
        ),
        readyForAssessment: cycleCompleted >= CYCLE_HIZB_TARGET,
        hizbNumbers: cycleHizbs.map((h) => h.hizbNumber),
      },
      hizbCompletions: hizbs,
      achievements,
      assessments,
      certificates,
      planChanges,
      resets,
      progressHistory: history,
      permissions: {
        canEditPlan:
          actor.role !== UserRole.STUDENT ||
          (plan?.studentMayEdit ?? true),
        canReset: this.ctx.isSupervisor(actor),
        canRecordHizb:
          actor.role === UserRole.STUDENT ||
          actor.role === UserRole.TEACHER ||
          this.ctx.isSupervisor(actor),
        canManageAssessments:
          actor.role === UserRole.TEACHER || this.ctx.isSupervisor(actor),
      },
    };
  }

  async setup(
    actor: User,
    input: {
      studentId?: string;
      startSurahNumber: number;
      startAyah: number;
      pace: string;
      confirmNew?: boolean;
      confirmSequential?: boolean;
      reason?: string;
    },
  ) {
    const studentId = this.resolveStudentId(actor, input.studentId);
    await this.assertCanEditPlan(actor, studentId, null);

    if (input.confirmNew !== true || input.confirmSequential !== true) {
      throw new BadRequestException(
        'يجب تأكيد أن البداية جديدة ومتسلسلة (confirmNew + confirmSequential)',
      );
    }

    const existing = await this.ctx.memorizationPlans.findOne({
      where: { studentId },
    });
    if (existing) {
      throw new BadRequestException('خطة الحفظ موجودة مسبقاً — استخدم تعديل الخطة');
    }

    const start = this.validateStartPoint(
      input.startSurahNumber,
      input.startAyah,
    );
    const pace = this.validatePace(input.pace);
    const membership = await this.ctx.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
    });

    const plan = await this.ctx.memorizationPlans.save(
      this.ctx.memorizationPlans.create({
        studentId,
        groupId: membership?.groupId ?? null,
        startSurahNumber: start.surahNumber,
        startSurahName: start.surahName,
        startAyah: start.ayah,
        pace,
        setById: actor.id,
        studentMayEdit: true,
      }),
    );

    const now = new Date();
    const progress = await this.ctx.memorizationProgress.save(
      this.ctx.memorizationProgress.create({
        studentId,
        planId: plan.id,
        currentSurahNumber: start.surahNumber,
        currentSurahName: start.surahName,
        currentAyah: start.ayah,
        cycleNumber: 1,
        hizbsInCycle: 0,
        startedAt: now,
      }),
    );

    await this.ctx.memorizationPlanChanges.save(
      this.ctx.memorizationPlanChanges.create({
        studentId,
        planId: plan.id,
        changeKind: MemorizationPlanChangeKind.SETUP,
        previousJson: null,
        newJson: this.planSnapshot(plan),
        changedById: actor.id,
        reason: (input.reason || 'إعداد أولي بعد الانضمام').trim(),
      }),
    );

    await this.ctx.auditLog(
      actor.id,
      'memorization.setup',
      'memorization_plan',
      plan.id,
      null,
      { plan: this.planSnapshot(plan), progressId: progress.id },
    );

    await this.ctx.users.update(studentId, {
      currentMemorization: `${start.surahName} ${start.ayah}`,
    });

    if (actor.role === UserRole.STUDENT) {
      await this.ctx.notifyTeacherAboutStudent(
        studentId,
        'memorization_setup',
        'إعداد خطة الحفظ',
        `حدّد الطالب نقطة البداية: ${start.surahName} آية ${start.ayah} · ${this.paceLabel(pace)}`,
        { studentId, planId: plan.id },
      );
    }

    return this.getSnapshot(actor, studentId);
  }

  async editPlan(
    actor: User,
    input: {
      studentId?: string;
      startSurahNumber?: number;
      startAyah?: number;
      pace?: string;
      reason: string;
      confirmMode?: 'plan_only' | 'plan_and_reset';
    },
  ) {
    const studentId = this.resolveStudentId(actor, input.studentId);
    const plan = await this.ctx.memorizationPlans.findOne({
      where: { studentId },
    });
    if (!plan) throw new NotFoundException('لا توجد خطة حفظ — أكمل الإعداد أولاً');
    await this.assertCanEditPlan(actor, studentId, plan);

    const reason = (input.reason || '').trim();
    if (!reason) throw new BadRequestException('سبب التعديل مطلوب');

    const previous = this.planSnapshot(plan);
    const changingStart =
      input.startSurahNumber !== undefined || input.startAyah !== undefined;
    const changingPace = input.pace !== undefined;

    if (!changingStart && !changingPace) {
      throw new BadRequestException('لا تغييرات في الخطة');
    }

    let changeKind = MemorizationPlanChangeKind.FULL;
    if (changingStart && !changingPace) {
      changeKind = MemorizationPlanChangeKind.STARTING_POINT;
    } else if (changingPace && !changingStart) {
      changeKind = MemorizationPlanChangeKind.PACE;
    }

    const progress = await this.ctx.memorizationProgress.findOne({
      where: { studentId },
    });
    const hizbCount = await this.ctx.memorizationHizbCompletions.count({
      where: { studentId },
    });
    const hasActivity =
      hizbCount > 0 ||
      (progress != null &&
        (progress.currentSurahNumber !== plan.startSurahNumber ||
          progress.currentAyah !== plan.startAyah));

    if (changingStart && hasActivity) {
      if (
        input.confirmMode !== 'plan_only' &&
        input.confirmMode !== 'plan_and_reset'
      ) {
        throw new BadRequestException({
          message:
            'تغيير نقطة البداية بعد وجود تقدّم يتطلب الاختيار: plan_only أو plan_and_reset',
          code: 'START_CHANGE_REQUIRES_CONFIRM',
          options: {
            plan_only: 'تعديل الخطة فقط دون مسح التقدّم',
            plan_and_reset: 'تعديل الخطة وإعادة ضبط التقدّم النشط',
          },
        });
      }
      if (input.confirmMode === 'plan_and_reset') {
        this.assertCanReset(actor);
      }
    }

    if (changingStart) {
      const start = this.validateStartPoint(
        input.startSurahNumber ?? plan.startSurahNumber,
        input.startAyah ?? plan.startAyah,
      );
      plan.startSurahNumber = start.surahNumber;
      plan.startSurahName = start.surahName;
      plan.startAyah = start.ayah;
    }
    if (changingPace) {
      plan.pace = this.validatePace(input.pace);
    }
    plan.setById = actor.id;
    await this.ctx.memorizationPlans.save(plan);

    await this.ctx.memorizationPlanChanges.save(
      this.ctx.memorizationPlanChanges.create({
        studentId,
        planId: plan.id,
        changeKind,
        previousJson: previous,
        newJson: this.planSnapshot(plan),
        changedById: actor.id,
        reason,
      }),
    );

    await this.ctx.auditLog(
      actor.id,
      'memorization.plan_edit',
      'memorization_plan',
      plan.id,
      previous,
      {
        ...this.planSnapshot(plan),
        reason,
        confirmMode: input.confirmMode ?? null,
        changeKind,
      },
    );

    if (
      changingStart &&
      hasActivity &&
      input.confirmMode === 'plan_and_reset'
    ) {
      await this.resetProgress(actor, {
        studentId,
        reason: `إعادة ضبط مع تعديل نقطة البداية: ${reason}`,
        confirm: true,
      });
    }

    if (changingPace && !changingStart) {
      // Pace-only never resets completions or active progress.
    }

    await this.ctx.users.update(studentId, {
      currentMemorization: `${plan.startSurahName} ${plan.startAyah}`,
    });

    await this.ctx.notify(
      studentId,
      'memorization_plan_updated',
      'تم تحديث خطة الحفظ',
      changingPace && !changingStart
        ? `الوتيرة الجديدة: ${this.paceLabel(plan.pace)}`
        : `نقطة البداية: ${plan.startSurahName} آية ${plan.startAyah}`,
      { studentId, planId: plan.id },
    );

    return this.getSnapshot(actor, studentId);
  }

  async resetProgress(
    actor: User,
    input: { studentId: string; reason: string; confirm?: boolean },
  ) {
    this.assertCanReset(actor);
    if (input.confirm !== true) {
      throw new BadRequestException(
        'إعادة الضبط إجراء هدّام — أرسل confirm: true مع السبب',
      );
    }
    const reason = (input.reason || '').trim();
    if (!reason) throw new BadRequestException('سبب إعادة الضبط مطلوب');

    const studentId = input.studentId;
    await this.assertCanView(actor, studentId);

    const plan = await this.ctx.memorizationPlans.findOne({
      where: { studentId },
    });
    if (!plan) throw new NotFoundException('لا توجد خطة حفظ');

    const progress = await this.ctx.memorizationProgress.findOne({
      where: { studentId },
    });
    if (!progress) throw new NotFoundException('لا يوجد تقدّم نشط');

    const previous = this.progressSnapshot(progress);
    const reset = await this.ctx.memorizationResets.save(
      this.ctx.memorizationResets.create({
        studentId,
        previousProgressJson: previous,
        historyId: null,
        newProgressId: null,
        resetById: actor.id,
        reason,
      }),
    );

    const history = await this.ctx.memorizationProgressHistory.save(
      this.ctx.memorizationProgressHistory.create({
        studentId,
        resetId: reset.id,
        snapshotJson: previous,
        archivedById: actor.id,
        reason,
        archivedAt: new Date(),
      }),
    );

    await this.ctx.memorizationProgress.remove(progress);

    const now = new Date();
    const fresh = await this.ctx.memorizationProgress.save(
      this.ctx.memorizationProgress.create({
        studentId,
        planId: plan.id,
        currentSurahNumber: plan.startSurahNumber,
        currentSurahName: plan.startSurahName,
        currentAyah: plan.startAyah,
        cycleNumber: previous.cycleNumber as number,
        hizbsInCycle: 0,
        startedAt: now,
      }),
    );

    reset.historyId = history.id;
    reset.newProgressId = fresh.id;
    await this.ctx.memorizationResets.save(reset);

    await this.ctx.auditLog(
      actor.id,
      'memorization.reset',
      'memorization_progress',
      fresh.id,
      previous,
      {
        newProgressId: fresh.id,
        historyId: history.id,
        resetId: reset.id,
        reason,
        achievementsPreserved: true,
        hizbCompletionsPreserved: true,
      },
    );

    await this.ctx.notify(
      studentId,
      'memorization_reset',
      'تمت إعادة ضبط تقدّم الحفظ',
      'أُرشِف التقدّم السابق وأُعيدت نقطة البداية وفق الخطة. الأوسمة والإنجازات محفوظة.',
      { studentId, resetId: reset.id },
    );

    return this.getSnapshot(actor, studentId);
  }

  async completeHizb(
    actor: User,
    input: { studentId?: string; hizbNumber: number },
  ) {
    const studentId = this.resolveStudentId(actor, input.studentId);
    await this.assertCanView(actor, studentId);
    if (
      actor.role !== UserRole.STUDENT &&
      actor.role !== UserRole.TEACHER &&
      !this.ctx.isSupervisor(actor)
    ) {
      throw new ForbiddenException();
    }

    const hizbNumber = Number(input.hizbNumber);
    if (!Number.isInteger(hizbNumber) || hizbNumber < 1 || hizbNumber > 60) {
      throw new BadRequestException('رقم الحزب يجب أن يكون بين 1 و 60');
    }

    const progress = await this.ctx.memorizationProgress.findOne({
      where: { studentId },
    });
    if (!progress) {
      throw new BadRequestException('أكمل إعداد خطة الحفظ أولاً');
    }

    const existing = await this.ctx.memorizationHizbCompletions.findOne({
      where: {
        studentId,
        hizbNumber,
        cycleNumber: progress.cycleNumber,
      },
    });
    if (existing) {
      throw new BadRequestException('هذا الحزب مُسجَّل مسبقاً في الدورة الحالية');
    }

    const now = new Date();
    const row = await this.ctx.memorizationHizbCompletions.save(
      this.ctx.memorizationHizbCompletions.create({
        studentId,
        hizbNumber,
        cycleNumber: progress.cycleNumber,
        recordedById: actor.id,
        completedAt: now,
      }),
    );

    const count = await this.ctx.memorizationHizbCompletions.count({
      where: { studentId, cycleNumber: progress.cycleNumber },
    });
    progress.hizbsInCycle = count;
    await this.ctx.memorizationProgress.save(progress);

    await this.ctx.memorizationAchievements.save(
      this.ctx.memorizationAchievements.create({
        studentId,
        type: MemorizationAchievementType.HIZB_MEDAL,
        title: `وسام الحزب ${hizbNumber}`,
        hizbNumber,
        cycleNumber: progress.cycleNumber,
        certificateId: null,
        earnedAt: now,
      }),
    );

    if (count >= CYCLE_HIZB_TARGET) {
      const open = await this.ctx.memorizationAssessments.findOne({
        where: {
          studentId,
          cycleNumber: progress.cycleNumber,
          status: MemorizationAssessmentStatus.PENDING,
        },
      });
      if (!open) {
        await this.ctx.memorizationAssessments.save(
          this.ctx.memorizationAssessments.create({
            studentId,
            cycleNumber: progress.cycleNumber,
            status: MemorizationAssessmentStatus.PENDING,
            assessedById: null,
            notes: null,
            scheduledAt: null,
            completedAt: null,
          }),
        );
      }
    }

    await this.ctx.auditLog(
      actor.id,
      'memorization.hizb_complete',
      'memorization_hizb_completion',
      row.id,
      null,
      { studentId, hizbNumber, cycleNumber: progress.cycleNumber },
    );

    return this.getSnapshot(actor, studentId);
  }

  async upsertAssessment(
    actor: User,
    input: {
      studentId: string;
      cycleNumber?: number;
      status?: MemorizationAssessmentStatus | string;
      notes?: string;
      scheduledAt?: string;
      assessmentId?: string;
    },
  ) {
    if (actor.role !== UserRole.TEACHER && !this.ctx.isSupervisor(actor)) {
      throw new ForbiddenException();
    }
    await this.assertCanView(actor, input.studentId);

    let row = input.assessmentId
      ? await this.ctx.memorizationAssessments.findOne({
          where: { id: input.assessmentId },
        })
      : null;

    const progress = await this.ctx.memorizationProgress.findOne({
      where: { studentId: input.studentId },
    });
    const cycleNumber =
      input.cycleNumber ?? progress?.cycleNumber ?? row?.cycleNumber;
    if (!cycleNumber) {
      throw new BadRequestException('رقم الدورة مطلوب');
    }

    if (!row) {
      row = this.ctx.memorizationAssessments.create({
        studentId: input.studentId,
        cycleNumber,
        status: MemorizationAssessmentStatus.PENDING,
        assessedById: null,
        notes: null,
        scheduledAt: null,
        completedAt: null,
      });
    }

    const before = {
      status: row.status,
      notes: row.notes,
      scheduledAt: row.scheduledAt,
    };

    if (input.status) {
      if (
        !Object.values(MemorizationAssessmentStatus).includes(
          input.status as MemorizationAssessmentStatus,
        )
      ) {
        throw new BadRequestException('حالة التقييم غير صالحة');
      }
      row.status = input.status as MemorizationAssessmentStatus;
    }
    if (input.notes !== undefined) row.notes = input.notes?.trim() || null;
    if (input.scheduledAt) {
      const d = new Date(input.scheduledAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('موعد التقييم غير صالح');
      }
      row.scheduledAt = d;
      if (row.status === MemorizationAssessmentStatus.PENDING) {
        row.status = MemorizationAssessmentStatus.SCHEDULED;
      }
    }
    if (
      [
        MemorizationAssessmentStatus.PASSED,
        MemorizationAssessmentStatus.FAILED,
      ].includes(row.status)
    ) {
      row.completedAt = new Date();
      row.assessedById = actor.id;
    }

    const saved = await this.ctx.memorizationAssessments.save(row);
    await this.ctx.auditLog(
      actor.id,
      'memorization.assessment_upsert',
      'memorization_assessment',
      saved.id,
      before,
      {
        status: saved.status,
        notes: saved.notes,
        cycleNumber: saved.cycleNumber,
      },
    );

    if (saved.status === MemorizationAssessmentStatus.PASSED) {
      await this.issueCertificate(actor, {
        studentId: input.studentId,
        cycleNumber: saved.cycleNumber,
        assessmentId: saved.id,
      });
    }

    return this.getSnapshot(actor, input.studentId);
  }

  async issueCertificate(
    actor: User,
    input: {
      studentId: string;
      cycleNumber: number;
      assessmentId?: string;
      title?: string;
    },
  ) {
    if (actor.role !== UserRole.TEACHER && !this.ctx.isSupervisor(actor)) {
      throw new ForbiddenException();
    }
    await this.assertCanView(actor, input.studentId);

    const existing = await this.ctx.memorizationCertificates.findOne({
      where: {
        studentId: input.studentId,
        cycleNumber: input.cycleNumber,
      },
    });
    if (existing) {
      return this.getSnapshot(actor, input.studentId);
    }

    const now = new Date();
    const serial = `ERT-C${input.cycleNumber}-${input.studentId.slice(0, 8).toUpperCase()}-${now.getTime().toString(36).toUpperCase()}`;
    const cert = await this.ctx.memorizationCertificates.save(
      this.ctx.memorizationCertificates.create({
        studentId: input.studentId,
        cycleNumber: input.cycleNumber,
        title:
          input.title?.trim() ||
          `شهادة إتمام دورة ${input.cycleNumber} (10 أحزاب)`,
        serialCode: serial,
        issuedById: actor.id,
        assessmentId: input.assessmentId ?? null,
        issuedAt: now,
      }),
    );

    await this.ctx.memorizationAchievements.save(
      this.ctx.memorizationAchievements.create({
        studentId: input.studentId,
        type: MemorizationAchievementType.CERTIFICATE,
        title: cert.title,
        hizbNumber: null,
        cycleNumber: input.cycleNumber,
        certificateId: cert.id,
        earnedAt: now,
      }),
    );

    await this.ctx.memorizationAchievements.save(
      this.ctx.memorizationAchievements.create({
        studentId: input.studentId,
        type: MemorizationAchievementType.CYCLE_COMPLETE,
        title: `إتمام دورة الأحزاب ${input.cycleNumber}`,
        hizbNumber: null,
        cycleNumber: input.cycleNumber,
        certificateId: cert.id,
        earnedAt: now,
      }),
    );

    const progress = await this.ctx.memorizationProgress.findOne({
      where: { studentId: input.studentId },
    });
    if (progress && progress.cycleNumber === input.cycleNumber) {
      progress.cycleNumber = input.cycleNumber + 1;
      progress.hizbsInCycle = 0;
      await this.ctx.memorizationProgress.save(progress);
    }

    await this.ctx.auditLog(
      actor.id,
      'memorization.certificate_issue',
      'memorization_certificate',
      cert.id,
      null,
      {
        studentId: input.studentId,
        cycleNumber: input.cycleNumber,
        serialCode: serial,
      },
    );

    await this.ctx.notify(
      input.studentId,
      'memorization_certificate',
      'مبروك — شهادة دورة حفظ',
      cert.title,
      { studentId: input.studentId, certificateId: cert.id },
    );

    return this.getSnapshot(actor, input.studentId);
  }
}
