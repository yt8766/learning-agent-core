import type { SpecialistDomain } from '@agent/core';

export interface AgentCapability {
  readonly id: string;
  readonly displayName?: string;
  readonly description?: string;
}

export interface AgentDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: readonly string[];
  readonly capabilityDescriptors?: readonly AgentCapability[];
  readonly domains?: readonly SpecialistDomain[];
  readonly kind?: 'orchestrator' | 'specialist';
  readonly source: 'official' | 'custom';
}

export interface AgentFactory<TAgent = unknown> {
  createAgent(): TAgent | Promise<TAgent>;
}

export interface AgentProvider<TAgent = unknown> extends AgentFactory<TAgent> {
  readonly descriptor: AgentDescriptor;
}

export interface AgentRegistry<TAgent = unknown> {
  listAgents(): readonly AgentDescriptor[];
  findAgentById(agentId: string): AgentProvider<TAgent> | undefined;
  findAgentsByCapability(capability: string): readonly AgentProvider<TAgent>[];
  findAgentsByDomain(domain: SpecialistDomain): readonly AgentProvider<TAgent>[];
}

export type PlatformAgentDescriptor = AgentDescriptor;
