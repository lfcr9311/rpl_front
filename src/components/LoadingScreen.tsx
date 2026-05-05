import splashLogo from "../assets/splash.png"

export function LoadingScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <img
          src={splashLogo}
          alt="Carregando"
          className="splash-logo"
        />
        <div className="splash-title">Carregando mapa</div>
        <div className="splash-subtitle">Buscando áreas, rotas e aerovias...</div>
      </div>
    </div>
  )
}