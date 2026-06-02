# ColorADS Growth Platform — Arquitectura

Dashboard de **gestión de venta directa** para hoteles, construido por ColorADS.
Toma datos del PMS (Cloudbeds), los cruza con la inversión en marketing y muestra
facturación atribuible, ROAS, demografía y venta por país — todo calculado desde
la fuente, sin planillas manuales.

Primer tenant en producción: **Hashtag 98 Hotel (H98)** · El Poblado, Medellín.

- **Repo:** `github.com/color-ads/colorads-growth-platform`
- **Dashboard:** https://colorads-growth-platform.vercel.app/dashboard
- **Admin:** `/admin` · **Login:** `/login`
- **Dev local:** `/tmp/colorads/colorads-growth-platform`

---

## 1. Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| Lenguaje | TypeScript (strict) |
| UI | Tailwind, Recharts |
| Auth + DB | Supabase (Postgres + Auth + RLS) |
| Hosting | Vercel (auto-deploy desde `main`) |
| Datos de hotel | Cloudbeds **Data Insights API** + **PMS API v1.2** |

El dashboard es **server-rendered** (`export const dynamic = 'force-dynamic'`): se
recalcula en cada carga, sin caché, para reflejar siempre el último dato.

---

## 2. Variables de entorno

Se configuran en **Vercel → Project → Settings → Environment Variables**.
**Nunca** se commitean al repo (por eso este doc solo lista nombres).

| Variable | Uso | Sensible |
|---|---|---|
| `CLOUDBEDS_API_KEY` | Bearer token de Cloudbeds (Data Insights + PMS). Atada a la propiedad. | 🔴 Sí |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave *publishable* de Supabase (para el login en el browser). | Pública (protegida por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de servicio: **bypassa RLS**. Solo en el servidor (seeds, sync, cron, endpoints admin). | 🔴 Sí |
| `NEXT_PUBLIC_APP_URL` | URL pública del deploy (ej. `https://colorads-growth-platform.vercel.app`). El server la usa para fetchear su propio `/api/cloudbeds/sync`. **Si falta, en prod intenta `localhost:3000` y falla.** | Pública |
| `CRON_SECRET` | Protege `/api/cron/sync-sources`. Si está seteada, Vercel la manda como `Authorization: Bearer …` en cada cron. **Recomendado setearla.** | 🔴 Sí |

> Cloudbeds property ID de H98: **`212206`** (no es secreto; está como fallback en el código).

---

## 3. Fuentes de datos (Cloudbeds)

Hay **dos APIs distintas** de Cloudbeds, y entender la diferencia es clave.

### 3.1 Data Insights API — la fuente de la plata

- Base: `https://api.cloudbeds.com/datainsights/v1.1`
- Auth: header `Authorization: Bearer <CLOUDBEDS_API_KEY>` **+** `X-PROPERTY-ID: 212206`
- Se consultan **"stock reports"** predefinidos (no se puede consultar un dataset
  crudo: `POST /datasets/{id}/query` → 404). Patrón:
  `POST /stock_reports/{id}/query/data?mode=Run`
- El body lleva `property_ids`, `filters.and[]` y `settings`.
- **`settings.details: true` es obligatorio** para obtener filas a nivel registro
  en `records` (dict columna→array). Con `false` el reporte viene agregado/traspuesto.
- La respuesta trae `records` (las columnas) **y `index`** (las dimensiones de
  agrupación del reporte). **Ojo: a veces el dato que buscás está en `index`, no en
  `records`** (ej. el país en el report 34).
- **Operador de lista** (filtrar una columna por varios valores): `list_contains`.
  (`in`, `any`, `contains` → 400.)
- **Paginación de la lista de reportes** (`GET /stock_reports`): `?offset=N&limit=25`.
  (`?page=` se ignora y `?limit=500` da 400.) Hay ~125 reportes.
- Valor `'-'` = dato desconocido/no aplica (se trata como 0 / se excluye).

#### Los 3 reportes que usamos

| Report | Nombre | Dataset | Filtra por | De acá sale |
|---|---|---|---|---|
| **191** | Channel Production | 7 (Occupancy) | `stay_date` | **Facturación** = `room_revenue` por *source*, por fecha de **estadía** |
| **17** | Reservations by Booking Date | 3 (Reservations) | `booking_datetime_property_timezone` | **Booking volume** = `grand_total_amount` por *source*, por fecha de **reserva** + ticket, antelación, estados, tipos de habitación |
| **34** | Production by Guest Country | 3 (Reservations) | `booking_datetime_property_timezone` | **Venta de reservas × país** = `grand_total_amount` por **país**, por fecha de reserva |

**Notas finas por reporte:**

- **191 (facturación):** el filtro usa `multi_level_id: 4` con operador `all` sobre
  `reservation_source` / `reservation_source_category` / `reservation_status`. El
  `index` de cada fila es `[_, category, source]`. Requiere `details: true`.
- **17 (reservas):** sin filtro de estado en la query; las canceladas se descartan
  client-side (la columna `reservation_status` viene en `records`).
- **34 (país):** la columna de país **no** está en `records` (ahí viene
  `primary_guest_city`); **el país está en `index[i][0]`** como nombre en inglés
  (ej. `["United States of America"]`). Como el report **no expone
  `reservation_status` como columna**, las canceladas se excluyen **en la query**
  con `list_contains` (estados sin `Cancelled`). Trae `grand_total_amount` y
  `room_revenue_total_amount` por reserva → la atribución por *source* se hace
  client-side leyendo `records.reservation_source`.

### 3.2 PMS API v1.2 — huéspedes y noches

- Base: `https://hotels.cloudbeds.com/api/v1.2` · Auth: `Bearer <key>` (la propiedad
  va atada a la llave).
- `getReservations` (con `includeGuestsDetails=1`, `pageSize=100`) → por reserva:
  `status`, `dateCreated`, `startDate`/`endDate`, `adults`/`children`, `sourceName`,
  `guestList[].guestCountry`.
- **De acá salen solo Huéspedes y Noches** (filtrando por **check-in** en el mes).
- **Limitaciones (importantes):**
  - Solo expone `balance` (= 0), **no el monto total** de la reserva.
  - El `reservationID` del PMS (~13 dígitos) **no cruza** con el `reservation_id` de
    Data Insights (~9 dígitos): 0 % de match. No se pueden unir por ID.
  - Filtra por check-in, no por fecha de reserva.

Por eso **la plata sale de Data Insights, no del PMS**.

---

## 4. Modelo de datos (Supabase)

### `properties`
Una fila por hotel.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | identificador legible (ej. `h98`) |
| `name`, `location` | text | |
| `primary_color`, `secondary_color` | text | branding del dashboard |
| `success_fee_pct` | numeric | fee de éxito de ColorADS |
| `cloudbeds_property_id` | text | el `X-PROPERTY-ID` del hotel |
| `attributable_sources` | `text[]` | **fuentes que cuentan como venta directa atribuible a marketing** |
| `ota_sources` | `text[]` | fuentes OTA (Booking, Expedia, …) |
| `active`, `google_ads_account_id`, `meta_ad_account_id` | | metadata |

### `monthly_source_revenue`  *(corazón de la facturación)*
Granular: una fila por **(propiedad, año, mes, source)**. RLS activa.
La pueblan el **seed** y el **cron**.

| Columna | Origen |
|---|---|
| `stay_revenue` | report **191** (`room_revenue`, por estadía) |
| `booking_volume` | report **17** (`grand_total_amount`, por reserva) |
| `booking_count` | report 17 (conteo) |
| `category` | `'Direct'` u `'OTA'` |

`UNIQUE(property_id, year, month, source)` → el cron hace `upsert` sobre esa clave.

### `monthly_billing`  *(inputs de marketing)*
Una fila por **(propiedad, año, mes)**. La gestiona el **admin**.

- Inputs: `google_investment`, `meta_investment`, `content_investment`, `fees`,
  `total_investment`, `clicks`, `impressions`, `cpc`.
- Columnas **legacy** `total_revenue`, `roas`, `ad_cost_pct`: se preservan por
  compatibilidad pero **el dashboard ya no las usa** (calcula todo desde
  `monthly_source_revenue`). El admin no las escribe en updates; en inserts las pone en 0.

### `profiles`
Usuarios de Supabase Auth. `role`: `super_admin` | `growth_partner` | `client`.

---

## 5. Cómo se calcula cada número (definiciones canónicas)

> Toda la facturación se computa en `src/app/dashboard/page.tsx` →
> `facturacionForMonth()`, leyendo `monthly_source_revenue`.

| Métrica | Fórmula | Fuente |
|---|---|---|
| **Facturación atribuible** | Σ `stay_revenue` donde `source ∈ attributable_sources` | report 191 (por estadía) |
| **Facturación total hotel** | Σ `stay_revenue` de **todas** las sources | report 191 |
| **ROAS** | `facturación atribuible / total_investment` | — |
| **% coste publicitario** | `total_investment / facturación atribuible × 100` | — |
| **Booking volume** | Σ `booking_volume` atribuible (`grand_total` por reserva) | report 17 |
| **Venta de reservas × país** | Σ `grand_total` por país, atribuible, por reserva, sin canceladas | report 34 |
| **Huéspedes / Noches** | de arribos del PMS (check-in en el mes) | PMS v1.2 |

H98 abril 2026 (validado contra el Looker del hotel): **facturación atribuible
≈ $140.4M**, total hotel ≈ $725.3M, ROAS ≈ 6.7×, coste publicitario ≈ 14.9 %.

### ⚠️ Fecha de reserva vs. fecha de estadía
Es la distinción conceptual más importante del sistema:

- **Facturación** (report 191) es por **estadía** (`stay_date`): ingreso de las
  noches consumidas en el mes.
- **Booking volume** y **Venta × país** (reports 17/34) son por **fecha de reserva**:
  valor de las reservas *creadas* en el mes, aunque la estadía caiga en meses futuros.

Por eso **"Venta de reservas × país" (~$275M atribuible en abril) ≠ Facturación
($140.4M)**: una reserva creada en abril para una estadía de mayo suma completa al
chart de país pero no a la facturación de abril. Las dos están bien; miden cosas
distintas. (El chart se llama "Venta de **reservas** × país" justamente para dejarlo
explícito.)

---

## 6. Flujo de datos

```
                    ┌─────────────────────── Cloudbeds ───────────────────────┐
                    │  Data Insights (reports 191, 17, 34)   PMS v1.2          │
                    └───────┬──────────────────────┬───────────────┬──────────┘
                            │                       │               │
              cron diario   │            page server fetch          │ page server fetch
       /api/cron/sync-sources│         /api/cloudbeds/sync           │ (dentro de sync)
                            ▼                       ▼               ▼
                ┌───────────────────┐   ┌──────────────────────────────────────┐
                │ monthly_source_   │   │  /api/cloudbeds/sync (mes actual)     │
                │ revenue (Supabase)│   │  · report 17 → volumen/ticket/estados │
                └─────────┬─────────┘   │  · PMS → huéspedes/noches             │
                          │             │  · report 34 → venta × país           │
   admin: inversión       │             └───────────────────┬──────────────────┘
   /api/admin/billing      │                                 │
          │               ▼                                  │
          │   ┌────────────────────────────────────────┐    │
          └──▶│  dashboard/page.tsx (server)            │◀───┘
              │  · getSourceData (monthly_source_revenue)│
              │  · getHistoricalReports (monthly_billing)│
              │  · getCurrentMonthReport (sync)          │
              │  · facturacionForMonth() ← OVERRIDE      │
              │    de attributable_revenue / total /     │
              │    roas / ad_cost_pct                    │
              └────────────────────────────────────────┘
```

Detalle clave: el endpoint `/api/cloudbeds/sync` **no** calcula facturación (devuelve
operativos: huéspedes, noches, volumen, países, habitaciones, estados, antelación).
La facturación la calcula `page.tsx` desde `monthly_source_revenue` y **sobreescribe**
los campos del reporte del mes. Por eso el sync no expone `attributableRevenue`.

---

## 7. Autenticación

- **Supabase Auth** (email + password). Registro público **cerrado**: el growth
  partner crea cada usuario en el dashboard de Supabase (Auto Confirm).
- `src/middleware.ts` protege `/admin`, `/admin/:path*` y `/api/admin/:path*`:
  - Sin sesión → API responde `401`; las páginas redirigen a `/login?next=…`.
  - Matcher: `['/admin', '/admin/:path*', '/api/admin/:path*']`
    (el cron y el sync quedan fuera a propósito).
- Los endpoints admin **re-chequean** la sesión con `requireUser()`
  (defensa en profundidad) y usan la service-role key para escribir.

---

## 8. Cron (auto-refresh)

- `GET /api/cron/sync-sources` + `vercel.json` → schedule **`0 6 * * *`** (diario, 06:00 UTC).
- Refresca `monthly_source_revenue` en una **ventana móvil**: `now − 2` a `now + 6`
  meses (los meses viejos quedan "congelados"). Params opcionales `?back=`/`?ahead=`.
- Consulta reports 191 + 17 por mes y hace `upsert`. **Idempotente.**
- Auth: si `CRON_SECRET` está seteada, exige `Authorization: Bearer <CRON_SECRET>`
  (Vercel la manda sola). Si no está seteada, el endpoint queda abierto → **setearla**.

---

## 9. Rutas

| Ruta | Tipo | Qué hace |
|---|---|---|
| `/` | page | redirect a `/dashboard` |
| `/dashboard` | page (server) | informe del mes (hoy fijo: abril 2026) |
| `/admin` | page (auth) | selector de fuentes atribuibles + form de inversión |
| `/login` | page | `signInWithPassword` |
| `/api/cloudbeds/sync` | GET | mes actual desde Cloudbeds (reports 17/34 + PMS) |
| `/api/admin/sources` | GET/POST | leer / guardar `attributable_sources` |
| `/api/admin/billing` | GET/POST | leer / guardar inputs de marketing |
| `/api/cron/sync-sources` | GET | refresca `monthly_source_revenue` |

**Componentes** (`src/components/`): `KPIStrip`, `RevenueExplorer` (2 charts
read-only), `DemographicProfile` (tortas de estado/antelación + venta × país +
categorías de habitación + tabla histórica), `InsightsPanel` + `ChannelBreakdown`,
`Sidebar`, `admin/SourceSelector`.

---

## 10. Deploy

1. `git push origin main`
2. Vercel auto-deploya en ~40 s.

Para validar TypeScript localmente antes de pushear:
`npx next build` (con las env vars, aunque sea dummies para compilar).

---

## 11. Cómo agregar un hotel nuevo (escalar)

El sistema ya es **multi-propiedad a nivel de datos** (todo va por `property_id` /
`slug`). Para sumar un hotel:

1. **Insertar la fila en `properties`**: `slug`, `name`, `location`,
   `cloudbeds_property_id`, colores, `success_fee_pct`, y `attributable_sources` /
   `ota_sources` iniciales.
2. **Llave de Cloudbeds del hotel**: ver limitación abajo — hoy hay **una sola**
   `CLOUDBEDS_API_KEY`. Multi-tenant real requiere una llave por propiedad
   (guardada en `properties` o en un secret store), y que `insights.ts` / `cloudbeds.ts`
   la reciban por parámetro en vez de leer la env global.
3. **Poblar histórico**: correr el cron para ese slug
   (`/api/cron/sync-sources?slug=<slug>&back=18&ahead=6`) para llenar
   `monthly_source_revenue`.
4. **Configurar fuentes atribuibles** desde `/admin` (el `SourceSelector` las marca).
5. **Inversión de marketing**: cargar cada mes desde `/admin`.
6. **Usuario del cliente**: crearlo en Supabase Auth y vincularlo a la propiedad
   (ver `PropertyAccess` en `types/index.ts` — la tabla de vínculo falta crearse).
7. **Parametrizar el dashboard**: hoy `/dashboard` está hardcodeado a `slug='h98'` y
   a abril 2026 — ver tech debt.

---

## 12. Deuda técnica / roadmap

- **Mes y slug hardcodeados.** `dashboard/page.tsx` fija `currentMonth=4`,
  `currentYear=2026` y `slug='h98'` en varios lados. Para producción real: mes
  dinámico ("hoy") y slug resuelto por el usuario logueado.
- **Una sola `CLOUDBEDS_API_KEY`.** Bloquea el multi-tenant verdadero; ver paso 2 de
  arriba (llave por propiedad).
- **Columnas legacy en `monthly_billing`** (`total_revenue`/`roas`/`ad_cost_pct`):
  se pueden dropear cuando se confirme que nada externo las lee.
- **Rol `client` y dashboard multi-tenant**: el enum de roles existe
  (`super_admin`/`growth_partner`/`client`) pero el dashboard cerrado y filtrado por
  hotel para el cliente final no está construido. Falta la tabla `property_access`.
- **Tipos sin implementar**: `AIInsights`, `ContentItem`, `Alert`, `CampaignBreakdown`,
  `Milestone` están definidos en `types/index.ts` como features futuras (insights con
  IA, calendario de contenido, alertas), aún sin backend.

---

*Última actualización: junio 2026. Mantener este doc al día cuando cambien los
reportes de Cloudbeds, el modelo de datos o los cálculos.*
