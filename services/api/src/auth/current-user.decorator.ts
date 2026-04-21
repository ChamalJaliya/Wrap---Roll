import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { type AppRole } from './roles.types';

export interface RequestUser {
  sub: string;
  email: string;
  role: AppRole;
  /** From Supabase `user_metadata` (magic-link signup) */
  fullName?: string;
  phone?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
