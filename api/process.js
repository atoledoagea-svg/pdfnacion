import fs from 'fs';
import path from 'path';

// Función serverless para Vercel
export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Importar dinámicamente para mejor manejo de errores
  let processPdfFiles;
  try {
    const pdfProcessor = await import('../backend/pdfProcessor.js');
    processPdfFiles = pdfProcessor.processPdfFiles;
  } catch (error) {
    console.error('Error importando pdfProcessor:', error);
    return res.status(500).json({ 
      error: 'Error al cargar el procesador de PDFs',
      details: error.message 
    });
  }

  // En Vercel, usar /tmp para archivos temporales
  const tmpDir = '/tmp';
  const pdfPaths = [];
  let outputPath = null;

  try {
    // Importar busboy dinámicamente para mejor compatibilidad
    const busboyModule = await import('busboy');
    const busboy = busboyModule.default || busboyModule;
    
    // Parsear el formulario multipart con busboy
    const bb = busboy({ headers: req.headers });
    const files = [];
    let fileCount = 0;
    let finished = false;

    // Promesa para manejar el stream
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!finished) {
          finished = true;
          reject(new Error('Timeout esperando archivos'));
        }
      }, 30000); // 30 segundos timeout

      bb.on('file', (fieldname, file, info) => {
        const { filename, encoding, mimeType } = info;
        
        // Validar que sea PDF
        if (mimeType !== 'application/pdf' && (!filename || !filename.toLowerCase().endsWith('.pdf'))) {
          file.resume(); // Descartar el archivo
          return;
        }

        fileCount++;
        const tmpPath = path.join(tmpDir, `${Date.now()}-${fileCount}-${filename || 'file.pdf'}`);
        const writeStream = fs.createWriteStream(tmpPath);
        
        file.pipe(writeStream);
        
        file.on('end', () => {
          if (fs.existsSync(tmpPath)) {
            files.push(tmpPath);
          }
        });

        writeStream.on('finish', () => {
          if (fs.existsSync(tmpPath)) {
            files.push(tmpPath);
          }
        });

        writeStream.on('error', (err) => {
          console.error('Error escribiendo archivo:', err);
          try {
            if (fs.existsSync(tmpPath)) {
              fs.unlinkSync(tmpPath);
            }
          } catch (e) {}
          // No rechazar aquí, solo registrar el error
        });
      });

      bb.on('finish', () => {
        clearTimeout(timeout);
        finished = true;
        // Esperar un momento para que los archivos terminen de escribirse
        setTimeout(() => {
          resolve();
        }, 100);
      });

      bb.on('error', (err) => {
        clearTimeout(timeout);
        finished = true;
        reject(err);
      });

      // Pipe el request body a busboy
      // En Vercel, req puede ser un stream o tener un body
      if (typeof req.pipe === 'function') {
        req.pipe(bb);
      } else if (req.body) {
        // Si el body ya está parseado, escribir directamente
        if (Buffer.isBuffer(req.body)) {
          bb.end(req.body);
        } else {
          reject(new Error('Request body no es un buffer'));
        }
      } else if (req.on && typeof req.on === 'function') {
        // Si es un stream pero no tiene pipe, usar eventos
        req.on('data', (chunk) => {
          bb.write(chunk);
        });
        req.on('end', () => {
          bb.end();
        });
        req.on('error', (err) => {
          reject(err);
        });
      } else {
        reject(new Error('No se puede procesar el request: formato no soportado'));
      }
    });

    // Filtrar archivos duplicados
    const uniqueFiles = [...new Set(files)];
    
    if (uniqueFiles.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron archivos PDF válidos' });
    }

    pdfPaths.push(...uniqueFiles);

    // Procesar PDFs
    outputPath = await processPdfFiles(pdfPaths);

    // Leer el archivo Excel generado
    const excelBuffer = fs.readFileSync(outputPath);

    // Limpiar archivos temporales
    pdfPaths.forEach(pdfPath => {
      try { 
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath); 
        }
      } catch (e) {
        console.error('Error eliminando PDF temporal:', e);
      }
    });
    if (outputPath) {
      try { 
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath); 
        }
      } catch (e) {
        console.error('Error eliminando Excel temporal:', e);
      }
    }

    // Enviar respuesta con el archivo Excel
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=notas_credito.xlsx');
    res.status(200).send(excelBuffer);

  } catch (error) {
    console.error('Error procesando PDFs:', error);
    console.error('Stack:', error.stack);
    
    // Limpiar archivos en caso de error
    pdfPaths.forEach(pdfPath => {
      try { 
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath); 
        }
      } catch (e) {}
    });
    if (outputPath) {
      try { 
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath); 
        }
      } catch (e) {}
    }

    res.status(500).json({ 
      error: error.message || 'Error al procesar los archivos PDF',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
