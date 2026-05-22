export default function Loading() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar skeleton */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ width: '120px', height: '20px', background: '#1e293b', borderRadius: '6px', marginBottom: '6px' }} />
          <div style={{ width: '80px', height: '13px', background: '#1e2d45', borderRadius: '4px' }} />
        </div>
        <div style={{ width: '260px', height: '36px', background: '#1e293b', borderRadius: '8px' }} />
      </div>
      {/* Tabs skeleton */}
      <div style={{ display: 'flex', gap: '6px', padding: '12px 24px', borderBottom: '1px solid #1e2d45' }}>
        {[80, 100, 120, 90, 70].map((w, i) => (
          <div key={i} style={{ width: `${w}px`, height: '32px', background: '#1e293b', borderRadius: '7px' }} />
        ))}
      </div>
      {/* Cards skeleton */}
      <div style={{ flex: 1, padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px', alignContent: 'start' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ height: '120px', background: '#1e293b', borderRadius: '10px', border: '1px solid #1e2d45', opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    </div>
  )
}
