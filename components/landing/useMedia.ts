import { useEffect, useState } from 'react';

export const useMedia = (query: string, initial = false) => {
  const [match, setMatch] = useState(() => (typeof window === 'undefined' ? initial : window.matchMedia(query).matches));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatch(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return match;
};
