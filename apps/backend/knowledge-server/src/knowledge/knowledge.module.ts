import { Module } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { AuthTokenVerifier } from '../auth/auth-token-verifier';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KNOWLEDGE_REPOSITORY } from './knowledge.tokens';
import type { KnowledgeRepository } from './repositories/knowledge.repository';
import { createKnowledgeRepositoryProvider } from './runtime/knowledge-repository.provider';

@Module({
  controllers: [KnowledgeController],
  providers: [
    createKnowledgeRepositoryProvider({ databaseUrl: process.env.DATABASE_URL }),
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
