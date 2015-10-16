'use strict';

let express 	= require('express');
let httpStatus 	= require('http-status');
let logger 		= require('./config/logger');
let config 		= require('./config/config');
let controllers = require('./controllers');
let jwt 		= require('express-jwt');
let _ 			= require('lodash');
let multer 		= require('multer');
let router  	= express.Router();

let jwt_secret 	= config.jwt.secret;

let upload 		= multer({dest: 'temp/' });

let jwtCheck = jwt({
	secret: jwt_secret,
	getToken: req => {
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

router.route('/drawings/:gallery')
	.get(controllers.getDrawings)
	.put(jwtCheck, controllers.putDrawings)
	.delete(jwtCheck, controllers.deleteDrawings)

router.route('/upload_s3')
	.post(jwtCheck, upload.single('file'), controllers.upload);

router.route('/login')
	.post(controllers.login);

module.exports = router;


