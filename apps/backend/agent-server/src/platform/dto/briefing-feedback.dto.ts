export type BriefingCategory =
  | 'frontend-security'
  | 'general-security'
  | 'devtool-security'
  | 'ai-tech'
  | 'frontend-tech'
  | 'backend-tech'
  | 'cloud-infra-tech';

export class BriefingFeedbackDto {
  messageKey!: string;
  category!: BriefingCategory;
  feedbackType!: 'helpful' | 'notHelpful';
  reasonTag?: 'too-noisy' | 'irrelevant' | 'too-late' | 'useful-actionable';
}
