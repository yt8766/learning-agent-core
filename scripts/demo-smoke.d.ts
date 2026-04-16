export declare function resolveLocalPath(baseDir: string, relativeModulePath: string): string;

export declare function loadLocalModule<T>(baseDir: string, relativeModulePath: string): T;

export declare function summarizeModuleExports(
  packageName: string,
  publicApi: Record<string, unknown>
): {
  packageName: string;
  exportCount: number;
  sampleExports: string[];
};

export declare function printDemoResult<T>(result: T): T;

export declare function isExecutedDirectly(scriptFileName: string): boolean;
