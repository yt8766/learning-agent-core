import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayClearLogsResponse,
  GatewayLogFileListResponse,
  GatewayLogSearchRequest,
  GatewayRequestLogEntry,
  GatewayRequestLogListResponse
} from '@agent/core';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

interface LogDownloadManagementClient {
  tailLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse>;
  searchLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse>;
  listRequestErrorFiles(): Promise<GatewayLogFileListResponse>;
  clearLogs(): Promise<GatewayClearLogsResponse>;
  downloadRequestLog?(id: string): Promise<string>;
  downloadRequestErrorFile?(fileName: string): Promise<string>;
}

@Injectable()
export class AgentGatewayLogService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: LogDownloadManagementClient
  ) {}

  tail(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse> {
    return this.managementClient.tailLogs(request);
  }

  search(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse> {
    return this.managementClient.searchLogs(request);
  }

  listRequestErrorFiles(): Promise<GatewayLogFileListResponse> {
    return this.managementClient.listRequestErrorFiles();
  }

  clear(): Promise<GatewayClearLogsResponse> {
    return this.managementClient.clearLogs();
  }

  async downloadRequestLog(id: string): Promise<string> {
    if (this.managementClient.downloadRequestLog) {
      return this.managementClient.downloadRequestLog(id);
    }

    const logs = await this.managementClient.tailLogs({ hideManagementTraffic: false, limit: 500 });
    const match = logs.items.find(item => item.id === id);
    if (!match) {
      throw new Error(`Gateway request log not found: ${id}`);
    }

    return serializeRequestLog(match);
  }

  async downloadRequestErrorFile(fileName: string): Promise<string> {
    if (this.managementClient.downloadRequestErrorFile) {
      return this.managementClient.downloadRequestErrorFile(fileName);
    }

    const files = await this.managementClient.listRequestErrorFiles();
    const match = files.items.find(item => item.fileName === fileName);
    if (!match) {
      throw new Error(`Gateway request error file not found: ${fileName}`);
    }

    return `request-error-file: ${match.fileName}\npath: ${match.path}\nsizeBytes: ${match.sizeBytes}\nmodifiedAt: ${match.modifiedAt}\n`;
  }
}

function serializeRequestLog(entry: GatewayRequestLogEntry): string {
  return JSON.stringify(entry, null, 2);
}
