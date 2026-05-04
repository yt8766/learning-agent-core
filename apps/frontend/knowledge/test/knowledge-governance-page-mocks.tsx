import { vi } from 'vitest';

vi.mock('@ant-design/icons', () => {
  const iconNames = [
    'ApiOutlined',
    'BulbOutlined',
    'CheckCircleOutlined',
    'CloudServerOutlined',
    'DatabaseOutlined',
    'EyeInvisibleOutlined',
    'GlobalOutlined',
    'HddOutlined',
    'KeyOutlined',
    'LockOutlined',
    'MoreOutlined',
    'PlusOutlined',
    'SafetyOutlined',
    'SearchOutlined',
    'TeamOutlined',
    'ThunderboltOutlined'
  ];
  return Object.fromEntries(iconNames.map(name => [name, () => <span>{name}</span>]));
});

vi.mock('@ant-design/x/es/bubble', () => ({
  default: {
    List({ items }: { items: Array<{ content?: React.ReactNode; key: string }> }) {
      return (
        <div>
          {items.map(item => (
            <article key={item.key}>{item.content}</article>
          ))}
        </div>
      );
    }
  }
}));

vi.mock('@ant-design/x/es/conversations', () => ({
  default({ items }: { items: Array<{ key: string; label: React.ReactNode }> }) {
    return (
      <nav>
        {items.map(item => (
          <span key={item.key}>{item.label}</span>
        ))}
      </nav>
    );
  }
}));

vi.mock('@ant-design/x/es/sender', () => ({
  default({ header, placeholder, value }: { header?: React.ReactNode; placeholder?: string; value?: string }) {
    return (
      <div>
        {header}
        <span>{value || placeholder}</span>
      </div>
    );
  }
}));

vi.mock('@ant-design/x/es/suggestion', () => ({
  default({
    children,
    items
  }: {
    children?: (props: { onKeyDown: () => void; onTrigger: () => void }) => React.ReactElement;
    items: Array<{ label?: React.ReactNode; value: string }>;
  }) {
    return (
      <div>
        {children?.({ onKeyDown: () => {}, onTrigger: () => {} })}
        {items.map(item => (
          <span key={item.value}>{item.label}</span>
        ))}
      </div>
    );
  }
}));

vi.mock('@ant-design/x-markdown/es', () => ({
  default({ children }: { children?: React.ReactNode }) {
    return <div>{children}</div>;
  }
}));

vi.mock('antd', () => {
  const Fragment = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const Typography = {
    Text: Fragment,
    Title: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>
  };
  const Descriptions = Object.assign(({ children }: { children?: React.ReactNode }) => <dl>{children}</dl>, {
    Item: ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    )
  });

  return {
    Alert: ({ message, title }: { message?: React.ReactNode; title?: React.ReactNode }) => (
      <div>{title ?? message}</div>
    ),
    Avatar: Fragment,
    Button: Fragment,
    Card: Fragment,
    Col: Fragment,
    Descriptions,
    Form: Object.assign(Fragment, { Item: Fragment }),
    Input: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
    Progress: ({ percent }: { percent?: number }) => <span>{percent}%</span>,
    Row: Fragment,
    Select: ({ options, value }: { options?: Array<{ label: React.ReactNode; value: string }>; value?: string }) => (
      <div>
        {value}
        {options?.map(option => (
          <span key={option.value}>{option.label}</span>
        ))}
      </div>
    ),
    Space: Fragment,
    Statistic: ({
      title,
      value,
      suffix
    }: {
      title?: React.ReactNode;
      value?: React.ReactNode;
      suffix?: React.ReactNode;
    }) => (
      <span>
        {title}
        {value}
        {suffix}
      </span>
    ),
    Switch: ({ checked }: { checked?: boolean }) => <span>{checked ? '开启' : '关闭'}</span>,
    Table: MockTable,
    Tag: Fragment,
    Timeline: ({ items }: { items?: Array<{ children?: React.ReactNode; content?: React.ReactNode }> }) => (
      <ol>
        {items?.map((item, index) => (
          <li key={index}>{item.children ?? item.content}</li>
        ))}
      </ol>
    ),
    Typography,
    theme: {
      defaultAlgorithm: {},
      useToken: () => ({ token: {} })
    }
  };
});

function MockTable({
  columns,
  dataSource,
  rowKey
}: {
  columns: Array<{
    dataIndex?: string;
    key?: string;
    render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
    title?: React.ReactNode;
  }>;
  dataSource?: Array<Record<string, unknown>>;
  rowKey?: string;
}) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map(column => (
            <th key={String(column.key ?? column.dataIndex ?? column.title)}>{column.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(dataSource ?? []).map((row, index) => (
          <tr key={String(rowKey ? row[rowKey] : index)}>
            {columns.map(column => {
              const value = column.dataIndex ? row[column.dataIndex] : undefined;
              return (
                <td key={String(column.key ?? column.dataIndex ?? column.title)}>
                  {column.render ? column.render(value, row) : String(value ?? '')}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
