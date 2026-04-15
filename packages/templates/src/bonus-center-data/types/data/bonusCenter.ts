export interface BonusCenterBaseRecord extends Record<string, string | number | boolean | null | undefined> {
  dt?: string;
  app?: string;
  user_type?: string;
}

export interface TaskPagePenetrationRecord extends BonusCenterBaseRecord {}

export interface RedeemPagePenetrationRecord extends BonusCenterBaseRecord {}

export interface PujaPagePenetrationRecord extends BonusCenterBaseRecord {}

export interface TaskCompleteRecord extends BonusCenterBaseRecord {}

export interface UserRemainRecord extends BonusCenterBaseRecord {}

export interface AmountRecordRecord extends BonusCenterBaseRecord {}

export interface ExchangeMallRecord extends BonusCenterBaseRecord {}

export interface UserAmountDistributionRecord extends BonusCenterBaseRecord {}

export interface CostAnalysisRecord extends BonusCenterBaseRecord {}
