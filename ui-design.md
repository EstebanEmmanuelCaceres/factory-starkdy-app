# starkDY — Paleta de Colores
> Design System · Sistema de compras · Última actualización: Jul 2026
> Tipografía: **Outfit** (400–900) · Radio base: **16px**

---

## Colores principales

| Rol | Nombre | HEX | RGB | Uso |
|-----|--------|-----|-----|-----|
| Primario · Brand | Rojo starkDY | `#D41515` | rgb(212, 21, 21) | Botones, acentos, precios |
| Secundario · Dark | Negro Sidebar | `#0F0F0F` | rgb(15, 15, 15) | Sidebar, fondo oscuro |
| Base · Surface | Blanco Card | `#FFFFFF` | rgb(255, 255, 255) | Fondo de cards y paneles |

---

## Escala de rojo

| Token | HEX | Uso |
|-------|-----|-----|
| Red 900 | `#7F1D1D` | Fin de gradiente tarjeta de saldo |
| Red 800 | `#991B1B` | Avatares, gradientes |
| Red 700 | `#B91C1C` | Hover de botón primario |
| **Red 600 · Primary** | **`#D41515`** | **Color de marca principal** |
| Red 500 | `#EF4444` | Barras de datos |
| Red 400 | `#F87171` | Charts secundarios |
| Red 300 | `#FCA5A5` | Charts terciarios |
| Red 200 | `#FECACA` | Bordes suaves, hover card |
| Red 100 | `#FEE2E2` | Fondos de badge / botón soft |
| Red 50  | `#FEF2F2` | Fondo ítem activo sidebar |

---

## Neutros & texto

| Token | HEX | Uso |
|-------|-----|-----|
| Ink 900 | `#0F0F0F` | Títulos, sidebar admin |
| Ink 800 | `#141414` | Texto de énfasis |
| Gray 700 | `#374151` | Texto de cuerpo |
| Gray 500 | `#6B7280` | Texto secundario, nav |
| Gray 400 | `#9CA3AF` | Labels, placeholders |
| Gray 200 | `#E5E7EB` | Bordes de inputs |
| Gray 100 | `#F0F0F0` | Bordes de cards |
| Gray 100b | `#F3F4F6` | Botón neutro, tracks |
| Canvas | `#F7F7F7` | Fondo de la app |
| Void | `#0A0A0A` | Fondo selector de rol |

---

## Colores semánticos (estados)

| Token | HEX | Uso |
|-------|-----|-----|
| Éxito | `#16A34A` | Entregado · en stock · activo |
| Info | `#3B82F6` | En camino · métricas |
| Alerta | `#D97706` | Bajo stock · procesando |
| Acento | `#8B5CF6` | Métricas de usuarios |

---

## Botones

| Variante | Background | Color texto | Border | Uso |
|----------|-----------|-------------|--------|-----|
| Primario | `#D41515` | `#FFFFFF` | — | CTA principal |
| Primario hover | `#B91C1C` | `#FFFFFF` | — | Estado hover del primario |
| Soft / Comprar | `#FEF2F2` | `#D41515` | `1.5px #FECACA` | Acción secundaria de compra |
| Neutro | `#F3F4F6` | `#374151` | — | Acciones genéricas |
| Oscuro | `#0F0F0F` | `#FFFFFF` | — | CTAs sobre fondo claro |
| Ghost | `#FFFFFF` | `#6B7280` | `1.5px #E5E7EB` | Acciones terciarias |

---

## Badges & membresías

| Etiqueta | Background | Color texto | Uso |
|----------|-----------|-------------|-----|
| Gold ★ | `#FEF3C7` | `#92400E` | Membresía Gold |
| Silver | `#F1F5F9` | `#475569` | Membresía Silver |
| Bronze | `#FEF0E6` | `#9A3412` | Membresía Bronze |
| Activo · Entregado | `#DCFCE7` | `#166534` | Estado positivo |
| En camino | `#DBEAFE` | `#1E40AF` | Estado en tránsito |
| Procesando | `#FEF3C7` | `#92400E` | Estado intermedio |
| Cancelado · Inactivo | `#FEE2E2` | `#991B1B` | Estado negativo |

---

## Gradientes

| Nombre | Valor CSS | Uso |
|--------|-----------|-----|
| Tarjeta de saldo | `linear-gradient(135deg, #D41515 0%, #7F1D1D 100%)` | Card de saldo / destacada |
| Avatares | `linear-gradient(135deg, #D41515, #991B1B)` | Fondos de avatar de usuario |
| Halo selector de rol | `radial-gradient(circle at 30% 40%, rgba(212,21,21,0.35), #0A0A0A 70%)` | Pantalla selector de rol |

---

## Variables CSS recomendadas

```css
:root {
  /* Brand */
  --color-primary:        #D41515;
  --color-primary-hover:  #B91C1C;
  --color-primary-dark:   #991B1B;
  --color-primary-darker: #7F1D1D;

  /* Red scale */
  --red-500: #EF4444;
  --red-400: #F87171;
  --red-300: #FCA5A5;
  --red-200: #FECACA;
  --red-100: #FEE2E2;
  --red-50:  #FEF2F2;

  /* Neutros */
  --ink-900:   #0F0F0F;
  --ink-800:   #141414;
  --gray-700:  #374151;
  --gray-500:  #6B7280;
  --gray-400:  #9CA3AF;
  --gray-200:  #E5E7EB;
  --gray-100:  #F0F0F0;
  --gray-100b: #F3F4F6;
  --canvas:    #F7F7F7;
  --void:      #0A0A0A;

  /* Semánticos */
  --color-success: #16A34A;
  --color-info:    #3B82F6;
  --color-warning: #D97706;
  --color-accent:  #8B5CF6;

  /* Superficies */
  --surface-card:   #FFFFFF;
  --surface-app:    #F7F7F7;
  --surface-dark:   #0F0F0F;

  /* Radio */
  --radius-base: 16px;
  --radius-btn:  12px;
  --radius-card: 20px;

  /* Tipografía */
  --font-sans: 'Outfit', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```