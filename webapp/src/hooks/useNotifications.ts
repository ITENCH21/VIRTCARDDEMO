import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '../api/client';

export interface Notification {
  id: string;
  event: string;
  message: string;
  type: 'success' | 'error';
}

const EVENT_MESSAGES: Record<string, { message: string; type: 'success' | 'error' }> = {
  withdraw_complete: { message: 'Withdrawal completed!', type: 'success' },
  withdraw_failed: { message: 'Withdrawal was rejected. Funds returned.', type: 'error' },
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      const token = getAccessToken();
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const eventInfo = EVENT_MESSAGES[data.event];
          if (eventInfo) {
            const notification: Notification = {
              id: `${Date.now()}-${Math.random()}`,
              event: data.event,
              ...eventInfo,
            };
            setNotifications((prev) => [...prev, notification]);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (!unmounted) {
          reconnectTimer.current = setTimeout(connect, 5000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { notifications, dismiss };
}
