<!-- === README.md === -->
# PlanoCasa 3D — Android offline

App Android de diseño de planos 2D con modelo 3D navegable. Todo corre dentro del APK; no hay CDN, ni backend, ni recursos externos en runtime.

> **Aviso técnico**: las alturas, espesores y pendientes incluidas son *defaults configurables*, no normas. Deben validarse con el reglamento local antes de usar los planos para ejecución de obra.

## Crear el keystore (una sola vez, desde GitHub Codespaces)

```bash
keytool -genkeypair -v -keystore release-keystore.jks \
  -alias planocasa -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 release-keystore.jks
