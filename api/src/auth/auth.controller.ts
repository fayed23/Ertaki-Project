import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { User } from '../entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
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
    },
  ) {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body() body: { phone: string; password: string }) {
    return this.auth.login(body.phone, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}
