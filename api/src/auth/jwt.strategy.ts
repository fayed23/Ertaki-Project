import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

export type JwtPayload = { sub: string; role: string };

function jwtSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    return 'missing-jwt-secret';
  }
  return 'ertaki-dev-secret-change-me';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<User | null> {
    return this.users.findOne({ where: { id: payload.sub } });
  }
}
