import type { SpecialistDomain } from '@agent/core';
import type { AgentDescriptor, AgentProvider, AgentRegistry } from '@agent/runtime';

export class StaticAgentRegistry<TAgent = unknown> implements AgentRegistry<TAgent> {
  private readonly providersById: ReadonlyMap<string, AgentProvider<TAgent>>;

  constructor(providers: readonly AgentProvider<TAgent>[] = []) {
    this.providersById = new Map(providers.map(provider => [provider.descriptor.id, provider]));
  }

  listAgents(): readonly AgentDescriptor[] {
    return [...this.providersById.values()].map(provider => provider.descriptor);
  }

  findAgentById(agentId: string): AgentProvider<TAgent> | undefined {
    return this.providersById.get(agentId);
  }

  findAgentsByCapability(capability: string): readonly AgentProvider<TAgent>[] {
    return [...this.providersById.values()].filter(provider => provider.descriptor.capabilities.includes(capability));
  }

  findAgentsByDomain(domain: SpecialistDomain): readonly AgentProvider<TAgent>[] {
    return [...this.providersById.values()].filter(provider => provider.descriptor.domains?.includes(domain));
  }
}
