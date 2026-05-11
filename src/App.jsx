import React, { useState, useEffect, useRef } from 'react';
import { Upload, LogOut, LogIn, Music, Edit3, Camera, X, Star, Volume2, VolumeX, ChevronLeft, ChevronRight, Image as ImageIcon, Trash2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set as fbSet } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const DATA_PATH = 'whiskersAtHome/cats';

const PALETTE = {
  cream: '#FAF3E7', creamDeep: '#F2E6D0', creamWarm: '#F8EBD5',
  terracotta: '#C46A4A', terracottaDeep: '#9C4F35', terracottaSoft: '#E89878',
  brown: '#5C3A24', brownSoft: '#8B6648', brownLight: '#B89A7C',
  brownDark: '#3E2418',
  onAir: '#7DAE54', onAirGlow: 'rgba(125, 174, 84, 0.5)',
  spotlight: 'rgba(255, 220, 150, 0.4)',
};

const CATS = ['Aki', 'Iki', 'Yuki', 'Leo', 'Me-on', 'Chi Chi'];

const SPOTS = [
  'Balcony', 'Corridor', 'Cat Condo', 'Eating Spot',
  "San Jie's Room", "Er Jie's Room", "Da Jie's Room",
  'Kitchen', 'The 4th Room', 'Washroom',
  'Chilling Spot', 'Dining Area',
];

const PLAYLISTS = [
  { id: 'chillfun', name: 'Chill & Fun', icon: '🎉', desc: 'Cozy upbeat tunes', videoId: 'hkr6zFdYrCM' },
  { id: 'lofi', name: 'Lofi', icon: '🎧', desc: 'Tokyo lo-fi vibes', videoId: '1barPuagfTE' },
  { id: 'nature', name: 'Nature', icon: '🍃', desc: 'Soft ambient nature', videoId: 'YOJsKatW-Ts' },
  { id: 'meow', name: 'Cat Purrs', icon: '🐱', desc: 'For the cats themselves', videoId: 'hk__iTDn9E0' },
];

const AUTO_CHECKOUT_MS = 3 * 60 * 60 * 1000;

const initialState = (cats) => {
  const obj = {};
  cats.forEach(name => {
    obj[name] = {
      name, photo: null, isCheckedIn: false, lastSeen: null, lastSpot: null,
      checkInTime: null,
      visits: { day: 0, month: 0, year: 0, total: 0 },
      lastVisitDate: null, lastMonthKey: null, lastYearKey: null,
      spotCounts: {}, photos: [],
    };
  });
  return obj;
};

const todayKey = () => new Date().toISOString().slice(0,10);
const monthKey = () => new Date().toISOString().slice(0,7);
const yearKey = () => String(new Date().getFullYear());

const formatTimeAgo = (ts) => {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
};

const rolloverVisits = (cat) => {
  const today = todayKey();
  const month = monthKey();
  const year = yearKey();
  let v = { ...cat.visits };
  if (cat.lastVisitDate !== today) v.day = 0;
  if (cat.lastMonthKey !== month) v.month = 0;
  if (cat.lastYearKey !== year) v.year = 0;
  return { ...cat, visits: v, lastVisitDate: today, lastMonthKey: month, lastYearKey: year };
};

export default function CatDashboard() {
  const [cats, setCats] = useState(initialState(CATS));
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('cats');
  const [spotlightCat, setSpotlightCat] = useState(null);
  const [editingProfileFor, setEditingProfileFor] = useState(null);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [showMusic, setShowMusic] = useState(false);
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [muted, setMuted] = useState(false);
  const [photoModal, setPhotoModal] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const dataRef = ref(db, DATA_PATH);
    const unsubscribe = onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rolled = {};
        CATS.forEach(c => {
          if (data[c]) {
            const cat = { ...initialState([c])[c], ...data[c] };
            cat.photos = cat.photos || [];
            cat.spotCounts = cat.spotCounts || {};
            cat.visits = cat.visits || { day: 0, month: 0, year: 0, total: 0 };
            rolled[c] = rolloverVisits(cat);
          } else {
            rolled[c] = initialState([c])[c];
          }
        });
        setCats(rolled);
      }
      setLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const saveCat = (catName, catData) => {
    fbSet(ref(db, `${DATA_PATH}/${catName}`), catData).catch(e => {
      console.error('Save failed:', e);
      alert('Could not save. Check internet connection.');
    });
  };

  useEffect(() => {
    const t = setInterval(() => {
      setTick(x => x + 1);
      Object.keys(cats).forEach(k => {
        const c = cats[k];
        if (c.isCheckedIn && c.lastSeen && (Date.now() - c.lastSeen > AUTO_CHECKOUT_MS)) {
          saveCat(k, { ...c, isCheckedIn: false });
        }
      });
    }, 60000);
    return () => clearInterval(t);
  }, [cats]);

  const handlePhotoUpload = (catName, file, spot) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      let cat = rolloverVisits(cats[catName]);
      const wasCheckedOut = !cat.isCheckedIn;
      const newPhoto = { id: Date.now() + Math.random(), src: dataUrl, spot, ts: Date.now() };
      const photos = [newPhoto, ...cat.photos].slice(0, 30);
      const visits = wasCheckedOut ? {
        day: cat.visits.day + 1, month: cat.visits.month + 1,
        year: cat.visits.year + 1, total: cat.visits.total + 1,
      } : cat.visits;
      const spotCounts = { ...cat.spotCounts };
      spotCounts[spot] = (spotCounts[spot] || 0) + 1;
      saveCat(catName, {
        ...cat, isCheckedIn: true, lastSeen: Date.now(), lastSpot: spot,
        checkInTime: wasCheckedOut ? Date.now() : cat.checkInTime,
        visits, spotCounts, photos,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleProfilePhotoUpload = (catName, file) => {
    const reader = new FileReader();
    reader.onload = (e) => saveCat(catName, { ...cats[catName], photo: e.target.result });
    reader.readAsDataURL(file);
  };

  const handleManualCheckIn = (catName, spot) => {
    let cat = rolloverVisits(cats[catName]);
    const wasCheckedOut = !cat.isCheckedIn;
    const visits = wasCheckedOut ? {
      day: cat.visits.day + 1, month: cat.visits.month + 1,
      year: cat.visits.year + 1, total: cat.visits.total + 1,
    } : cat.visits;
    const spotCounts = { ...cat.spotCounts };
    spotCounts[spot] = (spotCounts[spot] || 0) + 1;
    saveCat(catName, {
      ...cat, isCheckedIn: true, lastSeen: Date.now(), lastSpot: spot,
      checkInTime: wasCheckedOut ? Date.now() : cat.checkInTime, visits, spotCounts,
    });
  };

  const handleCheckOut = (catName) => {
    saveCat(catName, { ...cats[catName], isCheckedIn: false });
  };

  const handleDeletePhoto = (catName, photoId) => {
    const cat = cats[catName];
    saveCat(catName, { ...cat, photos: cat.photos.filter(p => p.id !== photoId) });
  };

  const onAirCount = Object.values(cats).filter(c => c.isCheckedIn).length;
  const onAirCats = Object.values(cats).filter(c => c.isCheckedIn);
  const totalToday = Object.values(cats).reduce((s, c) => s + (c.visits?.day || 0), 0);
  const totalMonth = Object.values(cats).reduce((s, c) => s + (c.visits?.month || 0), 0);
  const totalYear = Object.values(cats).reduce((s, c) => s + (c.visits?.year || 0), 0);

  const globalSpotCounts = {};
  Object.values(cats).forEach(c => {
    Object.entries(c.spotCounts || {}).forEach(([s, n]) => {
      globalSpotCounts[s] = (globalSpotCounts[s] || 0) + n;
    });
  });
  const topSpot = Object.entries(globalSpotCounts).sort((a,b)=>b[1]-a[1])[0];
  const maxSpotCount = Math.max(1, ...Object.values(globalSpotCounts));

  const allPhotos = Object.values(cats).flatMap(c =>
    (c.photos || []).map(p => ({ ...p, catName: c.name, catPhoto: c.photo }))
  ).sort((a,b) => b.ts - a.ts);

  if (!loaded) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${PALETTE.cream} 0%, ${PALETTE.creamWarm} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui', color: PALETTE.brownSoft,
      }}>
        <div style={{ textAlign: 'center' }}>
          <Star size={32} fill={PALETTE.terracotta} stroke={PALETTE.terracottaDeep} />
          <p>Waking up the cats...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${PALETTE.cream} 0%, ${PALETTE.creamWarm} 100%)`,
      fontFamily: '"Inter", system-ui, sans-serif',
      color: PALETTE.brown, padding: '20px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        @keyframes pulse-ring { 0%, 100% { box-shadow: 0 0 0 0 ${PALETTE.onAirGlow}; } 50% { box-shadow: 0 0 0 8px transparent; } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spotlight-glow { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.05); } }
        @keyframes pulse-dot-svg { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
        @keyframes pulse-ring-svg { 0% { r: 6; opacity: 0.8; } 100% { r: 18; opacity: 0; } }
        .serif { font-family: 'Fraunces', Georgia, serif; }
        .pulse-ring { animation: pulse-ring 2s ease-in-out infinite; }
        .star-icon { animation: spin-slow 30s linear infinite; }
        .spotlight { animation: spotlight-glow 3s ease-in-out infinite; }
        .svg-pulse-dot { animation: pulse-dot-svg 1.5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        .svg-pulse-ring { animation: pulse-ring-svg 1.8s ease-out infinite; }
        button { font-family: inherit; }
        input[type="file"] { display: none; }
      `}</style>

      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <Header onAirCount={onAirCount} activePlaylist={activePlaylist}
          showMusic={showMusic} setShowMusic={setShowMusic} />

        {showMusic && (
          <MusicPanel activePlaylist={activePlaylist} setActivePlaylist={setActivePlaylist}
            muted={muted} setMuted={setMuted} />
        )}

        <GlobalStats totalToday={totalToday} totalMonth={totalMonth} totalYear={totalYear} 
          topSpot={topSpot} onAirCats={onAirCats} />

        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'cats' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {Object.values(cats).map(cat => (
              <CatCard key={cat.name} cat={cat}
                onUpload={() => setUploadingFor(cat.name)}
                onCheckOut={() => handleCheckOut(cat.name)}
                onSpotlight={() => setSpotlightCat(cat.name)}
                onEditProfile={() => setEditingProfileFor(cat.name)}
              />
            ))}
          </div>
        )}

        {activeTab === 'spots' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <FloorPlan cats={cats} />
            <SpotList spotCounts={globalSpotCounts} maxCount={maxSpotCount} />
          </div>
        )}

        {activeTab === 'blog' && (
          <PhotoBlog photos={allPhotos} cats={cats}
            onPhotoClick={(catName, idx) => setPhotoModal({ catName, idx })}
            onUpload={(catName) => setUploadingFor(catName)} />
        )}

        <div style={{ marginTop: '32px', padding: '16px', textAlign: 'center', color: PALETTE.brownLight, fontSize: '11px', fontStyle: 'italic' }}>
          Made with warm cream and terracotta · syncs live across all devices
        </div>
      </div>

      {spotlightCat && (
        <SpotlightModal cat={cats[spotlightCat]}
          onClose={() => setSpotlightCat(null)}
          onUpload={() => { setSpotlightCat(null); setUploadingFor(spotlightCat); }}
          onEditProfile={() => { setSpotlightCat(null); setEditingProfileFor(spotlightCat); }}
          onCheckOut={() => { handleCheckOut(spotlightCat); setSpotlightCat(null); }}
          onPhotoClick={(idx) => { setSpotlightCat(null); setPhotoModal({ catName: spotlightCat, idx }); }} />
      )}

      {editingProfileFor && (
        <ProfileEditModal catName={editingProfileFor} currentPhoto={cats[editingProfileFor].photo}
          onSave={(file) => { handleProfilePhotoUpload(editingProfileFor, file); setEditingProfileFor(null); }}
          onClear={() => { saveCat(editingProfileFor, { ...cats[editingProfileFor], photo: null }); setEditingProfileFor(null); }}
          onClose={() => setEditingProfileFor(null)} />
      )}

      {uploadingFor && (
        <UploadModal catName={uploadingFor}
          onUpload={(file, spot) => { handlePhotoUpload(uploadingFor, file, spot); setUploadingFor(null); }}
          onManualOnly={(spot) => { handleManualCheckIn(uploadingFor, spot); setUploadingFor(null); }}
          onClose={() => setUploadingFor(null)} />
      )}

      {photoModal && (
        <PhotoLightbox cat={cats[photoModal.catName]} startIdx={photoModal.idx}
          onClose={() => setPhotoModal(null)}
          onDelete={(photoId) => handleDeletePhoto(photoModal.catName, photoId)} />
      )}
    </div>
  );
}

function Header({ onAirCount, activePlaylist, showMusic, setShowMusic }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Star size={28} fill={PALETTE.terracotta} stroke={PALETTE.terracottaDeep} className="star-icon" />
          <h1 className="serif" style={{ fontSize: '34px', fontWeight: 600, margin: 0, color: PALETTE.terracottaDeep, letterSpacing: '-0.02em' }}>
            Whiskers at home
          </h1>
        </div>
        <p style={{ margin: '6px 0 0 40px', fontSize: '13px', color: PALETTE.brownSoft, fontStyle: 'italic' }}>
          A cozy live tracker for our six neighbour cats
        </p>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
          background: onAirCount > 0 ? 'rgba(125, 174, 84, 0.15)' : 'rgba(92, 58, 36, 0.08)',
          borderRadius: '999px', fontSize: '13px', fontWeight: 500,
          color: onAirCount > 0 ? PALETTE.onAir : PALETTE.brownSoft,
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: onAirCount > 0 ? PALETTE.onAir : PALETTE.brownLight }}
            className={onAirCount > 0 ? 'pulse-ring' : ''} />
          {onAirCount} on air now
        </div>
        <button onClick={() => setShowMusic(!showMusic)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
          background: activePlaylist ? PALETTE.terracotta : 'transparent',
          color: activePlaylist ? PALETTE.cream : PALETTE.brown,
          border: `1px solid ${PALETTE.terracotta}`, borderRadius: '999px',
          fontSize: '13px', fontWeight: 500, cursor: 'pointer',
        }}>
          <Music size={14} />
          {activePlaylist ? PLAYLISTS.find(p => p.id === activePlaylist)?.name : 'Music'}
        </button>
      </div>
    </div>
  );
}

function MusicPanel({ activePlaylist, setActivePlaylist, muted, setMuted }) {
  const playlist = PLAYLISTS.find(p => p.id === activePlaylist);
  return (
    <div style={{ background: PALETTE.cream, border: `1px solid ${PALETTE.creamDeep}`, borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <span className="serif" style={{ fontSize: '15px', fontWeight: 500, color: PALETTE.terracottaDeep }}>
          Pick a playlist for the cats
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activePlaylist && (
            <>
              <button onClick={() => setMuted(!muted)} title={muted ? "Unmute" : "Mute"} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: PALETTE.brownSoft, padding: '4px' }}>
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button onClick={() => setActivePlaylist(null)} style={{
                background: PALETTE.brown, color: PALETTE.cream, border: 'none',
                borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
              }}>
                Stop
              </button>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
        {PLAYLISTS.map(p => (
          <button key={p.id} onClick={() => setActivePlaylist(p.id)} style={{
            background: activePlaylist === p.id ? PALETTE.terracottaSoft : PALETTE.creamDeep,
            border: `1px solid ${activePlaylist === p.id ? PALETTE.terracotta : 'transparent'}`,
            borderRadius: '10px', padding: '10px 12px', cursor: 'pointer',
            textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '20px' }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: PALETTE.brown }}>{p.name}</div>
              <div style={{ fontSize: '11px', color: PALETTE.brownSoft }}>{p.desc}</div>
            </div>
          </button>
        ))}
      </div>
      {/* Hidden YouTube iframe player */}
      {playlist && (
        <div style={{ marginTop: '12px', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${PALETTE.creamDeep}` }}>
          <iframe
            key={`${playlist.videoId}-${muted ? 'm' : 'u'}`}
            width="100%"
            height="80"
            src={`https://www.youtube.com/embed/${playlist.videoId}?autoplay=1&mute=${muted ? 1 : 0}&controls=1&modestbranding=1&rel=0`}
            title={playlist.name}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ display: 'block', background: '#000' }}
          />
          <div style={{ padding: '8px 12px', background: PALETTE.creamDeep, fontSize: '11px', color: PALETTE.brownSoft, fontStyle: 'italic' }}>
            🎵 Now playing: {playlist.name} · adjust volume on the YouTube bar above
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalStats({ totalToday, totalMonth, totalYear, topSpot, onAirCats }) {
  return (
    <div style={{ background: PALETTE.cream, border: `1px solid ${PALETTE.creamDeep}`, borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: PALETTE.brownSoft }}>Global view</span>
        <span style={{ fontSize: '11px', color: PALETTE.brownLight, fontStyle: 'italic' }}>auto check-out after 3 hr · syncs live</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Today', value: totalToday, sub: 'visits' },
          { label: 'This month', value: totalMonth, sub: 'visits' },
          { label: 'This year', value: totalYear, sub: 'visits' },
          { label: 'Top spot', value: topSpot ? topSpot[0] : '—', sub: topSpot ? `${topSpot[1]} sightings` : 'none yet', text: true },
        ].map((s, i) => (
          <div key={i} style={{
            background: i === 0 ? PALETTE.terracotta : PALETTE.creamDeep,
            color: i === 0 ? PALETTE.cream : PALETTE.brown,
            borderRadius: '12px', padding: '14px 16px',
          }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: i === 0 ? PALETTE.creamWarm : PALETTE.brownSoft, marginBottom: '4px' }}>{s.label}</div>
            <div className={s.text ? '' : 'serif'} style={{ fontSize: s.text ? '16px' : '28px', fontWeight: 600, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: i === 0 ? PALETTE.creamWarm : PALETTE.brownSoft, marginTop: '2px' }}>{s.sub}</div>
          </div>
        ))}
      </div>
      {/* On-air cats live counter */}
      {onAirCats.length > 0 && (
        <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(125, 174, 84, 0.12)', borderRadius: '12px', border: '1px solid rgba(125, 174, 84, 0.25)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: PALETTE.onAir, marginBottom: '8px', fontWeight: 600 }}>
            🟢 On air right now
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {onAirCats.map(c => (
              <div key={c.name} style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 12px 6px 6px', background: PALETTE.cream,
                borderRadius: '999px', fontSize: '12px',
              }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: c.photo ? `url(${c.photo}) center/cover` : PALETTE.creamDeep,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: PALETTE.terracottaDeep, fontWeight: 600, fontSize: '11px',
                }}>
                  {!c.photo && c.name[0]}
                </div>
                <span style={{ fontWeight: 500, color: PALETTE.brown }}>{c.name}</span>
                <span style={{ color: PALETTE.brownSoft, fontSize: '11px' }}>· {c.lastSpot}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tabs({ activeTab, setActiveTab }) {
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${PALETTE.creamDeep}`, marginBottom: '20px' }}>
      {[{ id: 'cats', label: 'Cats' }, { id: 'spots', label: 'Favourite spots' }, { id: 'blog', label: 'Photo blog' }].map(t => (
        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
          background: 'transparent', border: 'none', padding: '10px 18px',
          fontSize: '14px', fontWeight: activeTab === t.id ? 600 : 400,
          color: activeTab === t.id ? PALETTE.terracottaDeep : PALETTE.brownSoft,
          borderBottom: `2px solid ${activeTab === t.id ? PALETTE.terracotta : 'transparent'}`,
          marginBottom: '-1px', cursor: 'pointer',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function CatCard({ cat, onUpload, onCheckOut, onSpotlight, onEditProfile }) {
  const isLive = cat.isCheckedIn;
  return (
    <div style={{
      background: PALETTE.cream, borderRadius: '16px', padding: '16px',
      border: `1px solid ${isLive ? 'rgba(125, 174, 84, 0.4)' : PALETTE.creamDeep}`,
      position: 'relative', cursor: 'pointer',
    }} onClick={onSpotlight}>
      <div style={{ position: 'absolute', top: '12px', right: '12px', opacity: isLive ? 1 : 0.3 }}>
        <Star size={16} fill={isLive ? PALETTE.terracotta : 'transparent'} stroke={PALETTE.terracotta} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ position: 'relative' }}>
          {isLive && <div style={{ position: 'absolute', inset: '-6px', borderRadius: '50%', background: PALETTE.spotlight }} className="spotlight" />}
          <div style={{
            position: 'relative', width: '54px', height: '54px', borderRadius: '50%',
            background: cat.photo ? `url(${cat.photo}) center/cover` : PALETTE.creamDeep,
            border: `2.5px solid ${isLive ? PALETTE.onAir : PALETTE.creamDeep}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: PALETTE.terracottaDeep, fontSize: '18px', fontWeight: 600, fontFamily: 'Fraunces, serif',
            boxShadow: isLive ? `0 0 0 4px ${PALETTE.onAirGlow}` : 'none',
          }} className={isLive ? 'pulse-ring' : ''}>
            {!cat.photo && cat.name[0]}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: '17px', fontWeight: 600, color: PALETTE.brown, margin: 0 }}>{cat.name}</div>
          <div style={{ fontSize: '11px', color: PALETTE.brownSoft, marginTop: '2px' }}>
            {cat.lastSpot ? `${cat.lastSpot} · ${formatTimeAgo(cat.lastSeen)}` : 'No sightings yet'}
          </div>
        </div>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px',
        background: isLive ? 'rgba(125, 174, 84, 0.15)' : 'rgba(92, 58, 36, 0.07)',
        fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: isLive ? PALETTE.onAir : PALETTE.brownLight, marginBottom: '12px',
      }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isLive ? PALETTE.onAir : PALETTE.brownLight }} />
        {isLive ? 'On air' : 'Away'}
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[
          { lab: 'Day', val: cat.visits?.day || 0 },
          { lab: 'Month', val: cat.visits?.month || 0 },
          { lab: 'Year', val: cat.visits?.year || 0 },
        ].map(v => (
          <div key={v.lab} style={{ flex: 1, textAlign: 'center', background: PALETTE.creamDeep, borderRadius: '8px', padding: '6px 4px' }}>
            <div className="serif" style={{ fontSize: '15px', fontWeight: 600, color: PALETTE.brown }}>{v.val}</div>
            <div style={{ fontSize: '9px', color: PALETTE.brownSoft, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{v.lab}</div>
          </div>
        ))}
      </div>
      {/* All 3 buttons always visible: Check in/Add photo · Check out · Profile */}
      <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onUpload} style={{
          flex: 1, background: PALETTE.terracotta, color: PALETTE.cream, border: 'none', borderRadius: '8px',
          padding: '8px 6px', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        }}>
          <Camera size={12} /> {isLive ? 'Photo' : 'Check in'}
        </button>
        <button onClick={onCheckOut} disabled={!isLive} style={{
          flex: 1, background: 'transparent', color: isLive ? PALETTE.brown : PALETTE.brownLight,
          border: `1px solid ${isLive ? PALETTE.brownLight : PALETTE.creamDeep}`, borderRadius: '8px', padding: '8px 6px',
          fontSize: '11px', fontWeight: 500, cursor: isLive ? 'pointer' : 'not-allowed',
          opacity: isLive ? 1 : 0.5,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        }}>
          <LogOut size={12} /> Check out
        </button>
        <button onClick={onEditProfile} title="Edit profile photo" style={{
          background: 'transparent', color: PALETTE.brownSoft,
          border: `1px solid ${PALETTE.creamDeep}`, borderRadius: '8px', padding: '8px 10px',
          fontSize: '11px', fontWeight: 500, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Edit3 size={12} />
        </button>
      </div>
    </div>
  );
}

function FloorPlan({ cats }) {
  // V1 Layout: corridor on RIGHT side, outside entrance (between entrance and dining)
  // Updated coords for the v1 layout
  const spotCoords = {
    'Cat Condo': { x: 425, y: 200 },
    'Eating Spot': { x: 470, y: 75 },
    'Kitchen': { x: 270, y: 60 },
    'The 4th Room': { x: 270, y: 122 },
    'Washroom': { x: 270, y: 245 },
    "Er Jie's Room": { x: 270, y: 310 },
    "San Jie's Room": { x: 97, y: 270 },
    "Da Jie's Room": { x: 280, y: 390 },
    'Dining Area': { x: 470, y: 320 },
    'Chilling Spot': { x: 555, y: 415 },
    'Corridor': { x: 580, y: 200 },
    'Balcony': { x: 400, y: 540 },
  };

  const catsAtSpot = {};
  Object.values(cats).filter(c => c.isCheckedIn && c.lastSpot).forEach(c => {
    if (!catsAtSpot[c.lastSpot]) catsAtSpot[c.lastSpot] = [];
    catsAtSpot[c.lastSpot].push(c);
  });

  return (
    <div style={{ background: PALETTE.cream, border: `1px solid ${PALETTE.creamDeep}`, borderRadius: '16px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span className="serif" style={{ fontSize: '15px', fontWeight: 600, color: PALETTE.terracottaDeep }}>Your home, by their paws</span>
        <span style={{ fontSize: '11px', color: PALETTE.brownSoft, fontStyle: 'italic' }}>🟢 dot = on air now</span>
      </div>
      <svg viewBox="0 0 640 580" style={{ width: '100%', height: 'auto', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="paperGrain" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#F8EBD5"/>
            <circle cx="8" cy="12" r="0.5" fill="#E8D8B5" opacity="0.5"/>
            <circle cx="28" cy="32" r="0.5" fill="#E8D8B5" opacity="0.5"/>
            <circle cx="35" cy="6" r="0.4" fill="#D8C8A0" opacity="0.4"/>
          </pattern>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
            <feOffset dx="1" dy="2" result="offsetblur"/>
            <feFlood floodColor="#3E2418" floodOpacity="0.2"/>
            <feComposite in2="offsetblur" operator="in"/>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <symbol id="plant" viewBox="-10 -16 20 20">
            <ellipse cx="0" cy="0" rx="7" ry="3" fill="#5C3A24"/>
            <path d="M -5 -2 Q 0 -14 -2 -16 M 0 -2 Q 2 -14 4 -16 M 4 -2 Q 7 -10 8 -14" stroke="#7DAE54" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </symbol>
          <symbol id="plantBig" viewBox="-12 -20 24 24">
            <ellipse cx="0" cy="0" rx="9" ry="4" fill="#5C3A24"/>
            <path d="M -6 -2 Q -2 -16 -4 -19 M -2 -2 Q 0 -17 2 -20 M 2 -2 Q 5 -15 7 -18 M 5 -2 Q 8 -12 10 -16" stroke="#7DAE54" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <circle cx="2" cy="-12" r="1.5" fill="#FAC775"/>
          </symbol>
        </defs>

        <rect width="640" height="580" fill="url(#paperGrain)" rx="14"/>

        {/* KITCHEN (top center) */}
        <g filter="url(#softShadow)">
          <rect x="180" y="20" width="180" height="80" fill="#D9C29C" stroke="#5C3A24" strokeWidth="2" rx="4"/>
          <line x1="180" y1="50" x2="360" y2="50" stroke="#B89466" strokeWidth="0.5" opacity="0.5"/>
          <line x1="180" y1="80" x2="360" y2="80" stroke="#B89466" strokeWidth="0.5" opacity="0.5"/>
          <rect x="195" y="32" width="22" height="22" fill="#5C3A24" rx="2"/>
          <circle cx="201" cy="38" r="2" fill="#C46A4A"/>
          <circle cx="211" cy="38" r="2" fill="#C46A4A"/>
          <ellipse cx="206" cy="28" rx="6" ry="4" fill="#7A5A3A"/>
          <rect x="204" y="22" width="4" height="3" fill="#7A5A3A"/>
          <rect x="225" y="38" width="60" height="14" fill="#A87850" rx="1"/>
          <rect x="295" y="32" width="22" height="26" fill="#5C3A24" rx="2"/>
          <rect x="298" y="38" width="16" height="14" fill="#3E2418"/>
          <circle cx="306" cy="45" r="2" fill="#FAC775" opacity="0.6"/>
        </g>
        <text x="270" y="80" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fontWeight="500" fill="#3E2418">Kitchen</text>

        {/* THE 4TH ROOM */}
        <g filter="url(#softShadow)">
          <rect x="180" y="108" width="180" height="32" fill="#C9A878" stroke="#5C3A24" strokeWidth="2" rx="3"/>
        </g>
        <text x="270" y="128" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="10" fontWeight="500" fill="#3E2418">The 4th Room</text>

        {/* WASHROOM (between San Jie & Er Jie - v2 fix retained) */}
        <g filter="url(#softShadow)">
          <rect x="180" y="148" width="180" height="56" fill="#B8D4D0" stroke="#5C3A24" strokeWidth="2" rx="3"/>
          <ellipse cx="210" cy="178" rx="22" ry="11" fill="#FAF3E7" stroke="#5C3A24" strokeWidth="1.2"/>
          <ellipse cx="210" cy="176" rx="18" ry="8" fill="#D8E8E5"/>
          <rect x="265" y="172" width="22" height="14" fill="#FAF3E7" stroke="#5C3A24" strokeWidth="1" rx="2"/>
          <circle cx="276" cy="168" r="2" fill="#A8A8A8"/>
        </g>
        <text x="270" y="200" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="10" fontWeight="500" fill="#3E2418">Washroom</text>

        {/* ER JIE'S ROOM */}
        <g filter="url(#softShadow)">
          <rect x="180" y="212" width="180" height="64" fill="#E8D5B5" stroke="#5C3A24" strokeWidth="2" rx="3"/>
          <rect x="190" y="222" width="42" height="20" fill="#FAF3E7" stroke="#8B6648" strokeWidth="1" rx="2"/>
          <rect x="190" y="222" width="14" height="20" fill="#9C4F35" rx="2"/>
          <ellipse cx="290" cy="252" rx="32" ry="12" fill="#C46A4A" opacity="0.5"/>
          <ellipse cx="290" cy="252" rx="22" ry="7" fill="#9C4F35" opacity="0.4"/>
        </g>
        <text x="270" y="270" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="10" fontWeight="500" fill="#3E2418">Er Jie's Room</text>

        {/* SAN JIE'S ROOM (left, big) */}
        <g filter="url(#softShadow)">
          <rect x="20" y="20" width="155" height="368" fill="#A87850" stroke="#5C3A24" strokeWidth="2" rx="4"/>
          <line x1="20" y1="100" x2="175" y2="100" stroke="#7A5A3A" strokeWidth="0.5" opacity="0.5"/>
          <line x1="20" y1="200" x2="175" y2="200" stroke="#7A5A3A" strokeWidth="0.5" opacity="0.5"/>
          <line x1="20" y1="300" x2="175" y2="300" stroke="#7A5A3A" strokeWidth="0.5" opacity="0.5"/>
          <ellipse cx="80" cy="270" rx="50" ry="55" fill="#FAF3E7" opacity="0.85"/>
          <ellipse cx="80" cy="270" rx="42" ry="46" fill="#F8EBD5"/>
          <rect x="28" y="35" width="34" height="38" fill="#3E2418" rx="2"/>
          <line x1="28" y1="47" x2="62" y2="47" stroke="#B89466" strokeWidth="1"/>
          <line x1="28" y1="59" x2="62" y2="59" stroke="#B89466" strokeWidth="1"/>
          <rect x="32" y="37" width="3" height="9" fill="#C46A4A"/>
          <rect x="36" y="37" width="3" height="9" fill="#7DAE54"/>
          <rect x="40" y="38" width="3" height="8" fill="#FAC775"/>
          <rect x="44" y="37" width="3" height="9" fill="#9C4F35"/>
        </g>
        <text x="97" y="380" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fontWeight="500" fill="#FAF3E7">San Jie's Room</text>

        {/* DA JIE'S ROOM */}
        <g filter="url(#softShadow)">
          <rect x="180" y="350" width="200" height="74" fill="#D4B98C" stroke="#5C3A24" strokeWidth="2" rx="3"/>
          <rect x="195" y="368" width="48" height="24" fill="#FAF3E7" stroke="#8B6648" strokeWidth="1" rx="2"/>
          <rect x="195" y="368" width="14" height="24" fill="#C46A4A" rx="2"/>
        </g>
        <text x="280" y="416" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fontWeight="500" fill="#3E2418">Da Jie's Room</text>

        {/* CAT CONDO (between top rooms and entrance) */}
        <g filter="url(#softShadow)" transform="translate(395, 125)">
          <rect x="0" y="60" width="36" height="20" fill="#A87850" stroke="#5C3A24" strokeWidth="1.5" rx="2"/>
          <rect x="6" y="30" width="24" height="32" fill="#B89466" stroke="#5C3A24" strokeWidth="1.5" rx="3"/>
          <circle cx="18" cy="46" r="6" fill="#3E2418"/>
          <rect x="14" y="0" width="8" height="32" fill="#A87850" stroke="#5C3A24" strokeWidth="1"/>
          <ellipse cx="18" cy="0" rx="14" ry="5" fill="#B89466" stroke="#5C3A24" strokeWidth="1.2"/>
        </g>
        <text x="413" y="220" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="10" fontWeight="600" fill="#9C4F35">Cat Condo</text>
        <g transform="translate(440, 115)">
          <polygon points="0,-9 2.5,-3 9,-3 4,1.5 6,8 0,4.5 -6,8 -4,1.5 -9,-3 -2.5,-3" fill="#FAC775" stroke="#9C4F35" strokeWidth="1"/>
        </g>

        {/* EATING SPOT */}
        <g filter="url(#softShadow)" transform="translate(470, 60)">
          <ellipse cx="0" cy="0" rx="14" ry="6" fill="#7A5A3A" stroke="#5C3A24" strokeWidth="1.5"/>
          <ellipse cx="0" cy="-2" rx="11" ry="4" fill="#A87850"/>
          <circle cx="-5" cy="-3" r="1.5" fill="#FAC775"/>
          <circle cx="2" cy="-4" r="1.5" fill="#C46A4A"/>
          <circle cx="6" cy="-2" r="1.2" fill="#7DAE54"/>
        </g>
        <g transform="translate(470, 90)">
          <polygon points="0,-7 2,-2 7,-2 3,1 4.5,6 0,3 -4.5,6 -3,1 -7,-2 -2,-2" fill="#FAC775" stroke="#9C4F35" strokeWidth="1"/>
        </g>
        <text x="470" y="115" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="10" fontWeight="500" fill="#3E2418">Eating Spot</text>

        {/* ENTRANCE */}
        <g filter="url(#softShadow)">
          <path d="M 525 20 L 605 20 L 605 100 L 525 100 Q 525 60 525 20 Z" fill="#9C7654" stroke="#5C3A24" strokeWidth="2"/>
          <line x1="525" y1="40" x2="605" y2="40" stroke="#7A5A3A" strokeWidth="0.5"/>
          <line x1="525" y1="60" x2="605" y2="60" stroke="#7A5A3A" strokeWidth="0.5"/>
          <line x1="525" y1="80" x2="605" y2="80" stroke="#7A5A3A" strokeWidth="0.5"/>
          <path d="M 550 60 Q 550 45 565 45 Q 580 45 580 60 L 580 95 L 550 95 Z" fill="#3E2418" stroke="#5C3A24" strokeWidth="1.5"/>
          <circle cx="575" cy="75" r="1.5" fill="#FAC775"/>
          <rect x="543" y="92" width="42" height="6" fill="#7DAE54" rx="1"/>
        </g>
        <text x="565" y="115" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="10" fontWeight="500" fill="#3E2418">Entrance</text>

        {/* CORRIDOR (V1 STYLE: right side, between entrance and dining) */}
        <g filter="url(#softShadow)">
          <rect x="525" y="130" width="100" height="140" fill="#C9B89A" stroke="#5C3A24" strokeWidth="2" strokeDasharray="4 3" rx="4"/>
          <line x1="525" y1="165" x2="625" y2="165" stroke="#9C8A6E" strokeWidth="0.6" opacity="0.6"/>
          <line x1="525" y1="200" x2="625" y2="200" stroke="#9C8A6E" strokeWidth="0.6" opacity="0.6"/>
          <line x1="525" y1="235" x2="625" y2="235" stroke="#9C8A6E" strokeWidth="0.6" opacity="0.6"/>
          <line x1="575" y1="130" x2="575" y2="270" stroke="#9C8A6E" strokeWidth="0.6" opacity="0.6"/>
          {/* Lamp post */}
          <line x1="615" y1="148" x2="615" y2="135" stroke="#5C3A24" strokeWidth="1.5"/>
          <circle cx="615" cy="133" r="3" fill="#FAC775" opacity="0.8"/>
          {/* Cat paw prints */}
          <g fill="#8B6648" opacity="0.45">
            <ellipse cx="555" cy="180" rx="2.5" ry="3"/>
            <circle cx="553" cy="176" r="1.2"/>
            <circle cx="557" cy="176" r="1.2"/>
            <ellipse cx="595" cy="210" rx="2.5" ry="3"/>
            <circle cx="593" cy="206" r="1.2"/>
            <circle cx="597" cy="206" r="1.2"/>
            <ellipse cx="560" cy="245" rx="2.5" ry="3"/>
            <circle cx="558" cy="241" r="1.2"/>
            <circle cx="562" cy="241" r="1.2"/>
          </g>
        </g>
        <text x="575" y="158" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fontWeight="500" fill="#5C3A24">~ Corridor ~</text>
        <text x="575" y="172" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="9" fontStyle="italic" fill="#8B6648">where cats roam</text>
        {/* Star for corridor */}
        <g transform="translate(605, 145)">
          <polygon points="0,-7 2,-2 7,-2 3,1 4.5,6 0,3 -4.5,6 -3,1 -7,-2 -2,-2" fill="#FAC775" stroke="#9C4F35" strokeWidth="1"/>
        </g>

        {/* DINING AREA (compact, between corridor and chilling) */}
        <g filter="url(#softShadow)">
          <ellipse cx="455" cy="320" rx="65" ry="40" fill="#9FB89A" opacity="0.5"/>
          <ellipse cx="455" cy="322" rx="42" ry="26" fill="#A87850" stroke="#5C3A24" strokeWidth="2"/>
          <ellipse cx="455" cy="318" rx="36" ry="20" fill="#B89466"/>
          <circle cx="455" cy="298" r="3" fill="#FAC775" opacity="0.8"/>
          <circle cx="450" cy="302" r="2" fill="#FAC775" opacity="0.7"/>
          <circle cx="460" cy="302" r="2" fill="#FAC775" opacity="0.7"/>
          <line x1="455" y1="285" x2="455" y2="295" stroke="#5C3A24" strokeWidth="0.8"/>
          <rect x="412" y="312" width="10" height="14" fill="#7A5A3A" rx="1"/>
          <rect x="488" y="312" width="10" height="14" fill="#7A5A3A" rx="1"/>
          <rect x="412" y="324" width="10" height="14" fill="#7A5A3A" rx="1"/>
          <rect x="488" y="324" width="10" height="14" fill="#7A5A3A" rx="1"/>
        </g>
        <text x="455" y="358" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fontWeight="500" fill="#3E2418">Dining Area</text>

        {/* CHILLING SPOT (= LIVING ROOM, full bottom-right) */}
        <g filter="url(#softShadow)">
          <rect x="395" y="380" width="230" height="100" fill="#7A5A3A" stroke="#5C3A24" strokeWidth="2" rx="4"/>
          <rect x="591" y="394" width="28" height="38" fill="#5C3A24" stroke="#3E2418" strokeWidth="1"/>
          <rect x="595" y="406" width="20" height="22" fill="#3E2418"/>
          <ellipse cx="605" cy="422" rx="7" ry="5" fill="#FAC775"/>
          <ellipse cx="605" cy="418" rx="5" ry="4" fill="#EF9F27"/>
          <ellipse cx="605" cy="416" rx="3" ry="2.5" fill="#FAF3E7"/>
          <rect x="410" y="405" width="34" height="28" fill="#9C4F35" stroke="#5C3A24" strokeWidth="1.5" rx="3"/>
          <rect x="410" y="398" width="10" height="20" fill="#9C4F35" stroke="#5C3A24" strokeWidth="1.5" rx="2"/>
          <rect x="410" y="445" width="34" height="28" fill="#9C4F35" stroke="#5C3A24" strokeWidth="1.5" rx="3"/>
          <rect x="410" y="438" width="10" height="20" fill="#9C4F35" stroke="#5C3A24" strokeWidth="1.5" rx="2"/>
          <rect x="465" y="425" width="60" height="14" fill="#A87850" stroke="#5C3A24" strokeWidth="1" rx="2"/>
        </g>
        <text x="510" y="495" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fontWeight="500" fill="#FAF3E7">Chilling Spot</text>
        <text x="510" y="508" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="9" fontStyle="italic" fill="#FAF3E7" opacity="0.85">(living area)</text>

        {/* BALCONY (5 plants - v2 retained) */}
        <g filter="url(#softShadow)">
          <rect x="180" y="510" width="200" height="55" fill="#A8A29A" stroke="#5C3A24" strokeWidth="2" rx="3"/>
          <line x1="220" y1="510" x2="220" y2="565" stroke="#7A7570" strokeWidth="0.6" opacity="0.6"/>
          <line x1="260" y1="510" x2="260" y2="565" stroke="#7A7570" strokeWidth="0.6" opacity="0.6"/>
          <line x1="300" y1="510" x2="300" y2="565" stroke="#7A7570" strokeWidth="0.6" opacity="0.6"/>
          <line x1="340" y1="510" x2="340" y2="565" stroke="#7A7570" strokeWidth="0.6" opacity="0.6"/>
          <line x1="180" y1="538" x2="380" y2="538" stroke="#7A7570" strokeWidth="0.6" opacity="0.6"/>
        </g>
        <text x="280" y="555" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fontWeight="500" fill="#3E2418">🌿 Balcony 🌿</text>
        <g transform="translate(225, 555)">
          <polygon points="0,-7 2,-2 7,-2 3,1 4.5,6 0,3 -4.5,6 -3,1 -7,-2 -2,-2" fill="#FAC775" stroke="#9C4F35" strokeWidth="1"/>
        </g>

        {/* PULSING DOTS for cats currently on air */}
        {Object.entries(catsAtSpot).map(([spot, spotCats]) => {
          const coord = spotCoords[spot];
          if (!coord) return null;
          const labelText = spotCats.map(c => c.name).join(', ');
          return (
            <g key={spot} transform={`translate(${coord.x}, ${coord.y})`}>
              <circle r="6" fill="#7DAE54" className="svg-pulse-ring"/>
              <circle r="6" fill="#7DAE54" className="svg-pulse-dot"/>
              <circle r="3" fill="#FAF3E7"/>
              <g transform="translate(10, -2)">
                <rect x="0" y="-6" width={labelText.length * 5 + 12} height="12" fill="#7DAE54" rx="6"/>
                <text x="6" y="3" fontFamily="Inter, sans-serif" fontSize="8" fontWeight="600" fill="#FAF3E7">
                  {labelText}
                </text>
              </g>
            </g>
          );
        })}

        <text x="20" y="14" fontFamily="Fraunces, serif" fontSize="9" fontStyle="italic" fill="#8B6648">~ home sweet home ~</text>
      </svg>
    </div>
  );
}

function SpotList({ spotCounts, maxCount }) {
  const sorted = SPOTS.map(s => ({ name: s, count: spotCounts[s] || 0 })).sort((a, b) => b.count - a.count);
  return (
    <div style={{ background: PALETTE.cream, border: `1px solid ${PALETTE.creamDeep}`, borderRadius: '16px', padding: '16px' }}>
      <span className="serif" style={{ fontSize: '15px', fontWeight: 600, color: PALETTE.terracottaDeep, display: 'block', marginBottom: '12px' }}>Ranked by visits</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sorted.map((s, i) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '20px', fontSize: '11px', color: i < 3 ? PALETTE.terracottaDeep : PALETTE.brownLight, fontWeight: i < 3 ? 600 : 400 }}>{i + 1}</span>
            <span style={{ flex: 1.4, fontSize: '12px', color: PALETTE.brown, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <div style={{ flex: 2, height: '6px', background: PALETTE.creamDeep, borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${maxCount ? (s.count / maxCount) * 100 : 0}%`, background: i === 0 ? PALETTE.terracotta : PALETTE.terracottaSoft, borderRadius: '3px' }} />
            </div>
            <span style={{ width: '28px', fontSize: '11px', color: PALETTE.brownSoft, textAlign: 'right' }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoBlog({ photos, cats, onPhotoClick, onUpload }) {
  const [filterCat, setFilterCat] = useState('all');
  const filtered = filterCat === 'all' ? photos : photos.filter(p => p.catName === filterCat);
  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button onClick={() => setFilterCat('all')} style={{
          padding: '6px 12px', background: filterCat === 'all' ? PALETTE.terracotta : PALETTE.creamDeep,
          color: filterCat === 'all' ? PALETTE.cream : PALETTE.brown,
          border: 'none', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
        }}>All cats</button>
        {CATS.map(c => (
          <button key={c} onClick={() => setFilterCat(c)} style={{
            padding: '6px 12px', background: filterCat === c ? PALETTE.terracotta : PALETTE.creamDeep,
            color: filterCat === c ? PALETTE.cream : PALETTE.brown,
            border: 'none', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
          }}>{c}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ background: PALETTE.cream, border: `2px dashed ${PALETTE.creamDeep}`, borderRadius: '16px', padding: '60px 20px', textAlign: 'center', color: PALETTE.brownSoft }}>
          <ImageIcon size={32} style={{ opacity: 0.5, marginBottom: '12px' }} />
          <div className="serif" style={{ fontSize: '15px', marginBottom: '6px' }}>No photos yet for {filterCat === 'all' ? 'any cat' : filterCat}</div>
          <div style={{ fontSize: '12px', marginBottom: '14px' }}>Upload a photo to check a cat in</div>
          {filterCat !== 'all' && (
            <button onClick={() => onUpload(filterCat)} style={{
              background: PALETTE.terracotta, color: PALETTE.cream, border: 'none',
              borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <Camera size={14} /> Upload photo of {filterCat}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {filtered.map(p => {
            const realIdx = (cats[p.catName].photos || []).findIndex(cp => cp.id === p.id);
            return (
              <div key={p.id} onClick={() => onPhotoClick(p.catName, realIdx)} style={{
                aspectRatio: '1', background: `url(${p.src}) center/cover`,
                borderRadius: '12px', cursor: 'pointer', position: 'relative',
                overflow: 'hidden', border: `1px solid ${PALETTE.creamDeep}`,
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)' }} />
                <div style={{ position: 'absolute', bottom: '8px', left: '10px', right: '10px', color: '#fff' }}>
                  <div className="serif" style={{ fontSize: '13px', fontWeight: 600 }}>{p.catName}</div>
                  <div style={{ fontSize: '10px', opacity: 0.85 }}>{p.spot} · {formatTimeAgo(p.ts)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SpotlightModal({ cat, onClose, onUpload, onEditProfile, onCheckOut, onPhotoClick }) {
  const isLive = cat.isCheckedIn;
  const sortedSpots = Object.entries(cat.spotCounts || {}).sort((a,b) => b[1] - a[1]).slice(0, 5);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(50, 30, 18, 0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: '20px', backdropFilter: 'blur(4px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: PALETTE.cream, borderRadius: '20px',
        maxWidth: '480px', width: '100%', maxHeight: '90vh', overflow: 'auto', position: 'relative',
      }}>
        <div style={{
          height: '180px',
          background: `radial-gradient(circle at center top, ${PALETTE.spotlight} 0%, ${PALETTE.creamWarm} 70%)`,
          borderRadius: '20px 20px 0 0', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%',
            width: '32px', height: '32px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} color={PALETTE.brown} />
          </button>
          <Star size={140} fill={PALETTE.terracottaSoft} stroke={PALETTE.terracotta} style={{ position: 'absolute', opacity: 0.25 }} />
          <div onClick={onEditProfile} style={{
            position: 'relative', width: '120px', height: '120px', borderRadius: '50%',
            background: cat.photo ? `url(${cat.photo}) center/cover` : PALETTE.creamDeep,
            border: `4px solid ${isLive ? PALETTE.onAir : PALETTE.creamDeep}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: PALETTE.terracottaDeep, fontSize: '40px', fontWeight: 600, fontFamily: 'Fraunces, serif',
            boxShadow: isLive ? `0 0 0 8px ${PALETTE.onAirGlow}` : `0 4px 20px rgba(92,58,36,0.15)`,
            cursor: 'pointer',
          }} className={isLive ? 'pulse-ring' : ''}>
            {!cat.photo && cat.name[0]}
            <div style={{
              position: 'absolute', bottom: '-2px', right: '-2px',
              background: PALETTE.terracotta, color: PALETTE.cream, borderRadius: '50%',
              width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${PALETTE.cream}`,
            }}>
              <Camera size={14} />
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px 24px' }}>
          <div style={{ textAlign: 'center', marginTop: '-8px', marginBottom: '14px' }}>
            <h2 className="serif" style={{ fontSize: '28px', fontWeight: 600, color: PALETTE.terracottaDeep, margin: '0 0 4px' }}>{cat.name}</h2>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '999px',
              background: isLive ? 'rgba(125, 174, 84, 0.18)' : 'rgba(92, 58, 36, 0.08)',
              fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: isLive ? PALETTE.onAir : PALETTE.brownLight,
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isLive ? PALETTE.onAir : PALETTE.brownLight }} className={isLive ? 'pulse-ring' : ''} />
              {isLive ? 'On air now' : 'Away'}
            </div>
            <div style={{ fontSize: '12px', color: PALETTE.brownSoft, marginTop: '6px' }}>
              {cat.lastSpot ? `Last seen at ${cat.lastSpot} · ${formatTimeAgo(cat.lastSeen)}` : 'No sightings yet'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[
              { lab: 'Today', val: cat.visits?.day || 0 },
              { lab: 'Month', val: cat.visits?.month || 0 },
              { lab: 'Year', val: cat.visits?.year || 0 },
              { lab: 'All time', val: cat.visits?.total || 0 },
            ].map(v => (
              <div key={v.lab} style={{ flex: 1, textAlign: 'center', background: PALETTE.creamDeep, borderRadius: '10px', padding: '10px 4px' }}>
                <div className="serif" style={{ fontSize: '20px', fontWeight: 600, color: PALETTE.brown }}>{v.val}</div>
                <div style={{ fontSize: '9px', color: PALETTE.brownSoft, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>{v.lab}</div>
              </div>
            ))}
          </div>
          {sortedSpots.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: PALETTE.brownSoft, marginBottom: '8px' }}>Favourite spots</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {sortedSpots.map(([name, count], i) => (
                  <span key={name} style={{
                    padding: '4px 10px', borderRadius: '999px',
                    background: i === 0 ? PALETTE.terracotta : PALETTE.creamDeep,
                    color: i === 0 ? PALETTE.cream : PALETTE.brown,
                    fontSize: '11px', fontWeight: 500,
                  }}>{name} · {count}</span>
                ))}
              </div>
            </div>
          )}
          {(cat.photos || []).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: PALETTE.brownSoft, marginBottom: '8px' }}>Recent photos</div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {cat.photos.slice(0, 8).map((p, idx) => (
                  <div key={p.id} onClick={() => onPhotoClick(idx)} style={{
                    width: '64px', height: '64px', flexShrink: 0,
                    background: `url(${p.src}) center/cover`, borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${PALETTE.creamDeep}`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onUpload} style={{
              flex: 1, background: PALETTE.terracotta, color: PALETTE.cream, border: 'none',
              borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <Camera size={14} /> {isLive ? 'Add photo' : 'Check in'}
            </button>
            {isLive && (
              <button onClick={onCheckOut} style={{
                flex: 1, background: 'transparent', color: PALETTE.brown,
                border: `1px solid ${PALETTE.brownLight}`, borderRadius: '10px', padding: '10px',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
                <LogOut size={14} /> Check out
              </button>
            )}
            <button onClick={onEditProfile} style={{
              background: 'transparent', color: PALETTE.brownSoft,
              border: `1px solid ${PALETTE.creamDeep}`, borderRadius: '10px', padding: '10px 14px',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <Edit3 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ catName, onUpload, onManualOnly, onClose }) {
  const [selectedSpot, setSelectedSpot] = useState('Chilling Spot');
  const fileInputRef = useRef(null);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(50, 30, 18, 0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: '20px',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: PALETTE.cream, borderRadius: '16px',
        maxWidth: '420px', width: '100%', padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 className="serif" style={{ margin: 0, fontSize: '18px', color: PALETTE.terracottaDeep, fontWeight: 600 }}>Check in {catName}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: PALETTE.brownSoft, padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', color: PALETTE.brownSoft, display: 'block', marginBottom: '6px' }}>Where is {catName} right now?</label>
          <select value={selectedSpot} onChange={(e) => setSelectedSpot(e.target.value)} style={{
            width: '100%', padding: '10px', background: PALETTE.creamDeep,
            border: 'none', borderRadius: '8px', fontSize: '13px', color: PALETTE.brown, fontFamily: 'inherit',
          }}>
            {SPOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], selectedSpot)} />
        {/* Equal-weight buttons: photo OR no-photo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <button onClick={() => fileInputRef.current?.click()} style={{
            background: PALETTE.terracotta, color: PALETTE.cream,
            border: 'none', borderRadius: '10px', padding: '12px 8px',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            <Camera size={14} /> With photo
          </button>
          <button onClick={() => onManualOnly(selectedSpot)} style={{
            background: PALETTE.brown, color: PALETTE.cream,
            border: 'none', borderRadius: '10px', padding: '12px 8px',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            <LogIn size={14} /> No photo
          </button>
        </div>
        <p style={{ fontSize: '11px', color: PALETTE.brownLight, marginTop: '10px', textAlign: 'center', fontStyle: 'italic' }}>
          Auto check-out kicks in after 3 hr of no activity
        </p>
      </div>
    </div>
  );
}

function ProfileEditModal({ catName, currentPhoto, onSave, onClear, onClose }) {
  const fileInputRef = useRef(null);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(50, 30, 18, 0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: '20px',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: PALETTE.cream, borderRadius: '16px',
        maxWidth: '380px', width: '100%', padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 className="serif" style={{ margin: 0, fontSize: '18px', color: PALETTE.terracottaDeep, fontWeight: 600 }}>{catName}'s profile photo</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: PALETTE.brownSoft, padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '120px', height: '120px', borderRadius: '50%',
            background: currentPhoto ? `url(${currentPhoto}) center/cover` : PALETTE.creamDeep,
            border: `3px solid ${PALETTE.terracottaSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: PALETTE.terracottaDeep, fontSize: '40px', fontWeight: 600, fontFamily: 'Fraunces, serif',
          }}>
            {!currentPhoto && catName[0]}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onSave(e.target.files[0])} />
        <button onClick={() => fileInputRef.current?.click()} style={{
          width: '100%', background: PALETTE.terracotta, color: PALETTE.cream,
          border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px',
        }}>
          <Upload size={14} /> {currentPhoto ? 'Change photo' : 'Upload profile photo'}
        </button>
        {currentPhoto && (
          <button onClick={onClear} style={{
            width: '100%', background: 'transparent', color: PALETTE.brownSoft,
            border: `1px solid ${PALETTE.creamDeep}`, borderRadius: '10px', padding: '9px',
            fontSize: '12px', cursor: 'pointer',
          }}>Remove photo</button>
        )}
      </div>
    </div>
  );
}

function PhotoLightbox({ cat, startIdx, onClose, onDelete }) {
  const [idx, setIdx] = useState(startIdx);
  const photos = cat.photos || [];
  if (!photos[idx]) return null;
  const p = photos[idx];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(20, 12, 8, 0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: '20px',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '700px', maxHeight: '90vh', width: '100%' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '-44px', right: 0,
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
          width: '36px', height: '36px', cursor: 'pointer', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={18} />
        </button>
        <div style={{ background: `url(${p.src}) center/contain no-repeat`, width: '100%', height: '70vh', borderRadius: '12px' }} />
        <div style={{
          marginTop: '12px', padding: '12px 16px',
          background: 'rgba(255,255,255,0.08)', borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff',
        }}>
          <div>
            <div className="serif" style={{ fontSize: '15px', fontWeight: 600 }}>{cat.name}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>{p.spot} · {new Date(p.ts).toLocaleString()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>{idx + 1} / {photos.length}</span>
            <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%',
              width: '32px', height: '32px', cursor: idx === 0 ? 'default' : 'pointer',
              opacity: idx === 0 ? 0.4 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setIdx(Math.min(photos.length - 1, idx + 1))} disabled={idx === photos.length - 1} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%',
              width: '32px', height: '32px', cursor: idx === photos.length - 1 ? 'default' : 'pointer',
              opacity: idx === photos.length - 1 ? 0.4 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => {
              if (window.confirm('Delete this photo?')) {
                onDelete(p.id);
                if (photos.length === 1) onClose();
                else setIdx(Math.max(0, idx - 1));
              }
            }} style={{
              background: 'rgba(220, 80, 60, 0.2)', border: 'none', color: '#ffaaaa',
              borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
