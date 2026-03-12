import { useEffect, useState } from 'react';

const CLOCK_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function useIndoorWorkClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  return {
    dateTime: now.toISOString(),
    clockLabel: CLOCK_FORMATTER.format(now),
  };
}
