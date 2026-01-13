# Instrucciones para Desplegar en Vercel

## Problema Resuelto

El error original se debía a que Vercel requiere funciones serverless, no un servidor Express completo. He reestructurado el proyecto para que funcione en Vercel.

## Cambios Realizados

1. **Creada función serverless** en `api/process.js` que reemplaza el endpoint Express
2. **Configurado `vercel.json`** para rutear correctamente las peticiones
3. **Reemplazado multer por busboy** (más adecuado para serverless)
4. **Ajustado manejo de archivos temporales** para usar `/tmp` (requerido en Vercel)

## Estructura para Vercel

```
.
├── api/
│   └── process.js          # Función serverless para procesar PDFs
├── backend/
│   └── pdfProcessor.js     # Lógica de procesamiento
├── public/                 # Archivos estáticos (frontend)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── vercel.json             # Configuración de Vercel
└── package.json
```

## Pasos para Desplegar

1. **Instalar dependencias** (si aún no lo has hecho):
   ```bash
   npm install
   ```

2. **Hacer commit de los cambios**:
   ```bash
   git add .
   git commit -m "Configuración para Vercel"
   ```

3. **Desplegar en Vercel**:
   - Si usas Vercel CLI: `vercel`
   - O conecta tu repositorio en vercel.com

## Notas Importantes

- **Archivos temporales**: En Vercel se usa `/tmp` en lugar de `./temp`
- **Timeout**: La función tiene un timeout máximo de 60 segundos (configurado en `vercel.json`)
- **Tamaño de archivo**: Límite de 50MB por archivo PDF
- **Múltiples archivos**: Se pueden subir hasta 10 PDFs a la vez

## Solución de Problemas

Si aún tienes errores:

1. **Verifica los logs en Vercel**: Ve a tu dashboard de Vercel → Función → Logs
2. **Verifica que `busboy` esté instalado**: `npm install busboy`
3. **Verifica que la ruta `/api/process` esté correcta** en `vercel.json`

## Diferencias con Desarrollo Local

- **Local**: Usa `server.js` con Express
- **Vercel**: Usa `api/process.js` como función serverless
- Ambos usan la misma lógica en `backend/pdfProcessor.js`

