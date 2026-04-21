import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SHOPPER_ROLE } from '@wrap-roll/contracts';
import { SupabaseService } from './supabase.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    const user = await this.supabaseService.verifyToken(token);

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    /** Staff role is often set in `app_metadata` (Supabase dashboard / service role); shoppers use `user_metadata`. */
    const roleSource =
      userMeta.role ??
      appMeta.role ??
      (typeof appMeta.staff_role === 'string' ? appMeta.staff_role : undefined) ??
      SHOPPER_ROLE;
    request.user = {
      sub: user.id,
      email: user.email ?? '',
      role: String(roleSource ?? SHOPPER_ROLE).toUpperCase(),
      fullName:
        typeof userMeta.full_name === 'string'
          ? userMeta.full_name
          : typeof userMeta.name === 'string'
            ? userMeta.name
            : typeof appMeta.full_name === 'string'
              ? appMeta.full_name
              : undefined,
      phone:
        typeof userMeta.phone === 'string'
          ? userMeta.phone
          : typeof appMeta.phone === 'string'
            ? appMeta.phone
            : undefined,
    };

    const isActive = userMeta.is_active ?? appMeta.is_active;
    if (isActive === false) {
      throw new UnauthorizedException('User account is inactive');
    }

    return true;
  }
}
