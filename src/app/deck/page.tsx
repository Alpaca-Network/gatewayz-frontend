'use client';

import { useEffect } from 'react';

export default function DeckRedirect() {
  useEffect(() => {
    window.location.href = 'https://www.canva.com/design/DAG2Dc4lQvI/P2ws7cdUnYAjdFxXpsKvUw/view?utm_content=DAG2Dc4lQvI&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h20484be5f9';
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>Redirecting to presentation...</p>
    </div>
  );
}
