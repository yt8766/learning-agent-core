export const BONUS_CENTER_SINGLE_REPORT_PAGE_TEMPLATE = `import { GoshExportButton } from '../../../components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { useIntl } from 'react-intl';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { __SERVICE_EXPORT__ } from '../../../services/data/__ROUTE_NAME__';
import type { __TABLE_TYPE__ } from '../../../types/data/__ROUTE_NAME__';

export default function __PAGE_COMPONENT__() {
  const intl = useIntl();
  const [data, setData] = useState<__TABLE_TYPE__[]>([]);
  const [searchParams, setSearchParams] = useState<Record<string, unknown>>({});

  const columns: ProColumns<__TABLE_TYPE__>[] = [];

  const getData = async (params: Record<string, unknown>) => {
    setSearchParams(params || {});
    const response = await __SERVICE_EXPORT__(params);
    const records = response?.data?.records || [];
    setData(records);
    return {
      data: records,
      success: response?.code === 0 || response?.success === true,
      total: response?.data?.total || records.length || 0
    };
  };

  return (
    <PageContainer>
      <ProTable<__TABLE_TYPE__, Record<string, unknown>>
        {...(tableConfig as Record<string, unknown>)}
        columns={columns}
        request={getData}
        search={{
          ...((tableConfig as { search?: Record<string, unknown> })?.search ?? {}),
          optionRender: (_searchConfig: unknown, _formProps: unknown, dom: ReactNode[]) => [
            <GoshExportButton
              key="export"
              columns={columns}
              data={data}
              title={intl.formatMessage({ id: '__EXPORT_TITLE__' })}
              intl={intl}
              enableAudit={true}
              menuName="__MENU_NAME__"
              getQueryParams={() => ({ ...searchParams })}
            />,
            ...dom
          ]
        }}
        rowKey="id"
      />
    </PageContainer>
  );
}
`;
