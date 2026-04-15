import { Injectable, NotFoundException } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { resolveFrontendTemplateDir } from '@agent/templates';

export type TemplateFileMap = Record<string, { code: string }>;

@Injectable()
export class TemplatesService {
  async getTemplate(templateId: string): Promise<TemplateFileMap> {
    const templateDir = resolveFrontendTemplateDir(templateId);

    if (!templateDir) {
      throw new NotFoundException(`Template "${templateId}" not found.`);
    }

    const filePaths = await this.listTemplateFiles(templateDir);
    if (filePaths.length === 0) {
      throw new NotFoundException(`No files found in template "${templateId}".`);
    }

    const entries = await Promise.all(
      filePaths.map(async filePath => {
        const content = await readFile(filePath, 'utf8');
        const templateRelativePath = relative(templateDir, filePath).replace(/\\/g, '/');
        return [`/${templateRelativePath}`, { code: this.sanitizeTemplateCode(content) }] as const;
      })
    );

    return Object.fromEntries(entries);
  }

  getReactTsTemplate(): Promise<TemplateFileMap> {
    return this.getTemplate('react-ts');
  }

  private async listTemplateFiles(rootDir: string): Promise<string[]> {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const nested = await Promise.all(
      entries
        .filter(entry => !this.shouldIgnoreEntry(entry.name))
        .map(async entry => {
          const resolvedPath = join(rootDir, entry.name);
          if (entry.isDirectory()) {
            return this.listTemplateFiles(resolvedPath);
          }
          return [resolvedPath];
        })
    );

    return nested.flat().sort((left, right) => left.localeCompare(right));
  }

  private shouldIgnoreEntry(name: string): boolean {
    return name === 'node_modules' || name === 'dist' || name === '.DS_Store';
  }

  private sanitizeTemplateCode(content: string): string {
    return content.replace(/^\/\/\s*@ts-nocheck\s*\n/, '');
  }
}
