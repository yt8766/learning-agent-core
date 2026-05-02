import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { KnowledgeAuthenticatedRequest } from './auth.guard';
import type { KnowledgeAuthUser } from './auth-token-verifier';

export const AuthUser = createParamDecorator((_data: unknown, context: ExecutionContext): KnowledgeAuthUser => {
  const request = context.switchToHttp().getRequest<KnowledgeAuthenticatedRequest>();
  if (!request.authUser) {
    throw new Error('Auth user missing from request');
  }
  return request.authUser;
});
