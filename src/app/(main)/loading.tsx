export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header skeleton */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ width: '100px', height: '18px', background: '#1e293b', borderRadius: '5px', marginBottom: '5px' }} />
            <div style={{ width: '70px', height: '12px', background: '#1e2d45', borderRadius: '4px' }} />
          </div>
          <div style={{ width: '90px', height: '26px', background: '#1e2d45', borderRadius: '999px' }} />
        </div>
        <div style={{ width: '260px', height: '36px', background: '#1e293b', borderRadius: '8px' }} />
      </div>

      {/* Tabs skeleton */}
      <div style={{ display: 'flex', gap: '4px', padding: '8px 24px', borderBottom: '1px solid #1e2d45' }}>
        {[90, 110, 130, 95, 75].map((w, i) => (
          <div key={i} style={{ width: `${w}px`, height: '30px', background: '#1e293b', borderRadius: '7px' }} />
        ))}
      </div>

      {/* Rows skeleton */}
      <div style={{ flex: 1, overflowY: 'hidden' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '12px 24px', borderBottom: '1px solid #1a2a3e',
              opacity: 1 - i * 0.06,
            }}
          >
            {/* Dot */}
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#1e293b', flexShrink: 0 }} />
            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
                <div style={{ width: '150px', height: '13px', background: '#1e293b', borderRadius: '4px' }} />
                <div style={{ width: '60px', height: '13px', background: '#1e2d45', borderRadius: '4px' }} />
              </div>
              <div style={{ width: '220px', height: '11px', background: '#1e2d45', borderRadius: '4px' }} />
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '80px', height: '26px', background: '#1e293b', borderRadius: '6px' }} />
              <div style={{ width: '60px', height: '26px', background: '#1e293b', borderRadius: '6px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
