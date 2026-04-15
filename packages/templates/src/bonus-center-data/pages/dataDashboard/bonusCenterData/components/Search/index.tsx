// @ts-nocheck
import { platformData } from '@/constants';
import { getTimezoneEnd, getTimezoneStart } from '@/constants/time';
import { useAppList } from '@/hooks/useAppList';
import { LiveCoreUserType } from '@/pages/dataDashboard/live/core/config';
import {
  ProForm,
  ProFormDatePicker,
  ProFormDateRangePicker,
  ProFormSelect,
  ProFormText,
  QueryFilter
} from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import dayjs from 'dayjs';
import { memo, useMemo } from 'react';
import { bonusCenterTabType, defaultSearchParams, isInvitedOptions, SearchParams, userTypeOptions } from '../../config';

type AppListItem = {
  app_name: string;
  id: string | number;
};

type SearchFormValues = Partial<SearchParams> & {
  app?: string[];
  platform?: string[];
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
};

export const Search = memo(
  ({
    setSearchParams,
    loading,
    activeTab,
    sourceChannelColumns,
    resetCheckedKeys,
    moneyType,
    checkedKeys
  }: {
    sourceChannelColumns: Record<string, unknown>;
    resetCheckedKeys: () => void;
    setSearchParams: (value: SearchParams) => void;
    loading: boolean;
    searchParams: SearchParams;
    checkedKeys: string[];
    activeTab: bonusCenterTabType;
    moneyType: string;
  }) => {
    const [form] = ProForm.useForm();
    const { appList } = useAppList((items: AppListItem[]) =>
      items.map((item: AppListItem) => ({
        label: `${item.app_name}-id:${item.id}`,
        value: item.app_name
      }))
    );

    const isCostAnalysis = useMemo(() => {
      return activeTab === bonusCenterTabType.costAnalysis;
    }, [activeTab]);

    const handleFinish = (value: SearchFormValues) => {
      const params: SearchParams = {
        ...defaultSearchParams,
        ...value,
        source_channel: checkedKeys?.join(',')
      };
      if (isCostAnalysis) {
        params.money_type = moneyType;
      } else {
        delete params.money_type;
      }
      setSearchParams(params);
    };

    const isUserAmountDistribution = useMemo(() => {
      return activeTab === bonusCenterTabType.userAmountDistribution;
    }, [activeTab]);

    const userAmountDistributionForm = useMemo(() => {
      if (isUserAmountDistribution) {
        return (
          <ProFormText
            name="start_amount"
            label={<FormattedMessage id="data.bonusCenter.startAmount" />}
            fieldProps={{
              placeholder: '请输入上限余额值'
            }}
          />
        );
      } else {
        return null;
      }
    }, [isUserAmountDistribution]);

    const userEndAmountForm = useMemo(() => {
      if (isUserAmountDistribution) {
        return <ProFormText name="end_amount" label={<FormattedMessage id="data.bonusCenter.endAmount" />} />;
      } else {
        return null;
      }
    }, [isUserAmountDistribution]);

    const userDateRangeForm = useMemo(() => {
      if (isUserAmountDistribution) {
        // 单个日期选择, 名称截止日期,默认昨天
        return (
          <ProFormDatePicker
            name="dt"
            label={<FormattedMessage id="data.bonusCenter.endDate" />}
            initialValue={dayjs().subtract(1, 'day').format('YYYY-MM-DD')}
            fieldProps={{
              format: 'YYYY-MM-DD',
              placeholder: '请选择日期'
            }}
            rules={[{ required: true }]}
            transform={(value: dayjs.Dayjs) => ({
              dt: dayjs(value).format('YYYY-MM-DD')
            })}
          />
        );
      } else {
        return (
          <ProFormDateRangePicker
            name="dateRange"
            label={<FormattedMessage id="common.time.date" />}
            initialValue={[getTimezoneStart(Date.now(), 30), getTimezoneEnd(Date.now())]}
            rules={[{ required: true }]}
            transform={value => ({
              start_dt: dayjs(value[0]).format('YYYY-MM-DD'),
              end_dt: dayjs(value[1]).format('YYYY-MM-DD')
            })}
          />
        );
      }
    }, [isUserAmountDistribution]);

    // 新老用户
    const userTypeForm = useMemo(() => {
      {
        /* 新老用户 */
      }
      if (activeTab !== bonusCenterTabType.costAnalysis) {
        return (
          <ProFormSelect
            name="user_type"
            label={<FormattedMessage id="live.core.newOldUser" />}
            options={userTypeOptions}
            transform={value => ({
              user_type: value === LiveCoreUserType.all ? undefined : value
            })}
            placeholder={'ALL'}
          />
        );
      }
    }, [activeTab]);

    return (
      <div className="w-full bg-white p-1 rounded">
        <QueryFilter
          defaultCollapsed={false}
          form={form}
          labelWidth="auto"
          loading={loading}
          onFinish={handleFinish}
          onReset={() => {
            const defaultValues = isUserAmountDistribution
              ? {
                  ...defaultSearchParams,
                  dt: dayjs().subtract(1, 'day').format('YYYY-MM-DD')
                }
              : {
                  ...defaultSearchParams,
                  start_dt: getTimezoneStart(Date.now(), 30).format('YYYY-MM-DD'),
                  end_dt: getTimezoneEnd(Date.now()).format('YYYY-MM-DD')
                };
            form.resetFields();
            setSearchParams(defaultValues);
            resetCheckedKeys();
            if (isUserAmountDistribution) {
              form.setFieldsValue({
                dt: dayjs().subtract(1, 'day').format('YYYY-MM-DD')
              });
            } else {
              form.setFieldsValue({
                dateRange: [getTimezoneStart(Date.now(), 30), getTimezoneEnd(Date.now())]
              });
            }
          }}
        >
          {userDateRangeForm}
          <ProFormSelect
            name="app"
            label="App"
            fieldProps={{
              showSearch: true,
              placeholder: 'All',
              options: appList,
              mode: 'multiple'
            }}
            transform={value => ({
              app: value.length > 0 ? value.join(',') : undefined
            })}
          />
          <ProFormSelect
            name="platform"
            label={<FormattedMessage id="common.base.platform" />}
            fieldProps={{
              showSearch: true,
              placeholder: 'All',
              options: platformData,
              mode: 'multiple'
            }}
            transform={value => ({
              platform: value.length > 0 ? value.join(',') : undefined
            })}
          />
          {userTypeForm}
          {/* 用户邀请类型（仅成本分析数据） */}
          {isCostAnalysis && (
            <ProFormSelect
              name="is_invited"
              label={<FormattedMessage id="data.bonusCenter.costAnalysisData.isInvited" />}
              options={isInvitedOptions}
              transform={value => ({
                is_invited: value || undefined
              })}
              placeholder={'ALL'}
            />
          )}
          {userAmountDistributionForm}
          {userEndAmountForm}
          <ProFormSelect label="广告渠道" {...sourceChannelColumns} />
        </QueryFilter>
      </div>
    );
  }
);
