export interface TaskRuntimeDecorations {
  requestedHints?: import('./skills').RequestedExecutionHints;
  toolAttachments?: import('./governance').ToolAttachmentRecord[];
  toolUsageSummary?: import('./governance').ToolUsageSummaryRecord[];
  activeInterrupt?: import('./governance').ApprovalInterruptRecord;
  interruptHistory?: import('./governance').ApprovalInterruptRecord[];
  capabilityAugmentations?: import('./skills').CapabilityAugmentationRecord[];
  capabilityAttachments?: import('./skills').CapabilityAttachmentRecord[];
  currentSkillExecution?: import('./tasking-orchestration').CurrentSkillExecutionRecord;
  learningEvaluation?: import('./knowledge').LearningEvaluationRecord;
  skillSearch?: import('./skills').SkillSearchStateRecord;
}
