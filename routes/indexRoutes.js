var express = require('express');
var passport = require('passport');
var router = express.Router();
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();

var env = {
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
  AUTH0_CALLBACK_URL: process.env.AUTH0_CALLBACK_URL || 'http://localhost:8000/callback'
};

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.get('/book', function(req, res, next) {
    res.render('book');
});

router.get('/success', function(req, res, next) {
    res.render('success');
});

router.get('/failure', function(req, res, next) {
    res.render('failure');
});

router.get('/privacy', function(req, res, next) {
    res.render('privacy');
});

router.get('/set', ensureLoggedIn,function(req, res, next) {
    res.render('set', { user: req.user });
});

router.get('/dayview', ensureLoggedIn, function(req, res, next) {
    res.render('dayview', { user: req.user });
});

router.get('/error', function(req, res, next) {
    res.render('error');
});

router.get('/404', function(req, res, next) {
    res.render('404');
});


router.get('/login',
  function(req, res){
    res.render('login', { env: env });
  });

router.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

router.get('/callback',
  passport.authenticate('auth0', { failureRedirect: '/error' }),
  function(req, res) {
    res.redirect(req.session.returnTo || '/dashboard');
  });


module.exports = router;
