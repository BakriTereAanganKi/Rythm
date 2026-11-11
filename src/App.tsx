import { useEffect } from 'react';
import { useStore } from './store';
import { togglePlay } from './audio/engine';
import { BottomNav, MiniPlayer } from './components/Chrome';
import { Play } from './screens/Play';
import { Drone } from './screens/Drone';
import { Mandal } from './screens/Mandal';
import { Presets } from './screens/Presets';
import { More } from './screens/More';

export default function App() {
  const tab = useStore((s) => s.tab);

  // Space bar = play / pause (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(el.tagName)) {
        e.preventDefault();
        void togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  return (
    <div className="app">
      <main>
        {tab === 'play' && <Play />}
        {tab === 'drone' && <Drone />}
        {tab === 'mandal' && <Mandal />}
        {tab === 'presets' && <Presets />}
        {tab === 'more' && <More />}
      </main>
      <div className="dock">
        {tab !== 'play' && <MiniPlayer />}
        <BottomNav />
      </div>
    </div>
  );
}
