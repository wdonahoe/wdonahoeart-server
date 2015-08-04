var Drawing 	= require('./models/drawing');
var config 		= require('./config/config');
var httpStatus 	= require('http-status');
var mongoose 	= require('mongoose');
var aws 		= require('aws-sdk');
var bcrypt 		= require('bcrypt-nodejs');
var jwt 		= require('jsonwebtoken');
var _ 			= require('lodash');

var AWS_ACCESS_KEY 	= config.aws.aws_access;
var AWS_SECRET_KEY 	= config.aws.aws_secret;
var S3_BUCKET 		= config.aws.aws_bucket;

var admin_emails 	= config.admin.emails;
var admin_pass		= config.admin.pass_hash;

var jwt_secret 		= config.jwt.secret;

module.exports = {

	dummyUnprotected: function(req, res, next){
		res.json({message: "You've accessed an unprotected resource!"});
	},

	dummyProtected: function(req, res, next){
		res.json({message: "You've accessed a protected resource!"});
	},

	getDrawings: function(req, res, next) {
		/**
		* Retreive all drawing documents.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		Drawing.find().exec(function(err, drawings){
			if (err)
				return next(err);
			res.status(httpStatus[200]).json(drawings);
		});
	},

	postDrawings:  function(req, res, next){
		/**
		* Create a new drawing instance.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		async.waterfall([
			function(done){
				// get signed url for drawing from s3
				getSignedUrl(req.query.file_name, req.query.file_type, done);
			}
		], function(err,data){
			if (err)
				return next(err);
			res.status(httpStatus.CREATED).json(data)
		});
	},

	getDrawingsBW: function(req, res, next){
		/**
		* Retreive all b/w-drawing documents.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		Drawing.find({ is_bw: true }).exec(function(err, drawings){
			if (err)
				return next(err);
			res.status(httpStatus[200]).json(drawings);
		});
	},

	getDrawingsColor: function(req, res, next){
		/**
		* Retreive all color-drawing documents.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		Drawing.find({ is_bw: false }).exec(function(err, drawings){
			if (err)
				return next(err);
			res.status(httpStatus[200]).json(drawings);
		});
	},

	getDrawing: function(req, res, next){
		/**
		* Retreive a drawing document.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		var fullTitle = req.params.title.split('-').join(' ');
		Drawing.findOne({ title: fullTitle }).exec(function(err, drawing){
			if (err)
				return next(err);
			res.status(httpStatus[200]).json(drawing);
		});
	},

	putDrawing: function(req, res, next){
		/**
		* Edit a drawing document.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		res.status(httpStatus[200]).json({});
	},

	deleteDrawing: function(req, res, next){
		/**
		* Delete a drawing document.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		res.status(httpStatus[200]).json({});
	},

	login: function(req, res){
		/**
		* Create a session.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		var email 		= req.body.email;
		var password 	= req.body.password;

		if (!email || !password)
			res.sendStatus(httpStatus[400]);

		if (_.includes(admin_emails, email)){
			if (bcrypt.compareSync(password, admin_pass))
				res.status(httpStatus[201]).json({ id_token: createToken(email), user: email.split("@")[0] });
		} else {
			res.sendStatus(httpStatus[401]).end();
		}
	},

	logout: function(req, res){
		/**
		* Delete a session.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		delete req.session;
		res.sendStatus(httpStatus[204]).json({ user: undefined }); // respond no content
	}

}

function createToken(email){
	return jwt.sign(email, jwt_secret);
}

function getSignedUrl(fn, ft, next){
	/**
	* Get a signed Amazon s3 url for public gallery.
	* @param {String} fn
	* @param {String} ft
	* @param {function} next
	*/
	aws.config.update({accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY});
	var s3 = new aws.S3();
	var s3_params = {
	    Bucket: S3_BUCKET,
	    Key: fn,
	    Expires: 3600,
	    ContentType: ft,
	    ACL: 'public-read'
	};
	s3.getSignedUrl('putObject', s3_params, function(err, data){
	    var return_data = {
	        signed_request: data,
	        url: 'https://'+S3_BUCKET+'.s3.amazonaws.com/'+fn
	    };
	    next(err,return_data);
	});
}