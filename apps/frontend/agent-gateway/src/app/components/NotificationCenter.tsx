export interface NotificationItem {
  id: string;
  level: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

interface NotificationCenterProps {
  items: NotificationItem[];
}

export function NotificationCenter({ items }: NotificationCenterProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <aside className="notification-center" aria-label="通知">
      {items.map(item => (
        <div className={`notice notice-${item.level}`} key={item.id}>
          {item.message}
        </div>
      ))}
    </aside>
  );
}
