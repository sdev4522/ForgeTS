// resources/js/hooks/useForm.ts
// ─────────────────────────────────────────────────────────────────────
// Custom React hook for form state and error handling.
// ─────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';

export function useForm<T extends Record<string, any>>(initialValues: T) {
  const [data, setData] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const handleChange = useCallback((key: keyof T, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    data,
    setData,
    errors,
    setErrors,
    handleChange,
  };
}
