const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border-color)',
    borderTopColor: 'var(--button-color)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

export default function Spinner() {
  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.spinner} />
    </div>
  );
}
