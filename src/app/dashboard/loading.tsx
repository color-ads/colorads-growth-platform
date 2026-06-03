// Pantalla de carga del dashboard. Next la muestra (streaming) mientras el server
// resuelve los datos del mes, incluido el refetch en cada navegacion dura (<a>).
export default function DashboardLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      <h1 className="text-5xl font-semibold tracking-tight text-white">Color<span className="text-amber-500">ADS</span></h1>
      <div className="mt-6 flex items-center gap-3">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-amber-500" />
        <span className="text-sm text-gray-400">Cargando datos...</span>
      </div>
    </div>
  )
}
