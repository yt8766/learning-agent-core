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
