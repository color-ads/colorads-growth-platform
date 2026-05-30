# ColorADS Growth Platform — Sprint Handoff Completo
**Fecha inicio:** 30 mayo 2026 | **Estado:** MVP live en producción | **Sprint:** Fin de semana completo

---

## 1. CONTEXTO DEL NEGOCIO

### Quién es ColorADS
- **Empresa:** ColorADS (colorads.co) — growth marketing partner especializado en hoteles
- **Modelo:** Agencia que gestiona paid media, social media, influencer marketing y metasearch para hoteles independientes y cadenas boutique
- **Fee de éxito:** 2.5% sobre facturación atribuible al marketing (además de fee fijo mensual)
- **Región:** Colombia + LATAM + USA (mercados objetivo de sus clientes hoteleros)
- **Primer cliente en plataforma:** Hashtag 98 Hotel, El Poblado, Medellín

### El problema que resuelve esta plataforma
Hoy ColorADS usa Looker Studio para reportar a sus clientes. El problema:
- Looker es genérico, no está hecho para hoteles ni para el modelo de growth partner
- No tiene flujo de aprobación de contenidos
- No conecta reservas de Cloudbeds con inversión publicitaria
- No calcula automáticamente el ROI del fee de éxito
- No permite al cliente aprobar el calendario de contenidos
- No tiene analista IA que genere conclusiones y recomendaciones
- No es white-label ni escalable a múltiples hoteles

### La visión del producto
Una plataforma SaaS que en Fase 4 se convierte en white-label vendible a otros growth partners de hoteles en LATAM. ColorADS deja de ser solo agencia y se convierte en plataforma.

---

## 2. URLS Y ACCESOS

| Recurso | URL |
|---------|-----|
| **Live dashboard** | https://colorads-growth-platform.vercel.app/dashboard |
| **Repo GitHub** | https://github.com/color-ads/colorads-growth-platform |
| **Supabase** | https://supabase.com/dashboard/project/elkjtxelbhtnvgertupz |
| **Vercel** | Proyecto: colorads-growth-platform / cuenta: color-ads |
| **Código local Mac** | /tmp/colorads/colorads-growth-platform |
| **Looker actual** | Referencia visual de qué datos son infaltables |
| **Spreadsheet facturación** | https://docs.google.com/spreadsheets/d/1y5kWURg3UwCs5s-xWdH88WJNkJkaPKv2L-zq7DySpkI |

---

## 3. STACK TECNOLÓGICO

```
Frontend:     Next.js 14 (App Router) + TypeScript + Tailwind CSS
UI:           shadcn/ui + Radix UI primitives + Lucide icons
Charts:       Recharts
Database:     Supabase (PostgreSQL)
Auth:         Supabase Auth con Row Level Security
Deploy:       Vercel (auto-deploy desde GitHub main)
Email:        Resend
AI:           Anthropic Claude API (análisis mensual)
```

**Variables de entorno en Vercel (configuradas):**
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅

**Variables pendientes de configurar:**
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `GOOGLE_ADS_CLIENT_ID` / `CLIENT_SECRET` / `DEVELOPER_TOKEN` / `MCC_ID`
- `META_APP_ID` / `META_APP_SECRET`
- `CLOUDBEDS_CLIENT_ID` / `CLOUDBEDS_CLIENT_SECRET`

---

## 4. ARQUITECTURA DEL SISTEMA

### Roles y permisos
```
super_admin (ColorADS team)
  └── Ve y gestiona TODOS los hoteles
  └── Crea growth partners y asigna propiedades
  └── Configura logo, colores, fee por hotel
  └── Accede al benchmark multi-hotel

growth_partner
  └── Ve solo los hoteles que le asignó super_admin
  └── Sube contenidos al calendario
  └── Edita datos manuales y KPIs custom
  └── Conecta APIs por hotel desde su panel
  └── Genera y envía informes mensuales

client (hotel)
  └── Ve SOLO su propiedad
  └── Lee dashboard de performance
  └── Aprueba/rechaza contenidos con comentario
  └── Descarga informe mensual PDF
  └── NO ve datos de otros hoteles
```

### Modelo de datos (Supabase)
```
profiles          — usuarios (extiende auth.users)
properties        — hoteles (logo, colores, fee, API tokens)
property_access   — relación usuario ↔ hotel
booking_sources   — fuentes Cloudbeds configurables por hotel
monthly_reports   — KPIs + breakdowns por mes (JSONB para flexibilidad)
content_items     — piezas del calendario con flujo de aprobación
alerts            — alertas de rendimiento por hotel
```

### RLS (Row Level Security)
- Cada usuario solo puede leer/escribir datos de los hoteles a los que tiene acceso
- Super admin bypassa todas las restricciones
- Clientes solo pueden leer + aprobar/rechazar contenidos

---

## 5. PROTOTIPO COMPLETO — MÓDULOS A DESARROLLAR

### MÓDULO 1: DASHBOARD DE PERFORMANCE ✅ (MVP live)

**Vista del cliente — página principal**

**Header:**
- Logo del hotel (configurable desde admin)
- "Informe de gestión Venta Directa · H98"
- Selector de mes (ene / feb / mar / abr / ... navegable)
- Badge "APIs activas" con punto verde
- Logo ColorADS

**Bloque A — Hero KPIs (5 tarjetas)**
```
[Huéspedes]  [Noches]  [Inversión total]  [Coste publicitario %]  [Facturación atribuible]
   7K           9.9K       $20.9M              14.9%                    $140.4M
  +8% vs ant   estancia 1.4  acumulado        −1.4pp eficiencia        +14.9% vs mes ant
```
- Facturación atribuible tiene borde top del color primario del hotel
- Todos los deltas calculados vs mes anterior automáticamente

**Bloque B — Histórico 1: Facturación atribuible vs total hotel**
- Barras AGRUPADAS por mes (16 meses visibles)
- Barra gris = facturación total del hotel
- Barra color primario = facturación atribuible al marketing
- Tooltip muestra % de participación directa
- Línea de tendencia superpuesta
- KPIs encima: mes actual, acumulado, mejor mes, ROAS promedio

**Bloque C — Histórico 2: Volumen de reservas + nº reservas**
- Barras del color secundario = volumen en COP
- Línea punteada = número de reservas (eje derecho)
- Cuando barras suben más que línea = ticket promedio creciendo
- KPIs encima: volumen mes, nº reservas, ticket promedio, noches/reserva

**Bloque D — Inversión por canal**
- Google Ads: inversión, clics, CPC, ROAS
- Meta Ads: inversión, impresiones, alcance
- Contenido: inversión, nº piezas
- Honorarios: fee gestión + fee éxito
- Barra de proporción visual para cada canal
- Punto de estado (verde=API conectada, amarillo=manual)

**Bloque E — ROAS por campaña Google**
- Search Brand → ROAS, inversión, clics, CPC
- Broad Category → mismo desglose
- Narrow Category → mismo desglose
- Pmax/Display → mismo desglose
- Barra horizontal proporcional al ROAS máximo
- Color del hotel

**Bloque F — Perfil demográfico del canal**

*Separador visual "Perfil demográfico del canal"*

- **Estado de reservas** (donut): Checked out, Confirmado, Cancelado, No show, Hospedado
- **Antelación de reservas** (donut): 30+ días, 10-30, 6-9, 1-5, Último minuto
- **Venta × país** (barras horizontales): USA, Colombia, Puerto Rico, México, Rep. Dom., Venezuela
- **Venta × categoría habitación** (ranking con barras): top 10 habitaciones por revenue

**Bloque G — Tabla histórica consolidada**
```
Mes | Facturación atribuible | Nº reservas | Volumen reservas | Ticket prom | ROAS | Impr | Clics | CPC
```
- Fila de totales al final
- ROAS coloreado: verde ≥7×, amarillo ≥5×, rojo <5×
- Sticky header y footer

**Bloque H — Conclusiones IA**
- Análisis generado por Claude API con los datos del mes
- 3 tipos de insight:
  - 🟢 Positivo: logros y puntos fuertes
  - 🟡 Atención: áreas de mejora o alertas
  - 🔵 Estratégico: recomendación para el mes siguiente
- Botón "Regenerar análisis"

**Bloque I — Hitos del mes**
- Lista de logros, trabajos realizados, pendientes
- Estados: ✅ Completado, ⏳ En progreso, ⭐ Destacado
- Editable por growth partner desde admin

**Bloque J — ROI del fee de éxito**
- Facturación atribuible / Inversión total / ROAS / Fee de éxito calculado
- "Por cada $1 invertido se generaron $X.X en ventas"
- Historial del fee acumulado

---

### MÓDULO 2: CALENDARIO DE CONTENIDOS 🔴 (pendiente)

**Vista growth partner (admin):**
- Crear piezas de contenido con: título, descripción, fecha, plataforma (Instagram/Facebook/TikTok)
- Upload de video (reel) o imagen (carrusel/story/post)
- Asignar estado inicial: borrador → pendiente de aprobación
- Vista mensual tipo calendario con piezas posicionadas por fecha
- Vista lista alternativa

**Vista cliente:**
- Ve el calendario del mes con todas las piezas programadas
- Cada pieza tiene:
  - Thumbnail o reproductor de video embebido
  - Título y descripción
  - Fecha de publicación programada
  - Plataforma (ícono Instagram/Facebook/etc)
  - Botones: ❤️ Aprobar | ✏️ Pedir ajuste (con caja de comentario)
- Estados visuales: 
  - ⚪ Borrador
  - 🟡 Pendiente aprobación
  - ✅ Aprobado
  - 🔴 Rechazado (con comentario visible)
  - 🟢 Publicado
- Cuando hay piezas pendientes → badge amarillo en sidebar + email automático al cliente

**Historial de aprobaciones:**
- Por mes, quién aprobó/rechazó qué y cuándo
- Comentarios del cliente guardados

---

### MÓDULO 3: INFORME MENSUAL PDF 🔴 (pendiente)

- PDF branded con logo y colores del hotel (no genérico)
- Incluye todos los bloques del dashboard en formato presentación
- Portada con foto del hotel, nombre, período
- Resumen ejecutivo generado por IA (2-3 párrafos)
- Todas las gráficas del dashboard exportadas
- Conclusiones y plan de acción mes siguiente
- Pie de página: powered by colorADS
- Botón "Descargar PDF" en el dashboard
- Botón "Enviar por email al equipo del hotel"

---

### MÓDULO 4: ADMIN PANEL 🔴 (pendiente)

**Super Admin (ColorADS):**

*Gestión de propiedades:*
- Lista de todos los hoteles con estado (activo/inactivo)
- Crear nuevo hotel: nombre, ubicación, slug, logo, color primario, color secundario, fee%
- Preview en tiempo real de cómo queda el branding
- Archivar/activar hoteles

*Gestión de usuarios:*
- Lista de growth partners con sus hoteles asignados
- Lista de clientes con su hotel asignado
- Crear usuario: email, nombre, rol, propiedades asignadas
- Revocar acceso
- Invitar por email (link mágico de Supabase)

*Configuración de fuentes de reserva (por hotel):*
- Toggle ON/OFF para cada fuente de Cloudbeds
- Las fuentes ON = atribuibles al marketing = cuentan en facturación atribuible
- Fuentes default: "Sitio web/motor" ✅ | "Central de Reservas" ✅ | "Walk-in" ❌ | "Booking.com" ❌

*Conexión de APIs (por hotel):*
- Cloudbeds: botón "Conectar OAuth" → flujo OAuth → estado conectado/desconectado
- Google Ads: Customer ID del cliente bajo MCC
- Meta Ads: Ad Account ID
- Estado de cada integración con última sincronización

*Canales manuales:*
- Agregar canal custom (ej: TripAdvisor, Metasearch manual)
- Ingresar métricas manualmente por mes
- Aparece en dashboard con etiqueta "manual"

*KPIs custom:*
- Agregar KPIs adicionales que no vienen de APIs
- Configurar nombre, unidad, si es positivo-arriba o positivo-abajo

**Growth Partner:**
- Mismo panel pero solo ve sus hoteles asignados
- Puede editar datos manuales
- No puede crear otros growth partners

---

### MÓDULO 5: ALERTAS INTELIGENTES 🔴 (pendiente)

Alertas automáticas que aparecen en sidebar + email:
- 🔴 **ROAS cae bajo umbral configurado** (ej: <5×)
- 🟡 **Presupuesto mensual >80% consumido** antes de fin de mes
- 🟡 **CPC sube >30%** vs mes anterior
- 🔴 **Reservas directas caen >20%** vs mismo mes año anterior
- 🟡 **Contenido pendiente de aprobación >3 días** sin respuesta del cliente
- 🔴 **API desconectada** (Cloudbeds, Google Ads, Meta)

Configuración: umbrales configurables por hotel desde admin

---

### MÓDULO 6: AUDIENCIAS & KEYWORDS 🔴 (pendiente)

**Google Ads Intelligence:**
- Top keywords por conversión (no solo clics)
- Share of voice vs OTAs en keywords clave ("hoteles en medellín", "hotel el poblado")
- Términos de búsqueda reales que generaron clics
- Desglose geográfico de audiencia (mapa de calor)
- Dispositivo: mobile vs desktop vs tablet
- Hora del día con mayor conversión
- Demografía: edad, género

**Meta Ads Intelligence:**
- Audiencias top por engagement
- Lookalike performance vs prospecting
- Creativos: qué formato performa mejor (reel vs carrusel vs story)
- Desglose geográfico de alcance
- Intereses con mayor CTR

---

### MÓDULO 7: TEMPORALIDAD & COMPARATIVA OTAs 🔴 (fase 3)

**Temporalidad:**
- Calendario de temporadas configurables (alta, media, baja)
- Alertas de fechas clave (Semana Santa, festivos CO, temporada USA)
- Comparativa temporada alta vs baja histórica
- Proyección de demanda basada en histórico

**Comparativa OTAs:**
- % canal directo vs Booking vs Expedia (desde Cloudbeds)
- Evolución mensual del market share directo
- Ahorro en comisiones OTA por canal directo
- "Este mes ahorraste $X.XM en comisiones gracias al canal directo"
- Paridad de precios: precio directo vs precio en OTAs

---

### MÓDULO 8: BENCHMARK MULTI-HOTEL 🔴 (fase 3, solo super_admin)

- Vista agregada de todos los hoteles en cartera
- ROAS promedio de la cartera vs benchmark del sector
- Qué hotel está performando mejor y por qué
- Detecta patrones replicables entre hoteles similares
- CPC promedio por ciudad / categoría de hotel
- Dashboard ejecutivo de ColorADS como growth partner

---

### MÓDULO 9: ANALISTA IA MENSUAL 🔴 (fase 2)

Proceso automático que corre al cerrar cada mes:
1. Lee todos los KPIs del mes (Cloudbeds + Google Ads + Meta)
2. Compara vs mes anterior y vs mismo mes año anterior
3. Detecta anomalías (caídas, spikes, cambios de tendencia)
4. Genera narrativa en lenguaje del cliente (no técnico)
5. Produce 3 insights: positivo, atención, estratégico
6. Recomienda presupuesto y estrategia del mes siguiente
7. Genera resumen ejecutivo de 2-3 párrafos para el PDF

Implementación: Anthropic Claude API con todos los datos como contexto

---

## 6. ESTADO ACTUAL DEL CÓDIGO

### Archivos existentes
```
src/types/index.ts              ✅ Tipos completos (Property, MonthlyReport, ContentItem, etc.)
src/lib/utils.ts                ✅ formatCOP, formatROAS, calcSuccessFee, getDelta, etc.
src/lib/mock-data.ts            ⚠️  Datos mock H98 — PENDIENTE CORRECCIÓN con datos reales
src/lib/supabase/client.ts      ✅ Browser Supabase client
src/lib/supabase/server.ts      ✅ Server + Admin Supabase client
src/app/page.tsx                ✅ Redirect a /dashboard
src/app/layout.tsx              ✅ Root layout
src/app/dashboard/page.tsx      ✅ Dashboard principal (usa mock data)
src/components/dashboard/
  Sidebar.tsx                   ✅ Nav lateral con branding configurable
  KPIStrip.tsx                  ✅ 5 KPIs hero con deltas
  HistoricalCharts.tsx          ✅ Gráficas atribuible vs total + reservas
  DemographicProfile.tsx        ✅ Donuts + geo + habitaciones + tabla
  InsightsPanel.tsx             ✅ Conclusiones + hitos + ROI fee
supabase/schema.sql             ⚠️  PENDIENTE CORRER en Supabase SQL Editor
next.config.ts                  ✅ ignoreBuildErrors + eslint disabled
```

### Archivos por crear
```
src/lib/api/
  cloudbeds.ts                  🔴 Integración Cloudbeds API
  google-ads.ts                 🔴 Integración Google Ads MCC API
  meta-ads.ts                   🔴 Integración Meta Business API

src/app/api/
  cloudbeds/route.ts            🔴 Endpoint sync reservas
  google/route.ts               🔴 Endpoint sync Google Ads
  meta/route.ts                 🔴 Endpoint sync Meta Ads
  reports/generate/route.ts     🔴 Generar análisis IA

src/components/
  calendar/                     🔴 Módulo calendario completo
  admin/                        🔴 Admin panel
  ui/                           🔴 Primitivos UI (Button, Card, Badge, etc.)

src/app/
  dashboard/
    contenidos/page.tsx         🔴 Calendario de contenidos
    historico/page.tsx          🔴 Vista histórico expandida
    audiencias/page.tsx         🔴 Audiencias y keywords
    google-ads/page.tsx         🔴 Detalle Google Ads
    meta-ads/page.tsx           🔴 Detalle Meta Ads
    informe/page.tsx            🔴 Informe mensual + PDF
  admin/
    page.tsx                    🔴 Panel super admin
    hoteles/page.tsx            🔴 Gestión hoteles
    usuarios/page.tsx           🔴 Gestión usuarios
  auth/
    login/page.tsx              🔴 Login page
```

---

## 7. DATOS MOCK — CORRECCIONES PENDIENTES

El cliente (ColorADS) indicó que los datos no están bien. Comparar con:
- Spreadsheet real: https://docs.google.com/spreadsheets/d/1y5kWURg3UwCs5s-xWdH88WJNkJkaPKv2L-zq7DySpkI
- Looker actual de H98 (screenshot disponible en conversación)

**Datos que estaban en el Looker (referencia):**
- Huéspedes totales: 7 mil (acumulado)
- Noches totales: 9.9 mil (acumulado)
- Inversión total: 384 M (acumulado)
- Coste publicitario: 10.6% (acumulado)
- Facturación total atribuible: 3.448 M (acumulado)

**Meses en el Looker (facturación atribuible):**
ene25: $209M | feb25: $376M | mar25: $258M | abr25: $164M | may25: $197M | jun25: $276M | jul25: $283M | ago25: $296M | sep25: $228M

**Venta por país:**
USA: $1.909M | Colombia: $790M | Puerto Rico: $548M | México: $226M | Rep. Dom.: $173M | Venezuela: $85M

**Estado reservas:** Checked out 54.5% | Confirmado 19.2% | Cancelado 16.3% | No show 4.9% | Hospedado 5.1%

**Antelación:** 30+ días 53.8% | 10-30 días 13.8% | 6-9 días 14.2% | 1-5 días 13.2% | Último minuto 5%

---

## 8. INTEGRACIONES — PLAN DE IMPLEMENTACIÓN

### Cloudbeds API
```
Base URL: https://hotels.cloudbeds.com/api/v1.1/
Auth: OAuth 2.0 (access_token + refresh_token)
Endpoints clave:
  GET /getReservations — todas las reservas con filtros de fecha y fuente
  GET /getHotelDetails — info del hotel
Flujo de validación:
  1. Pull reservas de un mes
  2. Filtrar por fuentes atribuibles (configuradas en admin)
  3. Sumar facturación
  4. Comparar con dato del Looker actual
  5. Si diferencia < 2% → verde, continuar
  6. Si diferencia > 2% → debug filtros de fuentes
```

### Google Ads MCC API
```
Library: google-ads-api (npm)
Auth: OAuth 2.0 con refresh_token del MCC
Métricas a traer:
  - metrics.impressions, metrics.clicks, metrics.cost_micros
  - metrics.conversions (NO mostrar — siempre da negativo)
  - segments.date, campaign.name, campaign.status
  - geographic_view — para mapa de audiencias
  - keyword_view — para top keywords
NO incluir: conversion_value (da negativo según cliente)
```

### Meta Ads API
```
Base URL: https://graph.facebook.com/v18.0/
Auth: System User Access Token (Business Manager)
Endpoints:
  /{ad_account_id}/insights — métricas de campañas
  /{ad_account_id}/ads — creativos con rendimiento
Métricas:
  - reach, impressions, spend, clicks, cpc, cpm
  - age, gender breakdown
  - country breakdown
  - creative (nombre, formato, thumbnail)
```

---

## 9. DECISIONES DE DISEÑO APROBADAS

| Decisión | Resolución |
|----------|-----------|
| Logo del cliente | En sidebar izquierda |
| Colores por hotel | Cambian globalmente (sidebar + acentos + bordes) |
| Rechazo de contenido | Cliente escribe comentario al rechazar |
| Google Ads desglose | Por campaña + keywords + geografía en sección separada |
| Facturación histórica | Barras agrupadas (atribuible vs total) |
| Reservas histórico | Volumen COP + nº reservas en misma gráfica (barras + línea) |
| Tabla histórica | Consolida: nº reservas + volumen + atribuible + total + ticket + ROAS + clics |
| Conversiones Google | NO mostrar (siempre dan negativo) |
| Fuentes atribuibles | Configurables por hotel desde admin (toggle ON/OFF) |
| Walk-in | NO atribuible por defecto, pero influenciado por digital |

---

## 10. COMANDOS ÚTILES

```bash
# Entrar al proyecto
cd /tmp/colorads/colorads-growth-platform

# Correr localmente
npm run dev
# Abre en http://localhost:3000

# Hacer push (Vercel deploya automático en ~30s)
git add -A && git commit -m "descripcion del cambio" && git push

# Ver logs de Vercel en tiempo real
vercel logs colorads-growth-platform --follow

# Correr schema en Supabase (desde terminal)
# Ir a: supabase.com/dashboard/project/elkjtxelbhtnvgertupz/sql
# Pegar contenido de: supabase/schema.sql
```

---

## 11. PRÓXIMOS PASOS EN ORDEN DE PRIORIDAD

1. **Corregir datos mock** — el cliente dijo que no están bien, comparar con spreadsheet real
2. **Correr schema.sql en Supabase** — base de datos lista para datos reales
3. **Integración Cloudbeds** — por etapas con validación antes de continuar
4. **Integración Google Ads MCC** — métricas de campañas en tiempo real
5. **Integración Meta Ads** — alcance e inversión
6. **Módulo calendario de contenidos** — UX aprobación cliente
7. **Admin panel** — configuración logo/color/fuentes/usuarios
8. **Auth completa** — login, roles, RLS funcionando
9. **PDF branded** — informe mensual descargable
10. **Analista IA** — conclusiones automáticas con Claude API
11. **Alertas** — notificaciones inteligentes
12. **Audiencias & Keywords** — inteligencia de canales

---

## 12. NOTAS IMPORTANTES

- **No incluir conversiones de Google Ads** — siempre dan negativo, cliente lo confirmó
- **Facturación atribuible ≠ Facturación total hotel** — son dos métricas distintas con dos gráficas distintas
- **Fuentes atribuibles H98:** "Sitio web o motor de reservas" + "CENTRAL DE RESERVAS - (FULL SERVICE)"
- **Walk-in:** influenciado digitalmente pero no directamente atribuible, se muestra separado
- **El dashboard debe superar Looker** en UX y funcionalidad — ese es el benchmark visual
- **El producto escala** a Fase 4 como SaaS white-label para otros growth partners de hoteles LATAM
- **Supabase proyecto:** elkjtxelbhtnvgertupz — región us-east-1 (mejor latencia Colombia)
- **Framework Vercel:** configurado como Next.js (estaba como "Other" — ya corregido)

