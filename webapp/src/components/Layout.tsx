import { ReactNode } from 'react';
import BottomNav from './BottomNav';
import Toast from './Toast';
import { useNotifications } from '../hooks/useNotifications';

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  const { notifications, dismiss } = useNotifications();

  return (
    <>
      {notifications.map((n) => (
        <Toast
          key={n.id}
          message={n.message}
          type={n.type}
          onClose={() => dismiss(n.id)}
        />
      ))}
      <main style={{ flex: 1 }}>{children}</main>
      <BottomNav />
    </>
  );
}
