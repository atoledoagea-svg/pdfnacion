import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

// Importar pdfjs-dist - usar la versión legacy para Node.js
// En Node.js, getDocument está en el default export
import pdfjsModule from 'pdfjs-dist/legacy/build/pdf.js';
// Asegurar que usamos el default export correctamente
const pdfjsLib = pdfjsModule.default || pdfjsModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar worker para pdfjs
// En Node.js, pdfjs-dist puede funcionar sin worker configurado explícitamente
// Si es necesario, se puede configurar una ruta local al worker
// Por ahora, dejamos que pdfjs use su configuración por defecto para Node.js
// (En Node.js, el worker es opcional y puede funcionar sin él)

// Headers esperados en el PDF
const HEADERS = ["Publicación", "Edición", "Concepto", "Cantidad", "Precio", "Recargo", "Importe"];

/**
 * Extrae el número de nota de crédito del texto de la página
 */
function extractNRef(pageText) {
  if (!pageText) return "";
  
  const pattern = /nota\s+de\s+cr[eé]dito.*?(?:n[:ºo°]*|nro\.?|n°)\s*([A-Z0-9\-\.\/]+)/i;
  const match = pageText.match(pattern);
  return match ? match[1].trim() : "";
}

/**
 * Encuentra los límites de las columnas basándose en la posición de los encabezados
 * Retorna array de [nombre, x0, x1] para cada header encontrado
 */
function findHeaderBounds(words) {
  const hits = {};
  
  // Buscar cada header en las palabras
  for (const word of words) {
    const txt = word.str.trim();
    for (const header of HEADERS) {
      if (txt.toLowerCase() === header.toLowerCase()) {
        hits[header] = word;
        break;
      }
    }
  }
  
  // Necesitamos al menos 5 headers para considerar válido
  if (Object.keys(hits).length < 5) {
    return [];
  }
  
  // Ordenar headers por posición X (centro)
  // transform es [a, b, c, d, e, f] donde e=x, f=y
  const items = Object.entries(hits)
    .map(([h, v]) => {
      const x0 = v.transform[4]; // e = posición X
      const width = v.width || 0;
      const centerX = x0 + width / 2.0;
      return [h, centerX];
    })
    .sort((a, b) => a[1] - b[1]);
  
  const centers = items.map(([, c]) => c);
  const bounds = [];
  
  // Calcular límites izquierdo y derecho para cada columna
  for (let i = 0; i < items.length; i++) {
    const [h, c] = items[i];
    let left, right;
    
    if (i === 0) {
      left = c - (centers[i + 1] - c) / 2.0;
    } else {
      left = (centers[i - 1] + c) / 2.0;
    }
    
    if (i === items.length - 1) {
      right = c + (c - centers[i - 1]) / 2.0;
    } else {
      right = (c + centers[i + 1]) / 2.0;
    }
    
    bounds.push([h, left, right]);
  }
  
  // Retornar en el orden de HEADERS
  const nameToBounds = {};
  bounds.forEach(([h, l, r]) => {
    nameToBounds[h] = [h, l, r];
  });
  
  return HEADERS
    .filter(h => h in nameToBounds)
    .map(h => nameToBounds[h]);
}

/**
 * Calcula la mediana de un array de números
 */
function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 
    ? sorted[mid] 
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Agrupa palabras en líneas basándose en su posición Y (tolerancia vertical)
 */
function groupLines(words, yTol = 2.0) {
  // Preparar registros con posición Y y X
  // En PDF, Y=0 está en la parte inferior, pero transform[5] (f) es la posición Y
  // Necesitamos invertir para que Y más alto = más arriba en la página
  const recs = words.map(w => {
    const top = w.top || w.transform[5] || 0.0; // Y coordinate (ya calculado en processPdf)
    const x0 = w.transform[4] || 0.0;  // X coordinate (e)
    return [Math.round(top * 10) / 10, x0, w];
  });
  
  // Ordenar por Y (ascendente, de arriba hacia abajo) y luego por X
  // En el script Python, ordena por (top, x0) donde top es desde arriba
  recs.sort((a, b) => {
    if (Math.abs(a[0] - b[0]) > 0.1) {
      return a[0] - b[0]; // Y ascendente (de arriba a abajo)
    }
    return a[1] - b[1]; // X ascendente
  });
  
  const lines = [];
  let curTop = null;
  let cur = [];
  
  for (const [top, x0, w] of recs) {
    if (curTop === null || Math.abs(top - curTop) <= yTol) {
      cur.push(w);
      if (curTop === null) curTop = top;
    } else {
      // Ordenar palabras de la línea por X
      cur.sort((a, b) => (a.transform[4] || 0) - (b.transform[4] || 0));
      lines.push(cur);
      cur = [w];
      curTop = top;
    }
  }
  
  if (cur.length > 0) {
    cur.sort((a, b) => (a.transform[4] || 0) - (b.transform[4] || 0));
    lines.push(cur);
  }
  
  return lines;
}

/**
 * Coloca palabras de una línea en sus columnas correspondientes según coordenadas X
 */
function placeIntoColumns(lineWords, bounds) {
  const cells = {};
  HEADERS.forEach(h => { cells[h] = ""; });
  
  for (const word of lineWords) {
    const x0 = word.transform[4] || 0.0; // e = posición X
    const width = word.width || 0;
    const xc = x0 + width / 2.0; // Centro X de la palabra
    const txt = word.str;
    
    // Encontrar la columna que contiene este centro X
    for (const [name, x0, x1] of bounds) {
      if (x0 <= xc && xc < x1) {
        cells[name] = cells[name] 
          ? (cells[name] + " " + txt).trim() 
          : txt;
        break;
      }
    }
  }
  
  return cells;
}

/**
 * Verifica si una cadena contiene al menos un dígito
 */
function hasDigits(s) {
  if (!s) return false;
  return /\d/.test(s);
}

/**
 * Procesa un archivo PDF y extrae las filas de datos
 */
async function processPdf(pdfPath) {
  const rows = [];
  
  // Leer el archivo PDF
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  
  let nRefGlobal = "";
  
  // Procesar cada página
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Extraer palabras con coordenadas
    // transform es [a, b, c, d, e, f] donde:
    // - e (transform[4]) = posición X
    // - f (transform[5]) = posición Y (desde abajo)
    // - a, d = escalas
    // - width, height = dimensiones del texto
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    
    const words = textContent.items
      .filter(item => item.str && item.str.trim().length > 0)
      .map(item => {
        const x0 = item.transform[4]; // e = posición X
        const y0 = item.transform[5]; // f = posición Y (desde abajo)
        const width = item.width || 0;
        const height = item.height || 0;
        // Convertir Y para que 0 esté arriba (invertir)
        const top = pageHeight - y0;
        
        return {
          str: item.str,
          transform: item.transform,
          x0: x0,
          x1: x0 + width,
          y0: y0,
          y1: y0 - height,
          top: top, // Y desde arriba
          width: width,
          height: height
        };
      });
    
    // Buscar encabezados
    const bounds = findHeaderBounds(words);
    if (bounds.length === 0) {
      continue; // Saltar página si no tiene encabezados válidos
    }
    
    // Extraer texto completo de la página para buscar número de nota
    const pageText = textContent.items.map(item => item.str).join(" ");
    if (!nRefGlobal) {
      nRefGlobal = extractNRef(pageText);
    }
    
    // Encontrar la posición Y de los encabezados
    const headerYList = words
      .filter(w => {
        const txt = w.str.trim().toLowerCase();
        return HEADERS.some(h => h.toLowerCase() === txt);
      })
      .map(w => w.top);
    
    const headerY = headerYList.length > 0 ? median(headerYList) : 0.0;
    
    // Filtrar palabras que están debajo de los encabezados (con margen de 8 puntos)
    // top más grande = más abajo en la página (si top es desde arriba)
    const dataWords = words.filter(w => w.top > headerY + 8.0);
    
    // Agrupar palabras en líneas
    const lines = groupLines(dataWords, 2.0);
    
    // Procesar cada línea
    for (const line of lines) {
      const cells = placeIntoColumns(line, bounds);
      
      const cantidad = (cells["Cantidad"] || "").trim();
      const precio = (cells["Precio"] || "").trim();
      const recargo = (cells["Recargo"] || "").trim();
      
      // REGLA DE NEGOCIO: Fila válida solo si Cantidad, Precio y Recargo tienen dígitos
      if (!(hasDigits(cantidad) && hasDigits(precio) && hasDigits(recargo))) {
        continue;
      }
      
      rows.push({
        publicacion: (cells["Publicación"] || "").trim(),
        edicion: (cells["Edición"] || "").trim(),
        concepto: (cells["Concepto"] || "").trim(),
        cantidad: cantidad,
        precio: precio,
        recargo: recargo,
        importe: (cells["Importe"] || "").trim(),
        n_ref: nRefGlobal
      });
    }
  }
  
  return rows;
}

/**
 * Procesa múltiples archivos PDF y genera un archivo Excel
 */
export async function processPdfFiles(pdfPaths) {
  const allRows = [];
  
  // Procesar cada PDF
  for (const pdfPath of pdfPaths) {
    try {
      const rows = await processPdf(pdfPath);
      const fileName = path.basename(pdfPath);
      
      // Agregar nombre de archivo a cada fila
      rows.forEach(row => {
        row.archivo = fileName;
        allRows.push(row);
      });
    } catch (error) {
      console.error(`Error procesando ${pdfPath}:`, error);
      throw new Error(`Error al procesar ${path.basename(pdfPath)}: ${error.message}`);
    }
  }
  
  // Crear archivo Excel
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Notas de Crédito');
  
  // Definir columnas en el orden exacto requerido
  const cols = [
    "archivo",
    "publicacion",
    "edicion",
    "concepto",
    "cantidad",
    "precio",
    "recargo",
    "importe",
    "n_ref",
    "N de credito"
  ];
  
  // Configurar encabezados
  worksheet.columns = cols.map(col => ({ header: col, key: col, width: 15 }));
  
  // Agregar datos
  if (allRows.length > 0) {
    allRows.forEach(row => {
      const excelRow = {};
      cols.forEach(col => {
        if (col === "N de credito") {
          excelRow[col] = row.n_ref || "";
        } else {
          excelRow[col] = row[col] || "";
        }
      });
      worksheet.addRow(excelRow);
    });
  }
  
  // Guardar archivo Excel
  // En Vercel/serverless, usar /tmp; en desarrollo local, usar temp/
  const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const tempDir = isVercel ? '/tmp' : path.join(__dirname, '../temp');
  const outputPath = path.join(tempDir, `output-${Date.now()}.xlsx`);
  
  // Asegurar que el directorio temp existe
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  await workbook.xlsx.writeFile(outputPath);
  
  return outputPath;
}

