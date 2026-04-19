type BriefingCategoryRecord<TCategory extends string> = {
  category: TCategory;
};

type BriefingRunRecord<TCategory extends string, TCategoryRecord extends BriefingCategoryRecord<TCategory>> = {
  runAt: string;
  categories: TCategoryRecord[];
};

export function filterBriefingRunsByWindow<
  TCategory extends string,
  TCategoryRecord extends BriefingCategoryRecord<TCategory>,
  TRun extends BriefingRunRecord<TCategory, TCategoryRecord>
>(
  runs: TRun[],
  input: {
    days: number;
    category?: TCategory;
    now?: number;
  }
) {
  const cutoff = (input.now ?? Date.now()) - input.days * 24 * 60 * 60 * 1000;

  return runs
    .filter(run => new Date(run.runAt).getTime() >= cutoff)
    .map(run => ({
      ...run,
      categories: input.category ? run.categories.filter(item => item.category === input.category) : run.categories
    }))
    .filter(run => run.categories.length > 0);
}
