import { createContext, useContext } from 'react';

export const JourneyContext = createContext(null);

export function useJourneyState() {
  const journey = useContext(JourneyContext);
  if (!journey) throw new Error('Journey pages must be rendered inside JourneyLayout.');
  return journey;
}
