import type { ReactNode } from 'react';

interface GatewayTableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

interface GatewayTableProps<T> {
  columns: Array<GatewayTableColumn<T>>;
  emptyText: string;
  getRowKey: (item: T) => string;
  items: T[];
}

export function GatewayTable<T>({ columns, emptyText, getRowKey, items }: GatewayTableProps<T>) {
  if (items.length === 0) {
    return <div className="empty-table">{emptyText}</div>;
  }

  return (
    <div className="table-scroll">
      <table className="gateway-table">
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={getRowKey(item)}>
              {columns.map(column => (
                <td key={column.key}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
