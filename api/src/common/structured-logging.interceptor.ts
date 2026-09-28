import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class StructuredLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      ip?: string;
      user?: { id?: string };
    }>();
    const started = Date.now();
    const method = req.method || 'UNKNOWN';
    const url = req.url || '';
    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<{ statusCode?: number }>();
          this.logger.log(
            JSON.stringify({
              level: 'info',
              msg: 'request',
              method,
              path: url,
              status: res.statusCode ?? 200,
              ms: Date.now() - started,
              userId: req.user?.id ?? null,
              ip: req.ip ?? null,
            }),
          );
        },
        error: (err: { status?: number; message?: string }) => {
          this.logger.warn(
            JSON.stringify({
              level: 'warn',
              msg: 'request_error',
              method,
              path: url,
              status: err?.status ?? 500,
              ms: Date.now() - started,
              error: err?.message ?? 'error',
              userId: req.user?.id ?? null,
            }),
          );
        },
      }),
    );
  }
}
