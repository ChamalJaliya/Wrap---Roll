import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IncomingHttpHeaders } from 'http';
import { SupervisorService } from '../supervisor/supervisor.service';
import { SUPERVISOR_SCOPE_KEY } from './supervisor-scope.decorator';
import { SUPERVISOR_ELEVATION_HEADER } from './supervisor-elevation.constants';
import type { RequestUser } from '../../auth/current-user.decorator';

function firstHeaderValue(headers: IncomingHttpHeaders, name: string): string {
  const v = headers[name];
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim();
  return '';
}

@Injectable()
export class SupervisorElevationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supervisorService: SupervisorService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope =
      this.reflector.getAllAndOverride<string>(SUPERVISOR_SCOPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'privileged_operations';

    const req = context.switchToHttp().getRequest<{
      user?: RequestUser;
      headers: IncomingHttpHeaders;
    }>();
    const user = req.user;
    if (!user?.sub) {
      throw new ForbiddenException({ code: 'AUTH_REQUIRED' });
    }

    const token = firstHeaderValue(req.headers, SUPERVISOR_ELEVATION_HEADER);
    if (!token) {
      throw new ForbiddenException({
        code: 'SUPERVISOR_ELEVATION_REQUIRED',
        message: 'Privileged action requires supervisor step-up.',
      });
    }

    const ok = await this.supervisorService.validateElevationSession(token, user.sub, scope);
    if (!ok) {
      throw new ForbiddenException({
        code: 'SUPERVISOR_ELEVATION_INVALID',
        message: 'Supervisor elevation is missing, expired, or wrong scope.',
      });
    }
    return true;
  }
}
