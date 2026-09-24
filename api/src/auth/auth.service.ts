import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { GroupGender, UserRole, UserStatus } from '../common/enums';
import { User } from '../entities/user.entity';
import { PushService } from '../domain/push.service';

function normalizeGender(raw?: string | null): GroupGender | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (['men', 'male', 'm', 'رجال', 'رجل'].includes(v)) return GroupGender.MEN;
  if (['women', 'female', 'f', 'نساء', 'امرأة', 'اناث', 'إناث'].includes(v)) {
    return GroupGender.WOMEN;
  }
  return null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly push: PushService,
  ) {}

  async register(input: {
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
    role?: string;
    email?: string;
    gender?: string;
    birthDate?: string;
    city?: string;
    currentMemorization?: string;
    memorizationLevel?: string;
    previousErtakiParticipant?: boolean;
  }) {
    if (
      input.role &&
      input.role !== UserRole.STUDENT &&
      input.role !== UserRole.TEACHER
    ) {
      throw new BadRequestException('التسجيل متاح للطالب والمعلم فقط');
    }
    const role =
      input.role === UserRole.TEACHER ? UserRole.TEACHER : UserRole.STUDENT;
    const existing = await this.users.findOne({ where: { phone: input.phone } });
    if (existing) throw new ConflictException('رقم الهاتف مسجّل مسبقاً');
    if (!input.password || input.password.length < 6) {
      throw new BadRequestException('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    if (role === UserRole.STUDENT) {
      const gender = normalizeGender(input.gender);
      if (!gender) {
        throw new BadRequestException('يجب اختيار الجنس (رجال / نساء)');
      }
      const user = this.users.create({
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email ?? null,
        passwordHash: await bcrypt.hash(input.password, 10),
        role,
        status: UserStatus.NEW,
        isActive: true,
        accountReviewNote: null,
        gender,
        birthDate: input.birthDate ?? null,
        city: input.city ?? null,
        currentMemorization: input.currentMemorization ?? null,
        memorizationLevel: input.memorizationLevel ?? null,
        previousErtakiParticipant: !!input.previousErtakiParticipant,
      });
      const saved = await this.users.save(user);
      return this.tokenResponse(saved, {
        needsGroup: true,
        message: 'تم إنشاء الحساب — اختر مجموعة للانضمام',
      });
    }

    const user = this.users.create({
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email ?? null,
      passwordHash: await bcrypt.hash(input.password, 10),
      role,
      status: UserStatus.PENDING_APPROVAL,
      isActive: false,
      accountReviewNote: null,
      gender: normalizeGender(input.gender),
      birthDate: input.birthDate ?? null,
      city: input.city ?? null,
      currentMemorization: input.currentMemorization ?? null,
      memorizationLevel: input.memorizationLevel ?? null,
      previousErtakiParticipant: !!input.previousErtakiParticipant,
    });
    const saved = await this.users.save(user);

    const supervisors = await this.users.find({
      where: [{ role: UserRole.SUPERVISOR }, { role: UserRole.ADMIN }],
    });
    for (const s of supervisors) {
      await this.push.notify(
        s.id,
        'account_pending_approval',
        'طلب تفعيل حساب معلم',
        `${saved.firstName} ${saved.lastName} (معلم) بانتظار موافقتك`,
        { userId: saved.id, role },
      );
    }

    const { passwordHash: _, ...safe } = saved;
    return {
      pendingApproval: true,
      message: 'تم إنشاء حساب المعلم وبانتظار موافقة المشرف',
      user: safe,
    };
  }

  async login(phone: string, password: string) {
    const user = await this.users.findOne({ where: { phone } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    if (
      user.role === UserRole.STUDENT &&
      user.status === UserStatus.PENDING_APPROVAL
    ) {
      user.status = UserStatus.NEW;
      user.isActive = true;
      await this.users.save(user);
    }
    if (user.status === UserStatus.PENDING_APPROVAL) {
      throw new UnauthorizedException(
        'حسابك بانتظار موافقة المشرف — لا يمكن الدخول بعد',
      );
    }
    if (user.status === UserStatus.REJECTED) {
      const note = user.accountReviewNote
        ? ` السبب: ${user.accountReviewNote}`
        : '';
      throw new UnauthorizedException(`تم رفض تفعيل الحساب.${note}`);
    }
    if (!user.isActive) {
      throw new UnauthorizedException('الحساب معطّل');
    }
    return this.tokenResponse(user);
  }

  private tokenResponse(
    user: User,
    extra?: Record<string, unknown>,
  ) {
    const accessToken = this.jwt.sign({ sub: user.id, role: user.role });
    const { passwordHash: _, ...safe } = user;
    return { accessToken, user: safe, ...(extra ?? {}) };
  }
}
