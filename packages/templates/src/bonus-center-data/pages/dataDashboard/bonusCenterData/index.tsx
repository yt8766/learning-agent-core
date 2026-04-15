// @ts-nocheck
import { getTimezoneEnd, getTimezoneStart } from '@/constants/time';
import { useSourceChannelList } from '@/hooks/useSourceChannelList';
import { PageContainer } from '@ant-design/pro-components';
import { Segmented } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { AmountRecord } from './components/AmountRecord';
import { CostAnalysis } from './components/CostAnalysis';
import { ExchangeMall } from './components/ExchangeMall';
import { PujaPagePenetration } from './components/PujaPagePenetration';
import { RedeemPagePenetration } from './components/RedeemPagePenetration';
import { Search } from './components/Search';
import { TaskComplete } from './components/TaskComplete';
import { TaskPagePenetration } from './components/TaskPagePenetration';
import { UserAmountDistribution } from './components/UserAmountDistribution';
import { UserRemain } from './components/UserRemain';
import { bonusCenterTabType, defaultSearchParams, moneyTypeOptions, SearchParams, tabList } from './config';

const BonusCenterData = () => {
  const [activeTab, setActiveTab] = useState(bonusCenterTabType.taskPagePenetration);
  const [searchParams, setSearchParams] = useState<SearchParams>({
    ...defaultSearchParams,
    start_dt: getTimezoneStart(Date.now(), 30).format('YYYY-MM-DD'),
    end_dt: getTimezoneEnd(Date.now()).format('YYYY-MM-DD')
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [moneyType, setMoneyType] = useState<string>('coin');
  const { sourceChannelColumns, resetCheckedKeys, checkedKeys } = useSourceChannelList({
    treeMode: true
  });

  const activeTabMap = useMemo(() => {
    return {
      [bonusCenterTabType.taskPagePenetration]: (
        <TaskPagePenetration searchParams={searchParams} loading={loading} setLoading={setLoading} />
      ),
      [bonusCenterTabType.redeemPagePenetration]: (
        <RedeemPagePenetration searchParams={searchParams} loading={loading} setLoading={setLoading} />
      ),
      [bonusCenterTabType.pujaPagePenetration]: (
        <PujaPagePenetration searchParams={searchParams} loading={loading} setLoading={setLoading} />
      ),
      [bonusCenterTabType.taskComplete]: (
        <TaskComplete searchParams={searchParams} loading={loading} setLoading={setLoading} />
      ),
      [bonusCenterTabType.userRemain]: (
        <UserRemain searchParams={searchParams} loading={loading} setLoading={setLoading} />
      ),
      [bonusCenterTabType.amountRecord]: (
        <AmountRecord searchParams={searchParams} loading={loading} setLoading={setLoading} />
      ),
      [bonusCenterTabType.exchangeMall]: (
        <ExchangeMall searchParams={searchParams} loading={loading} setLoading={setLoading} />
      ),
      [bonusCenterTabType.userAmountDistribution]: (
        <UserAmountDistribution searchParams={searchParams} loading={loading} setLoading={setLoading} />
      ),
      [bonusCenterTabType.costAnalysis]: (
        <CostAnalysis searchParams={searchParams} loading={loading} setLoading={setLoading} />
      )
    };
  }, [searchParams, loading, moneyType]);

  const currentComponent = useMemo(() => {
    return activeTabMap[activeTab];
  }, [activeTab, searchParams, loading]);

  const isCostAnalysis = activeTab === bonusCenterTabType.costAnalysis;

  return (
    <PageContainer
      tabActiveKey={activeTab.toString()}
      tabList={tabList}
      onTabChange={key => {
        setActiveTab(+key);
        if (+key === bonusCenterTabType.userAmountDistribution) {
          setSearchParams({
            ...defaultSearchParams,
            dt: dayjs().subtract(1, 'day').format('YYYY-MM-DD')
          });
        } else {
          setSearchParams({
            ...defaultSearchParams,
            start_dt: getTimezoneStart(Date.now(), 30).format('YYYY-MM-DD'),
            end_dt: getTimezoneEnd(Date.now()).format('YYYY-MM-DD')
          });
        }
      }}
      extra={
        isCostAnalysis
          ? [
              <Segmented
                key="moneyType"
                options={moneyTypeOptions}
                value={moneyType}
                onChange={value => {
                  setMoneyType(value as string);
                  setSearchParams({
                    ...searchParams,
                    money_type: value as string
                  });
                }}
              />
            ]
          : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <Search
          setSearchParams={setSearchParams}
          loading={loading}
          sourceChannelColumns={sourceChannelColumns}
          resetCheckedKeys={resetCheckedKeys}
          checkedKeys={checkedKeys}
          moneyType={moneyType}
          searchParams={searchParams}
          activeTab={activeTab}
        />
        {currentComponent}
      </div>
    </PageContainer>
  );
};

export default BonusCenterData;
