export default function Loading() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', background: '#1e293b', borderRadius: '8px' }} />
        <div style={{ width: '160px', height: '18px', background: '#1e293b', borderRadius: '6px' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: '360px', borderRight: '1px solid #1e2d45', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[100, 80, 140, 100].map((h, i) => (
            <div key={i} style={{ height: `${h}px`, background: '#1e293b', borderRadius: '10px', border: '1px solid #1e2d45' }} />
          ))}
        </div>
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'flex-end' }}>
          {[60, 100, 70, 90].map((w, i) => (
            <div key={i} style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start', width: `${w}%`, height: '48px', background: '#1e293b', borderRadius: '12px' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
