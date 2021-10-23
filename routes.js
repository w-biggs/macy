/**
 * Route for /
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const indexRoute = async function indexRoute(req, res) {
  console.log(req.user);
  res.render('index', { title: 'Home', user: req.user });
};

/**
 * Route for /auth/login/
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const loginRoute = async function loginRoute(req, res) {
  res.send('hi!');
};

/**
 * Sets up the express routes.
 * @param {import('express').Express} app The express instance.
 */
const setupRoutes = function setupExpressRoutes(app) {
  app.get('/', indexRoute);
  app.get('/auth/login/', loginRoute);
};

module.exports = setupRoutes;