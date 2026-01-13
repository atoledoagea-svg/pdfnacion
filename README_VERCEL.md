# Guía de Despliegue en Vercel

## Estructura del Proyecto

Vercel detecta automáticamente:
- **Carpeta `public/`**: Archivos estáticos (HTML, CSS, JS)
- **Carpeta `api/`**: Funciones serverless

## Pasos para Desplegar

### Opción 1: Desde el Dashboard de Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Haz clic en "Add New Project"
3. Conecta tu repositorio de GitHub/GitLab/Bitbucket
4. Vercel detectará automáticamente la configuración
5. Haz clic en "Deploy"

### Opción 2: Desde la CLI

```bash
# Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# Desplegar
vercel

# Para producción
vercel --prod
```

## Configuración Actual

- **Framework**: Otro (Node.js)
- **Build Command**: (ninguno, Vercel detecta automáticamente)
- **Output Directory**: (ninguno, usa `public/` automáticamente)
- **Install Command**: `npm install`

## Verificación

Después del despliegue, verifica:

1. **Frontend**: `https://tu-proyecto.vercel.app/` debería mostrar el HTML
2. **API**: `https://tu-proyecto.vercel.app/api/process` debería estar disponible

## Solución de Problemas

### Error "DEPLOYMENT_NOT_FOUND"

1. **Verifica que el proyecto esté conectado** en el dashboard de Vercel
2. **Revisa los logs del deployment** en Vercel → Deployments → Logs
3. **Asegúrate de que `package.json` tenga todas las dependencias**
4. **Verifica que la carpeta `api/` exista** con `api/process.js`

### Error en la función serverless

1. **Revisa los logs**: Vercel → Functions → Logs
2. **Verifica que `busboy` esté instalado**: `npm install busboy`
3. **Verifica que `pdfjs-dist` esté instalado**: `npm install pdfjs-dist`

### El frontend no carga

1. **Verifica que la carpeta `public/` exista**
2. **Verifica que `index.html` esté en `public/`**
3. **Revisa la consola del navegador** para errores de JavaScript

## Variables de Entorno

Si necesitas variables de entorno:
1. Ve a Vercel → Settings → Environment Variables
2. Agrega las variables necesarias
3. Redespliega el proyecto

## Límites de Vercel

- **Timeout de función**: 60 segundos (configurado en `vercel.json`)
- **Tamaño de archivo**: 50MB por archivo PDF
- **Memoria**: 1024MB por defecto
- **Región**: Automática (puedes configurarla en Settings)

