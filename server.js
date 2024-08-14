const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuración de Multer para manejar la carga de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limitar tamaño de archivo a 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'), false);
        }
    }
});

// Conexión a la base de datos
const dbConfig = {
    host: 'srv1247.hstgr.io',
    user: 'u475816193_Inventariosdb',
    password: 'Inventariosdb123',
    database: 'u475816193_Invetariosdb',
    connectTimeout: 10000,
    acquireTimeout: 10000,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    if (connection) connection.release();
    console.log('Connected to the database');
});

app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Configuración del directorio estático para servir archivos de imagen
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Obtener proveedores
app.get('/api/proveedores', (req, res) => {
    const sql = 'SELECT * FROM Proveedores';
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error querying Proveedores:', err);
            return res.status(500).send('Error querying Proveedores: ' + err.message);
        }
        res.status(200).json(results);
    });
});

// Obtener categorías
app.get('/api/categorias', (req, res) => {
    const sql = 'SELECT * FROM Categorias';
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error querying Categorias:', err);
            return res.status(500).send('Error querying Categorias: ' + err.message);
        }
        res.status(200).json(results);
    });
});

// CRUD para la entidad 'Productos'
app.post('/api/productos', upload.single('foto'), (req, res) => {
    const { nombre, precio, stock, descripcion, categoria_id, proveedor_id } = req.body;
    const foto = req.file ? req.file.filename : null; // Guardar nombre del archivo o null si no se subió imagen

    const sql = 'INSERT INTO Productos (nombre, descripcion, precio, stock, categoria_id, proveedor_id, foto) VALUES (?, ?, ?, ?, ?, ?, ?)';
    req.db.query(sql, [nombre, descripcion, precio, stock, categoria_id, proveedor_id, foto], (err, result) => {
        if (err) {
            console.error('Error inserting into Productos:', err);
            return res.status(500).send('Error inserting into Productos: ' + err.message);
        }
        res.status(201).send(result);
    });
});

app.get('/api/productos', (req, res) => {
    const sql = 'SELECT * FROM Productos';
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error querying Productos:', err);
            return res.status(500).send('Error querying Productos: ' + err.message);
        }
        res.status(200).json(results);
    });
});

app.get('/api/productos/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM Productos WHERE id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(`Error querying Productos with id ${id}:`, err);
            return res.status(500).send(`Error querying Productos with id ${id}: ` + err.message);
        }
        res.status(200).json(results);
    });
});

// Actualizar producto
app.put('/api/productos/:id', upload.single('foto'), (req, res) => {
    const { id } = req.params;
    const { nombre, precio, stock, descripcion, categoria_id, proveedor_id } = req.body;
    const foto = req.file ? req.file.filename : null; // Guardar nombre del archivo o null si no se subió imagen

    // Verificar campos proporcionados y construir consulta SQL
    const updateFields = [];
    const updateValues = [];

    if (nombre) {
        updateFields.push('nombre = ?');
        updateValues.push(nombre);
    }
    if (precio) {
        updateFields.push('precio = ?');
        updateValues.push(precio);
    }
    if (stock) {
        updateFields.push('stock = ?');
        updateValues.push(stock);
    }
    if (descripcion) {
        updateFields.push('descripcion = ?');
        updateValues.push(descripcion);
    }
    if (categoria_id) {
        updateFields.push('categoria_id = ?');
        updateValues.push(categoria_id);
    }
    if (proveedor_id) {
        updateFields.push('proveedor_id = ?');
        updateValues.push(proveedor_id);
    }
    if (foto) {
        updateFields.push('foto = ?');
        updateValues.push(foto);
    }

    // Asegurarse de incluir el ID del producto al final
    if (updateFields.length === 0) {
        return res.status(400).send('No se proporcionaron campos para actualizar.');
    }

    const sql = `UPDATE Productos SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(id);

    req.db.query(sql, updateValues, (err, result) => {
        if (err) {
            console.error(`Error updating Productos with id ${id}:`, err);
            return res.status(500).send(`Error updating Productos with id ${id}: ` + err.message);
        }
        res.status(200).send(result);
    });
});

app.delete('/api/productos/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM Productos WHERE id = ?';
    req.db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(`Error deleting Productos with id ${id}:`, err);
            return res.status(500).send(`Error deleting Productos with id ${id}: ` + err.message);
        }
        res.status(200).send(result);
    });
});

// Obtener productos por categoría
app.get('/api/productos/categoria/:categoria_id', (req, res) => {
    const { categoria_id } = req.params;
    const sql = 'SELECT * FROM Productos WHERE categoria_id = ?';
    req.db.query(sql, [categoria_id], (err, results) => {
        if (err) {
            console.error(`Error querying Productos with categoria_id ${categoria_id}:`, err);
            return res.status(500).send(`Error querying Productos with categoria_id ${categoria_id}: ` + err.message);
        }
        res.status(200).json(results);
    });
});

// Obtener conteo de proveedores
app.get('/api/statistics/proveedores', (req, res) => {
    const sql = 'SELECT COUNT(*) AS total FROM Proveedores';
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error querying proveedor count:', err);
            return res.status(500).send('Error querying proveedor count: ' + err.message);
        }
        res.status(200).json(results[0].total);
    });
});

// Obtener conteo de productos por categoría
app.get('/api/statistics/productos-categoria', (req, res) => {
    const sql = `
        SELECT Categorias.nombre AS categoria, COUNT(Productos.id) AS total
        FROM Productos
        JOIN Categorias ON Productos.categoria_id = Categorias.id
        GROUP BY Categorias.nombre
    `;
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error querying productos por categoria:', err);
            return res.status(500).send('Error querying productos por categoria: ' + err.message);
        }
        res.status(200).json(results);
    });
});

app.listen(port, () => {
    console.log(`API listening at http://localhost:${port}`);
});
