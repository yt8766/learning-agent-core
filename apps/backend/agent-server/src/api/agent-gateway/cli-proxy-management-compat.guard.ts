import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class CliProxyManagementCompatGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.AGENT_GATEWAY_MANAGEMENT_KEY?.trim();
    if (!expectedKey && process.env.NODE_ENV !== 'production') return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const providedKey = readManagementKey(request.headers);
    if (expectedKey && providedKey === expectedKey) return true;

    throw new UnauthorizedException('CLI Proxy management key is required');
  }
}

function readManagementKey(headers: Record<string, string | string[] | undefined>): string {
  const directHeader = readHeader(headers['x-management-key']);
  if (directHeader) return directHeader;

  const authorization = readHeader(headers.authorization);
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorization);
  return bearerMatch?.[1]?.trim() ?? '';
}

function readHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0]?.trim() ?? '') : (value?.trim() ?? '');
}
