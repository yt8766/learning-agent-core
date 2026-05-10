import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type {
  GatewayClient,
  GatewayClientListResponse,
  GatewayCreateClientRequest,
  GatewayUpdateClientRequest
} from '@agent/core';
import type { AgentGatewayClientRepository } from './agent-gateway-client.repository';
import { AGENT_GATEWAY_CLIENT_CLOCK, AGENT_GATEWAY_CLIENT_REPOSITORY } from './agent-gateway-client.repository';

type DateFactory = () => Date;

@Injectable()
export class AgentGatewayClientService {
  constructor(
    @Inject(AGENT_GATEWAY_CLIENT_REPOSITORY)
    private readonly repository: AgentGatewayClientRepository,
    @Optional()
    @Inject(AGENT_GATEWAY_CLIENT_CLOCK)
    private readonly now: DateFactory = () => new Date()
  ) {}

  async list(): Promise<GatewayClientListResponse> {
    return { items: await this.repository.listClients() };
  }

  async create(request: GatewayCreateClientRequest): Promise<GatewayClient> {
    const now = this.now().toISOString();
    const client: GatewayClient = {
      id: await this.nextClientId(request.name),
      name: request.name,
      description: request.description,
      ownerEmail: request.ownerEmail,
      status: 'active',
      tags: request.tags ?? [],
      createdAt: now,
      updatedAt: now
    };
    return this.repository.createClient(client);
  }

  async get(clientId: string): Promise<GatewayClient> {
    const client = await this.repository.findClient(clientId);
    if (!client) throw new NotFoundException({ code: 'CLIENT_NOT_FOUND', message: 'Gateway client not found' });
    return client;
  }

  async update(clientId: string, request: GatewayUpdateClientRequest): Promise<GatewayClient> {
    await this.get(clientId);
    const updated = await this.repository.updateClient(clientId, {
      ...request,
      updatedAt: this.now().toISOString()
    });
    if (!updated) throw new NotFoundException({ code: 'CLIENT_NOT_FOUND', message: 'Gateway client not found' });
    return updated;
  }

  enable(clientId: string): Promise<GatewayClient> {
    return this.update(clientId, { status: 'active' });
  }

  disable(clientId: string): Promise<GatewayClient> {
    return this.update(clientId, { status: 'disabled' });
  }

  private async nextClientId(name: string): Promise<string> {
    const baseId = `client-${slug(name)}`;
    let candidate = baseId;
    let suffix = 2;
    while (await this.repository.findClient(candidate)) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}

function slug(value: string): string {
  const slugged = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slugged || 'client';
}
