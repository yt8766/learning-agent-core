import { Module } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { AuthTokenVerifier } from '../auth/auth-token-verifier';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { InMemoryKnowledgeRepository } from './repositories/knowledge-memory.repository';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');

@Module({
  controllers: [KnowledgeController],
  providers: [
    {
      provide: KNOWLEDGE_REPOSITORY,
      useClass: InMemoryKnowledgeRepository
    },
    {
      provide: KnowledgeService,
      useFactory: (repository: KnowledgeRepository) => new KnowledgeService(repository),
      inject: [KNOWLEDGE_REPOSITORY]
    },
    {
      provide: AuthTokenVerifier,
      useFactory: () =>
        new AuthTokenVerifier({
          secret: process.env.AUTH_SERVER_JWT_SECRET ?? 'local-dev-auth-secret',
          issuer: 'auth-server',
          audience: 'knowledge'
        })
    },
    AuthGuard
  ]
})
export class KnowledgeModule {}
