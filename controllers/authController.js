const pool = require('../db'); // Configuración de la base de datos
const session = require('express-session');

// Renderiza la vista de login
exports.getLogin = (req, res) => {
  res.render('login');
};

// Procesa el login
exports.postLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Verifica las credenciales del usuario
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1 AND password = $2', [username, password]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      req.session.user = user; // Almacena el usuario completo en la sesión
      req.session.isLoggedIn = true; // Marca al usuario como logueado

      if (user.role === 'admin') {
        return res.redirect('/admin');
      } else if (user.role === 'buyer') {
        return res.redirect('/buyer');
      } else {
        return res.render('login', { error: 'Rol no autorizado' });
      }
    } else {
      return res.render('login', { error: 'Usuario o contraseña incorrectos' });
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Error al iniciar sesión' });
  }
};

// Cerrar sesión
exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
};

// Renderiza la vista de admin con datos de proveedores
exports.getAdmin = async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  try {
    const proveedorSeleccionado = req.query.proveedor || '';

    // Consultar todos los proveedores
    const proveedoresResult = await pool.query('SELECT DISTINCT proveedor FROM nota_de_pedido');
    const proveedores = proveedoresResult.rows.map(row => row.proveedor);

    // Si hay un proveedor seleccionado, filtrar las notas de pedido por ese proveedor
    let query = `
      SELECT n.*, COUNT(i.id) as total_imagenes
      FROM nota_de_pedido n
      LEFT JOIN imagenes i ON n.id = i.nota_id
    `;
    const queryParams = [];

    if (proveedorSeleccionado) {
      query += ' WHERE proveedor = $1';
      queryParams.push(proveedorSeleccionado);
    }

    // Ordenar las notas de pedido por fecha, de más nuevo a más viejo
    query += ' GROUP BY n.id ORDER BY n.fecha_pedido DESC';

    // Consultar las notas de pedido con el filtro aplicado
    const result = await pool.query(query, queryParams);
    const notas = result.rows;

    // Renderizar la vista de administración con los datos obtenidos
    res.render('admin', {
      notas,
      proveedores,
      proveedorSeleccionado
    });
  } catch (error) {
    console.error('Error al obtener las notas de pedido:', error);
    res.status(500).send('Error al obtener las notas de pedido');
  }
};

// Renderiza la vista de comprador
exports.getBuyer = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'buyer') {
    return res.redirect('/login');
  }
  res.render('buyer', { user: req.session.user });
};
