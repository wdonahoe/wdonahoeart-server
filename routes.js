var express 	= require('express');
var httpStatus 	= require('http-status');
var logger 		= require('./config/logger');
var config 		= require('./config/config');
var controllers = require('./controllers');
var jwt 		= require('express-jwt');
var _ 			= require('lodash');
var multer 		= require('multer');
var router  	= express.Router();

var jwt_secret 	= config.jwt.secret;

var upload 		= multer({dest: 'temp/' });

var jwtCheck = jwt({
	secret: jwt_secret,
	getToken: function fromHeader(req){
		if (req.headers.authorization && _.startsWith(req.headers.authorization,'Bearer'))
			return req.headers.authorization.split(' ')[1];
		else
			return null;
	}
});

router.route('/test/protect')
	.get(jwtCheck,controllers.dummyProtected);

router.route('/test')
	.get(controllers.dummyUnprotected);

router.route('/drawings')
	.get(controllers.getDrawings)

router.route('/drawings/bw')
	.get(controllers.getDrawingsBw);

router.route('/drawings/color')
	.get(controllers.getDrawingsColor);

router.route('/drawings/:title')
	.get(controllers.getDrawing)
	.put(jwtCheck, controllers.putDrawing)
	.delete(jwtCheck, controllers.deleteDrawing);

router.route('/upload_s3')
	.post(jwtCheck, upload.single('file'), controllers.upload);

router.route('/login')
	.post(controllers.login);

module.exports = router;


