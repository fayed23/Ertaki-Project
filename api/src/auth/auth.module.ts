import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { DomainModule } from '../domain/domain.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

function jwtSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    return '';
  }
  return 'ertaki-dev-secret-change-me';
}

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    DomainModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: jwtSecret(),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
