import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { processPdfFiles } from './backend/pdfProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Asegurar que el directorio temp existe
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configurar multer para manejar archivos temporales
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'temp/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB límite
});

// Servir archivos estáticos
app.use(express.static('public'));

// Endpoint para procesar PDFs
app.post('/api/process', upload.array('pdfs', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron archivos PDF' });
    }

    const pdfPaths = req.files.map(file => file.path);
    const outputPath = await processPdfFiles(pdfPaths);

    // Enviar el archivo Excel como respuesta
    res.download(outputPath, 'notas_credito.xlsx', (err) => {
      if (err) {
        console.error('Error al enviar archivo:', err);
        res.status(500).json({ error: 'Error al generar el archivo Excel' });
      }
      
      // Limpiar archivos temporales
      pdfPaths.forEach(pdfPath => {
        try { fs.unlinkSync(pdfPath); } catch (e) {}
      });
      try { fs.unlinkSync(outputPath); } catch (e) {}
    });
  } catch (error) {
    console.error('Error procesando PDFs:', error);
    res.status(500).json({ 
      error: error.message || 'Error al procesar los archivos PDF' 
    });
    
    // Limpiar archivos en caso de error
    if (req.files) {
      req.files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

