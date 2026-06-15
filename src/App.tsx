import { useMemo, useState } from 'react';
import { album } from './data/sampleAlbum';
import { useCollection } from './store/collectionStore';
import { computeStats } from './utils/stats';
import TabBar, { type Tab } from './components/TabBar';
import ProgressBar from './components/ProgressBar';
import AlbumView from './components/AlbumView';
import SwapsView from './components/SwapsView';
import StatsView from './components/StatsView';

export default function App() {
  const [tab, setTab] = useState<Tab>('album');
  const counts = useCollection((s) => s.counts);
  const swaps = useCollection((s) => s.swaps);

  const stats = useMemo(() => computeStats(counts), [counts]);
  const openSwaps = swaps.filter((s) => s.status === 'open').length;

  return (
    <div className="app">
      <header className="app-header">
        <h1>{album.name}</h1>
        <div className="subtitle">FIFA World Cup 2026 · {album.stickers.length} stickers</div>
        <div className="header-progress">
          <ProgressBar
            label="Album progress"
            value={`${stats.ownedUnique}/${stats.totalStickers} · ${Math.round(
              stats.completionPct * 100,
            )}%`}
            pct={stats.completionPct}
          />
        </div>
      </header>

      <main className="content">
        {tab === 'album' && <AlbumView />}
        {tab === 'swaps' && <SwapsView />}
        {tab === 'stats' && <StatsView />}
      </main>

      <TabBar active={tab} onChange={setTab} openSwaps={openSwaps} />
    </div>
  );
}
