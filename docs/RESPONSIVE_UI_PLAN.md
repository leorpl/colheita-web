# Responsive UI Plan

## Goal

Improve tablet/mobile usability across the internal web app without changing core workflows or business rules.

## Current Findings

- Shared shell was desktop-first: topbar, sidebar, dialogs, tables, and filters squeezed too much on narrow screens.
- Summary cards above tables could overflow visually on phones due to typography/padding density.
- Data-heavy screens still need page-specific treatment beyond the shared CSS layer.
- Some tables rely on horizontal scroll; this is acceptable short term, but a few screens should gain small-screen layouts.

## Principles

- Keep desktop productivity intact.
- Prefer shared CSS fixes before one-off page hacks.
- Use progressive adaptation: desktop table -> tablet condensed table -> mobile stacked/card layout only where needed.
- Preserve actions and auditability; do not hide critical controls without an alternative access path.

## Priority Order

### 1. Shared Shell

- Make sidebar off-canvas on mobile with independent scroll and overlay.
- Keep topbar buttons readable/wrapping on smaller screens.
- Make dialogs use full height/width more intelligently on narrow devices.
- Remove decorative/non-essential chrome that steals space.

Status:
- Sidebar off-canvas behavior implemented.
- Topbar wrapping improved.
- Dialog responsiveness improved.
- Sidebar footer legend removed.

### 2. Shared Primitives

- Normalize grid/card collapse rules for `.grid`, `.span*`, `.stat`, `.toolbar`, `.filters`, `.table-wrap`.
- Reduce sticky-column interference on small screens.
- Make action groups stack cleanly.

Status:
- Global grid/card responsiveness improved.
- Sticky action columns disabled on very small screens.

### 3. Critical Screens

#### Colheita

- Review list density, filters, summary pills/cards, and record dialog flow.
- Consider hiding low-priority columns on phones.
- Ensure comparison/review blocks stay readable.

#### Relatorios

- Reorganize export buttons into responsive groups.
- Evaluate table priority columns for small screens.
- Keep destination/payment summaries readable without horizontal chaos.

#### Producao e divisao

- Review tabs behavior on small screens.
- Improve forms/dialogs for acordos, vendas, custos, and participantes.
- Consider card mode for some lists with many columns.

#### Auditoria

- Break filters into clean vertical flow on mobile.
- Keep KPI cards readable.
- Revisit audit table columns and consider column-priority hiding on small screens.

### 4. Public Pages

- Keep public talhao page readable on phones.
- Avoid badge/code overflow.

Status:
- Initial public talhao responsiveness improved.

## Next Implementation Pass

1. Colheita: mobile/tablet review and targeted fixes.
2. Relatorios: export/filter/table responsiveness.
3. Producao e divisao: tabs + list/dialog improvements.
4. Auditoria: filter stack + table column priorities.

## Acceptance Criteria

- No horizontal layout break in topbar/sidebar/forms on common phone widths.
- Sidebar remains reachable and usable independently from page scroll.
- Dialogs remain fully usable on phone screens.
- Summary cards above tables remain readable and aligned.
- Main operational screens remain usable on tablet without zoom.
