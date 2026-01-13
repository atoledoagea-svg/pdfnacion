# Procesador de Notas de Crédito

Aplicación web para procesar archivos PDF que contienen tablas de notas de crédito y extraer los datos a un archivo Excel.

## Características

- **Interfaz drag & drop**: Arrastra y suelta múltiples archivos PDF
- **Procesamiento automático**: Extrae datos de tablas basándose en coordenadas
- **Exportación a Excel**: Genera archivos `.xlsx` con los datos extraídos
- **Validación de datos**: Solo procesa filas que cumplen las reglas de negocio

## Requisitos

- Node.js 18 o superior
- npm o yarn

## Instalación

1. Clona o descarga este repositorio
2. Abre una terminal en el directorio del proyecto
3. Instala las dependencias:

```bash
npm install
```

## Uso

1. Inicia el servidor:

```bash
npm start
```

2. Abre tu navegador y ve a `http://localhost:3000`

3. Arrastra y suelta uno o varios archivos PDF en el área de carga, o haz clic para seleccionarlos

4. Haz clic en "Procesar PDFs" para comenzar el procesamiento

5. El archivo Excel se descargará automáticamente cuando el procesamiento termine

## Reglas de Negocio

La aplicación procesa las tablas de los PDFs siguiendo estas reglas:

- **Detección de encabezados**: Los encabezados se detectan por posición (coordenadas X/Y), no por orden
- **Columnas esperadas**: Publicación, Edición, Concepto, Cantidad, Precio, Recargo, Importe
- **Filtrado de filas**: Solo se procesan filas donde los campos **Cantidad**, **Precio** y **Recargo** contienen al menos un dígito
- **Extracción de número de nota**: Se busca el número de nota de crédito en el texto del PDF
- **Múltiples páginas**: Se procesan todas las páginas que contengan encabezados válidos

## Estructura del Proyecto

```
.
├── backend/
│   └── pdfProcessor.js    # Lógica de procesamiento de PDFs
├── public/
│   ├── index.html         # Interfaz de usuario
│   ├── styles.css         # Estilos
│   └── app.js             # Lógica del frontend
├── temp/                  # Archivos temporales (se crea automáticamente)
├── server.js              # Servidor Express
├── package.json           # Dependencias del proyecto
└── README.md             # Este archivo
```

## Tecnologías Utilizadas

- **Backend**: Node.js con Express.js
- **Procesamiento de PDF**: pdfjs-dist (misma librería que usa Firefox)
- **Generación de Excel**: ExcelJS
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Manejo de archivos**: Multer

## Notas Técnicas

- Los archivos PDF se procesan temporalmente y se eliminan después de generar el Excel
- La aplicación detecta columnas basándose en las coordenadas X de los encabezados
- Las palabras se agrupan en filas usando una tolerancia vertical de 2 puntos
- Si un PDF no tiene encabezados válidos, esa página se omite

## Solución de Problemas

**Error: "No se proporcionaron archivos PDF"**
- Asegúrate de haber seleccionado al menos un archivo PDF antes de procesar

**Error: "Solo se permiten archivos PDF"**
- Verifica que los archivos que estás subiendo tengan extensión `.pdf` y sean PDFs válidos

**Error: "Error al procesar los archivos PDF"**
- El PDF podría no tener el formato esperado (encabezados de tabla)
- Verifica que el PDF contenga una tabla con los encabezados: Publicación, Edición, Concepto, Cantidad, Precio, Recargo, Importe

**El archivo Excel está vacío**
- Esto puede ocurrir si ninguna fila cumple la regla de negocio (Cantidad, Precio y Recargo deben tener dígitos)
- Verifica que las tablas en el PDF contengan datos numéricos en esas columnas

## Licencia

MIT

