import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InfractionType, UserRole, InfractionAction } from '../common/enums';
import { User } from '../entities/user.entity';
import { DomainContext } from './domain-context';

@Injectable()
export class PoliciesService {
  constructor(private readonly ctx: DomainContext) {}

  listInfractions(actor: User, studentId?: string) {
    if (actor.role === UserRole.STUDENT) {
      return this.ctx.infractions.find({
        where: { studentId: actor.id },
        order: { occurredOn: 'DESC' },
      });
    }
    this.ctx.requireStaff(actor);
    return this.ctx.infractions.find({
      where: studentId ? { studentId } : {},
      order: { occurredOn: 'DESC' },
      take: 300,
    });
  }

  listPolicies(actor: User) {
    this.ctx.requireSupervisor(actor);
    return this.ctx.policies.find({
      order: { infractionType: 'ASC', thresholdCount: 'ASC' },
    });
  }

  async upsertPolicy(
    actor: User,
    input: {
      id?: string;
      infractionType: InfractionType;
      thresholdCount: number;
      action: InfractionAction;
      actionLabel?: string;
      enabled?: boolean;
    },
  ) {
    this.ctx.requireSupervisor(actor);
    if (input.id) {
      const existing = await this.ctx.policies.findOne({
        where: { id: input.id },
      });
      if (!existing) throw new NotFoundException();
      const before = {
        infractionType: existing.infractionType,
        thresholdCount: existing.thresholdCount,
        action: existing.action,
        enabled: existing.enabled,
      };
      Object.assign(existing, {
        infractionType: input.infractionType,
        thresholdCount: input.thresholdCount,
        action: input.action,
        actionLabel: input.actionLabel ?? existing.actionLabel,
        enabled: input.enabled ?? existing.enabled,
      });
      const saved = await this.ctx.policies.save(existing);
      await this.ctx.auditLog(
        actor.id,
        'policy.upsert',
        'infraction_policy',
        saved.id,
        before,
        {
          infractionType: saved.infractionType,
          thresholdCount: saved.thresholdCount,
          action: saved.action,
          enabled: saved.enabled,
        },
      );
      return saved;
    }
    const created = await this.ctx.policies.save(
      this.ctx.policies.create({
        infractionType: input.infractionType,
        thresholdCount: input.thresholdCount,
        action: input.action,
        actionLabel: input.actionLabel ?? null,
        enabled: input.enabled ?? true,
      }),
    );
    await this.ctx.auditLog(
      actor.id,
      'policy.upsert',
      'infraction_policy',
      created.id,
      null,
      {
        infractionType: created.infractionType,
        thresholdCount: created.thresholdCount,
        action: created.action,
        enabled: created.enabled,
      },
    );
    return created;
  }

  async setQuota(
    actor: User,
    studentId: string,
    dailyQuotaDescription: string,
    requiredRepetitions = 50,
  ) {
    this.ctx.requireStaff(actor);
    let quota = await this.ctx.quotas.findOne({ where: { studentId } });
    if (!quota) {
      quota = this.ctx.quotas.create({
        studentId,
        dailyQuotaDescription,
        requiredRepetitions,
        setById: actor.id,
      });
    } else {
      quota.dailyQuotaDescription = dailyQuotaDescription;
      quota.requiredRepetitions = requiredRepetitions;
      quota.setById = actor.id;
    }
    const saved = await this.ctx.quotas.save(quota);
    await this.ctx.auditLog(
      actor.id,
      'quota.set',
      'student_quota',
      saved.id,
      null,
      {
        studentId,
        dailyQuotaDescription: saved.dailyQuotaDescription,
        requiredRepetitions: saved.requiredRepetitions,
      },
    );
    return saved;
  }

  getQuota(actor: User, studentId?: string) {
    const id =
      actor.role === UserRole.STUDENT ? actor.id : studentId || actor.id;
    if (
      actor.role === UserRole.STUDENT &&
      studentId &&
      studentId !== actor.id
    ) {
      throw new ForbiddenException();
    }
    return this.ctx.quotas.findOne({ where: { studentId: id } });
  }

  listProgramContent() {
    return this.ctx.content.find({ order: { key: 'ASC' } });
  }

  async upsertProgramContent(
    actor: User,
    input: { key: string; title: string; body: string; videoUrl?: string },
  ) {
    this.ctx.requireSupervisor(actor);
    let row = await this.ctx.content.findOne({ where: { key: input.key } });
    const before = row
      ? { title: row.title, body: row.body, videoUrl: row.videoUrl }
      : null;
    if (!row) {
      row = this.ctx.content.create(input);
    } else {
      Object.assign(row, {
        title: input.title,
        body: input.body,
        videoUrl: input.videoUrl ?? row.videoUrl,
      });
    }
    const saved = await this.ctx.content.save(row);
    await this.ctx.auditLog(
      actor.id,
      'program_content.upsert',
      'program_content',
      saved.id,
      before,
      { key: saved.key, title: saved.title },
    );
    return saved;
  }

  getDeadlineConfig() {
    return this.ctx.deadlines.find({ take: 1 });
  }

  async upsertDeadlineConfig(
    actor: User,
    input: {
      enabled: boolean;
      timezone: string;
      closeTimeLocal: string;
      reminderMinutesBefore?: number;
      notes?: string;
    },
  ) {
    this.ctx.requireSupervisor(actor);
    const rows = await this.ctx.deadlines.find({ take: 1 });
    let row = rows[0];
    if (!row) {
      row = this.ctx.deadlines.create({
        enabled: input.enabled,
        timezone: input.timezone,
        closeTimeLocal: input.closeTimeLocal,
        reminderMinutesBefore: input.reminderMinutesBefore ?? 60,
        notes: input.notes ?? null,
      });
    } else {
      Object.assign(row, {
        enabled: input.enabled,
        timezone: input.timezone,
        closeTimeLocal: input.closeTimeLocal,
        reminderMinutesBefore:
          input.reminderMinutesBefore ?? row.reminderMinutesBefore ?? 60,
        notes: input.notes ?? row.notes,
      });
    }
    // Reminders fire when enabled; missing-by-deadline auto-infractions stay off.
    const saved = await this.ctx.deadlines.save(row);
    await this.ctx.auditLog(
      actor.id,
      'deadline.upsert',
      'report_deadline_config',
      saved.id,
      null,
      {
        enabled: saved.enabled,
        timezone: saved.timezone,
        closeTimeLocal: saved.closeTimeLocal,
        reminderMinutesBefore: saved.reminderMinutesBefore,
      },
    );
    return saved;
  }
}
