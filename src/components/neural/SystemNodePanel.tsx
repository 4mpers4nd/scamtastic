export default function SystemNodePanel({ onClose }: { onClose?: () => void }) {
  return (
    <aside className="systemNodePanel" aria-label="Scamtastic system neuron">
      {onClose && (
        <button className="neuralPanelClose" type="button" aria-label="Close system node details" onClick={onClose}>
          ×
        </button>
      )}
      <div className="systemNodeLogo" aria-hidden="true">S</div>
      <div className="tag">// SYSTEM NEURON</div>
      <h2>SCAMTASTIC</h2>
      <dl>
        <div><dt>NODE CLASSIFICATION</dt><dd>SYSTEM</dd></div>
        <div><dt>ROLE</dt><dd>NETWORK REPRESENTATIVE</dd></div>
        <div><dt>STATUS</dt><dd>ONLINE</dd></div>
        <div><dt>COORDINATES</dt><dd>0, 0, 0</dd></div>
      </dl>
    </aside>
  );
}
