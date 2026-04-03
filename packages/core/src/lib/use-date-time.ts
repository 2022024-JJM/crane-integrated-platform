import { useEffect, useState } from 'react';
import { getFormatLocale } from '../config/i18n';

function getLanguageCode(language: string) {
  return language.toLowerCase().split('-')[0];
}

export function useCurrentDateTime() {
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return currentDateTime;
}

export function formatLocalizedDate(date: Date, language: string) {
  const locale = getFormatLocale(language);
  const normalizedLanguage = getLanguageCode(language);

  if (normalizedLanguage === 'ko') {
    const parts = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';

    return `${year}년 ${month}월 ${day}일`;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function formatLocalizedTime(date: Date, language: string) {
  return new Intl.DateTimeFormat(getFormatLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}
