export interface BonusCenterBaseRecord extends Record<string, string | number | boolean | null | undefined> {
  dt?: string;
  app?: string;
  user_type?: string;
}

export type TaskPagePenetrationRecord = BonusCenterBaseRecord;

export type RedeemPagePenetrationRecord = BonusCenterBaseRecord;

export type PujaPagePenetrationRecord = BonusCenterBaseRecord;

export type TaskCompleteRecord = BonusCenterBaseRecord;

export type UserRemainRecord = BonusCenterBaseRecord;

export type AmountRecordRecord = BonusCenterBaseRecord;

export type ExchangeMallRecord = BonusCenterBaseRecord;

export type UserAmountDistributionRecord = BonusCenterBaseRecord;

export type CostAnalysisRecord = BonusCenterBaseRecord;
