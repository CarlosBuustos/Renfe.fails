# renfe.fail

Web que cuantifica retrasos de **Renfe (Cercanías)** de forma simple y visual, inspirada en failbondi.fail.

## Cómo funciona
- El workflow (CI) se ejecuta cada 15 minutos.
- El ingestor descarga los feeds de Renfe Data (GTFS-RT/JSON) y calcula:
  - nº de trenes analizados
  - nº con retraso >=15 min y >=30 min
  - cancelaciones
  - retraso medio de salida
  - peor retraso del día
  - distribución por tramos (0-5, 5-15, 15-30, 30-45, 45+)
- Guarda `web/static/data/today.json` y actualiza `web/static/data/history.json`.
- La web (SvelteKit) lee esos JSON y los muestra.

## Desarrollo local
```bash
pnpm install
pnpm ingest   # genera web/static/data/today.json
pnpm -C web dev
