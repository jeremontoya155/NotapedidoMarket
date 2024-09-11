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
      const result = await pool.query('SELECT * FROM usuarios WHERE username = $1 AND password = $2', [username, password]);
  
      if (result.rows.length > 0) {
        const user = result.rows[0];
        req.session.user = user;
  
        if (user.role === 'admin') {
          return res.redirect('/admin');
        } else {
          return res.redirect('/buyer');
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

// Renderiza la vista de admin
exports.getAdmin = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/');
  }
  res.render('admin', { user: req.session.user });
};

// Renderiza la vista de comprador
exports.getBuyer = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'buyer') {
    return res.redirect('/');
  }
  res.render('buyer', { user: req.session.user });
};
