import { createContext, useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const BreadcrumbContext = createContext({ setLabel: () => {}, labels: {} });

export function useBreadcrumbLabel(label) {
  const { pathname } = useLocation();
  const { setLabel } = useContext(BreadcrumbContext);
  useEffect(() => {
    if (!label) return undefined;
    setLabel(pathname, label);
    return () => setLabel(pathname, null);
  }, [pathname, label, setLabel]);
}
