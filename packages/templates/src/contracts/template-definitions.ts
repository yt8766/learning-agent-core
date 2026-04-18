export interface FrontendTemplateDefinition {
  id: string;
  displayName: string;
  description: string;
  directoryName: string;
  entryFiles: string[];
  sharedEntryFiles?: string[];
  moduleDirectories?: string[];
  includeAllFiles?: boolean;
  outputRoot?: string;
  defaultBaseDir?: string;
}

export interface ScaffoldTemplateDefinition {
  id: 'package-lib' | 'agent-basic';
  hostKind: 'package' | 'agent';
  displayName: string;
  description: string;
  directoryName: string;
  entryFiles: string[];
}
