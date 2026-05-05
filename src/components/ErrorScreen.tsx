export function ErrorScreen({
  error,
  onRetry
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="screen-center">
      <div className="error-box">
        <div>Falha ao carregar.</div>
        {error ? <div>{error}</div> : null}
        <button className="btn btn-primary" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    </div>
  )
}