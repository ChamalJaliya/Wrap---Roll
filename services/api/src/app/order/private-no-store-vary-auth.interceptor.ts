import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

/**
 * Persona-varying JSON must not be cached in shared caches or reused across users.
 * Use on GET routes whose body depends on JWT role (e.g. queue projection).
 */
@Injectable()
export class PrivateNoStoreVaryAuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>();
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Vary', 'Authorization');
    return next.handle();
  }
}
