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
import { UserRole, UserStatus } from '../common/enums';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async registerStudent(input: {
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
    email?: string;
    gender?: string;
    birthDate?: string;
    city?: string;
    currentMemorization?: string;
    memorizationLevel?: string;
    previousErtakiParticipant?: boolean;
  }) {
    const existing = await this.users.findOne({ where: { phone: input.phone } });
    if (existing) throw new ConflictException('رقم الهاتف مسجّل مسبقاً');
    if (!input.password || input.password.length < 6) {
      throw new BadRequestException('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }
    const user = this.users.create({
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email ?? null,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: UserRole.STUDENT,
      status: UserStatus.NEW,
      gender: input.gender ?? null,
      birthDate: input.birthDate ?? null,
      city: input.city ?? null,
      currentMemorization: input.currentMemorization ?? null,
      memorizationLevel: input.memorizationLevel ?? null,
      previousErtakiParticipant: !!input.previousErtakiParticipant,
    });
    const saved = await this.users.save(user);
    return this.tokenResponse(saved);
  }

  async login(phone: string, password: string) {
    const user = await this.users.findOne({ where: { phone } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    if (!user.isActive) throw new UnauthorizedException('الحساب معطّل');
    return this.tokenResponse(user);
  }

  private tokenResponse(user: User) {
    const accessToken = this.jwt.sign({ sub: user.id, role: user.role });
    const { passwordHash: _, ...safe } = user;
    return { accessToken, user: safe };
  }
}
