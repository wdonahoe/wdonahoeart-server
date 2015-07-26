var express 	= require('express');
var httpStatus 	= require('http-status-codes');
var logger 		= require('./config/logger');
var controllers = require('./controllers');
var router  	= express.Router();

router.route('/drawings')
	.get(controllers.getDrawings)
	.post(controllers.isValidAdmin, controllers.postDrawings);

router.route('/drawings/bw')
	.get(controllers.getDrawingsBW);

router.route('/drawings/color')
	.get(controllers.getDrawingsColor);

router.route('/drawings/:title')
	.get(controllers.getDrawing)
	.put(controllers.isValidAdmin, controllers.putDrawing)
	.delete(controllers.isValidAdmin, controllers.deleteDrawing);

router.route('/login')
	.post(controllers.login);

router.route('/logout')
	.delete(controllers.logout)

module.exports = router;


