var express 	= require('express');
var httpStatus 	= require('http-status');
var logger 		= require('./config/logger');
var config 		= require('./config/config');
var controllers = require('./controllers');
var jwt 		= require('express-jwt');
var router  	= express.Router();

var jwt_secret 		= config.jwt.secret;

var jwtCheck = jwt({
	secret: jwt_secret
});

router.route('/test/protect')
	.get(jwtCheck,controllers.dummyProtected);

router.route('/test')
	.get(controllers.dummyUnprotected);

router.route('/drawings')
	.get(controllers.getDrawings)
	.post(jwtCheck, controllers.postDrawings);

router.route('/drawings/bw')
	.get(controllers.getDrawingsBW);

router.route('/drawings/color')
	.get(controllers.getDrawingsColor);

router.route('/drawings/:title')
	.get(controllers.getDrawing)
	.put(jwtCheck, controllers.putDrawing)
	.delete(jwtCheck, controllers.deleteDrawing);

router.route('/login')
	.post(controllers.login);

router.route('/logout')
	.delete(controllers.logout)

module.exports = router;


