// Referencias a elementos del DOM
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const result = document.getElementById('result');
const error = document.getElementById('error');

// Array para almacenar los archivos seleccionados
let selectedFiles = [];

// Inicializar eventos
init();

function init() {
    // Eventos de drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Evento de click en el área de upload
    uploadArea.addEventListener('click', () => fileInput.click());
    
    // Evento de cambio en el input de archivos
    fileInput.addEventListener('change', handleFileSelect);
    
    // Evento del botón procesar
    processBtn.addEventListener('click', handleProcess);
    
    // Evento del botón limpiar
    clearBtn.addEventListener('click', handleClear);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type === 'application/pdf'
    );
    
    if (files.length > 0) {
        addFiles(files);
    } else {
        showError('Por favor, arrastra solo archivos PDF');
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        addFiles(files);
    }
}

function addFiles(files) {
    // Filtrar solo PDFs
    const pdfFiles = files.filter(file => {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            showError(`El archivo "${file.name}" no es un PDF válido`);
        }
        return isPdf;
    });
    
    // Agregar archivos únicos (evitar duplicados)
    pdfFiles.forEach(file => {
        if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    });
    
    updateFileList();
    updateUI();
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    updateUI();
}

function updateFileList() {
    if (selectedFiles.length === 0) {
        fileList.classList.remove('show');
        return;
    }
    
    fileList.classList.add('show');
    fileList.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <div class="file-name">
                <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span>${file.name}</span>
                <span class="file-size">(${formatFileSize(file.size)})</span>
            </div>
            <button class="remove-file" onclick="removeFile(${index})">Eliminar</button>
        </div>
    `).join('');
}

function updateUI() {
    processBtn.disabled = selectedFiles.length === 0;
    clearBtn.style.display = selectedFiles.length > 0 ? 'block' : 'none';
    
    if (selectedFiles.length === 0) {
        result.classList.remove('show');
        hideError();
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function handleProcess() {
    if (selectedFiles.length === 0) {
        showError('Por favor, selecciona al menos un archivo PDF');
        return;
    }
    
    // Deshabilitar botón y mostrar loading
    processBtn.disabled = true;
    processBtn.querySelector('.btn-text').style.display = 'none';
    processBtn.querySelector('.btn-loader').style.display = 'inline-flex';
    
    hideError();
    result.classList.remove('show');
    
    try {
        // Crear FormData con los archivos
        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('pdfs', file);
        });
        
        // Enviar petición al servidor
        const response = await fetch('/api/process', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al procesar los archivos');
        }
        
        // Obtener el blob del archivo Excel
        const blob = await response.blob();
        
        // Crear URL temporal para descargar
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notas_credito.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Mostrar mensaje de éxito
        showResult('Archivo Excel generado exitosamente. La descarga debería comenzar automáticamente.');
        
    } catch (err) {
        showError(err.message || 'Error al procesar los archivos PDF');
    } finally {
        // Restaurar botón
        processBtn.disabled = false;
        processBtn.querySelector('.btn-text').style.display = 'inline';
        processBtn.querySelector('.btn-loader').style.display = 'none';
    }
}

function handleClear() {
    selectedFiles = [];
    fileInput.value = '';
    updateFileList();
    updateUI();
    hideError();
    result.classList.remove('show');
}

function showResult(message) {
    result.innerHTML = `
        <div class="result-content">
            <p>${message}</p>
        </div>
    `;
    result.classList.add('show');
}

function showError(message) {
    error.textContent = message;
    error.classList.add('show');
}

function hideError() {
    error.classList.remove('show');
}

// Hacer removeFile disponible globalmente para los botones generados
window.removeFile = removeFile;

