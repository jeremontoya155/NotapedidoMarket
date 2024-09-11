// Middleware para verificar si el usuario está autenticado
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next(); // Si el usuario está autenticado, continuar
  }
  res.redirect('/login'); // Si no está autenticado, redirigir al login
}

// Middleware para verificar si el usuario es un comprador
function isBuyer(req, res, next) {
  if (req.session && req.session.userRole === 'comprador') {
    return next(); // Si el usuario es un comprador, continuar
  }
  res.redirect('/login'); // Si no, redirigir al login
}

// Middleware para verificar si el usuario es un administrador
function isAdmin(req, res, next) {
  if (req.session && req.session.userRole === 'admin') {
    return next(); // Si el usuario es admin, continuar
  }
  res.redirect('/login'); // Si no, redirigir al login
}

module.exports = { isAuthenticated, isBuyer, isAdmin };
