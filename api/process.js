import { processPdfFiles } from '../backend/pdfProcessor.js';
import fs from 'fs';
import path from 'path';
import busboy from 'busboy';

// Función serverless para Vercel
export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // En Vercel, usar /tmp para archivos temporales
  const tmpDir = '/tmp';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const pdfPaths = [];
  let outputPath = null;

  try {
    // Parsear el formulario multipart con busboy
    const bb = busboy.default ? busboy.default({ headers: req.headers }) : busboy({ headers: req.headers });
    const files = [];

    // Promesa para manejar el stream
    await new Promise((resolve, reject) => {
      bb.on('file', (fieldname, file, info) => {
        const { filename, encoding, mimeType } = info;
        
        // Validar que sea PDF
        if (mimeType !== 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) {
          file.resume(); // Descartar el archivo
          return reject(new Error('Solo se permiten archivos PDF'));
        }

        const tmpPath = path.join(tmpDir, `${Date.now()}-${filename}`);
        const writeStream = fs.createWriteStream(tmpPath);
        
        file.pipe(writeStream);
        
        file.on('end', () => {
          files.push(tmpPath);
        });

        writeStream.on('error', (err) => {
          reject(err);
        });
      });

      bb.on('finish', () => {
        resolve();
      });

      bb.on('error', (err) => {
        reject(err);
      });

      // Pipe el request body a busboy
      req.pipe(bb);
    });

    if (files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron archivos PDF' });
    }

    pdfPaths.push(...files);

    // Procesar PDFs
    outputPath = await processPdfFiles(pdfPaths);

    // Leer el archivo Excel generado
    const excelBuffer = fs.readFileSync(outputPath);

    // Limpiar archivos temporales
    pdfPaths.forEach(pdfPath => {
      try { fs.unlinkSync(pdfPath); } catch (e) {}
    });
    if (outputPath) {
      try { fs.unlinkSync(outputPath); } catch (e) {}
    }

    // Enviar respuesta con el archivo Excel
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=notas_credito.xlsx');
    res.status(200).send(excelBuffer);

  } catch (error) {
    console.error('Error procesando PDFs:', error);
    
    // Limpiar archivos en caso de error
    pdfPaths.forEach(pdfPath => {
      try { fs.unlinkSync(pdfPath); } catch (e) {}
    });
    if (outputPath) {
      try { fs.unlinkSync(outputPath); } catch (e) {}
    }

    res.status(500).json({ 
      error: error.message || 'Error al procesar los archivos PDF' 
    });
  }
}

// Deshabilitar el body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

