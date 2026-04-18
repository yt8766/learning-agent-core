import { z } from 'zod';

import {
  ConfigureConnectorDtoSchema,
  ConfigureConnectorTemplateIdSchema,
  ConfigureConnectorTransportSchema,
  ConfiguredConnectorRecordSchema,
  ConnectorDiscoveryHistoryRecordSchema,
  InstallRemoteSkillDtoSchema,
  InstallSkillDtoSchema,
  RemoteSkillSearchDtoSchema,
  RemoteSkillSearchResultRecordSchema,
  ResolveSkillInstallDtoSchema
} from '../schemas/skills-search.schema';

export type ConfigureConnectorTemplateId = z.infer<typeof ConfigureConnectorTemplateIdSchema>;
export type ConfigureConnectorTransport = z.infer<typeof ConfigureConnectorTransportSchema>;
export type InstallSkillDto = z.infer<typeof InstallSkillDtoSchema>;
export type RemoteSkillSearchDto = z.infer<typeof RemoteSkillSearchDtoSchema>;
export type RemoteSkillSearchResultRecord = z.infer<typeof RemoteSkillSearchResultRecordSchema>;
export type InstallRemoteSkillDto = z.infer<typeof InstallRemoteSkillDtoSchema>;
export type ResolveSkillInstallDto = z.infer<typeof ResolveSkillInstallDtoSchema>;
export type ConfigureConnectorDto = z.infer<typeof ConfigureConnectorDtoSchema>;
export type ConfiguredConnectorRecord = z.infer<typeof ConfiguredConnectorRecordSchema>;
export type ConnectorDiscoveryHistoryRecord = z.infer<typeof ConnectorDiscoveryHistoryRecordSchema>;
