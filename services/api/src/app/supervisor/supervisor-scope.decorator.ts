import { SetMetadata } from '@nestjs/common';

export const SUPERVISOR_SCOPE_KEY = 'supervisorScope';

/** Scope must match the elevation session created by POST /supervisor/challenge. */
export const RequireSupervisorElevation = (scope = 'privileged_operations') =>
  SetMetadata(SUPERVISOR_SCOPE_KEY, scope);
