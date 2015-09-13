var Drawing 		= require('./models/drawing');
var DrawingOrder 	= require('./models/drawingOrder');
var config 			= require('./config/config');
var httpStatus 		= require('http-status');
var mongoose 		= require('mongoose');
var aws 			= require('aws-sdk');
var fs 				= require('fs');
var s3fs 			= require('s3fs');
var bcrypt 			= require('bcrypt-nodejs');
var jwt 			= require('jsonwebtoken');
var async 			= require('async');
var _ 				= require('lodash');

var AWS_ACCESS_KEY 	= config.aws.aws_access;
var AWS_SECRET_KEY 	= config.aws.aws_secret;
var AWS_URL 		= config.aws.aws_url;
var S3_BUCKET 		= config.aws.aws_bucket;

var admin_emails 	= config.admin.emails;
var admin_pass		= config.admin.pass_hash;

var jwt_secret 		= config.jwt.secret;

var s3fsImpl = new s3fs( S3_BUCKET, {
	accessKeyId: AWS_ACCESS_KEY,
	secretAccessKey: AWS_SECRET_KEY
});

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

	getDrawingsBw: function(req, res, next){
		/**
		* Retreive all b/w-drawing documents.
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		Drawing.find({ isBw: true }).exec(function(err, drawings){
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
		Drawing.find({ isBw: false }).exec(function(err, drawings){
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
		* Update a drawing document.
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
		* Create a JSON web token for user on successful authentication.
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
			res.sendStatus(httpStatus[401]);
		}
	},

	upload: function(req, res, next){
		/**
		* Upload a drawing image to AWS bucket
		* Save drawing to database. 
		* @param {Object} req
		* @param {Object} res
		* @param {function} next
		*/
		var file 		= req.file;
		var data 		= JSON.parse(req.body.data);
		var imgType 	= _.last(req.file.originalname.split('.'));
		var newFile 	= data.title.split(/\s+/g).join('-') + "." + imgType;

		async.parallel([
				function(callback){
					awsUpload(callback, _.merge(data, {file: file}, {newFile: newFile}));
				},
				function(callback){
					dbSave(callback, _.merge(data, {newFile: newFile}));
				},
		 	],
		 	function(err, result){
			    if (err)
					return next(err);
				res.sendStatus(httpStatus[200]);
			}
		);

	}
};


function awsUpload(callback, fileData){
	/**
	* Upload a drawing image to AWS bucket
	* Save drawing to database. 
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	fs.readFile(fileData.file.path, function(err, data){
		if (err)
			callback(err);
		aws.config.update({accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY});
	    var s3 = new aws.S3();
	    var s3Params = {
	    	Bucket: S3_BUCKET,
	    	ACL: 'public-read',
	    	Key: fileData.newFile,
	    	Body: data,
	    	ContentType: 'image/jpeg'
	    };
	    s3.putObject(s3Params, function(err, result){
	    	fs.unlink(fileData.file.path, function(err){
	    		callback(err, result);
	    	});
	    });
	});

}


function dbSave(callback, fileData){
	/**
	* Save drawing to database. 
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	async.waterfall([
		function(done){
			saveDrawing(done, fileData);
		},
		function(drawing, done){
			updateOrder(done, drawing);
		}
	], function(err, result){
		callback(err, result);
	});

}

function saveDrawing(callback, fileData){
	Drawing.findOne({ title: fileData.title }, function(err, drawing){
		if (drawing){
			drawing.update(callback, _.merge(fileData, {url: AWS_URL + fileData.newFile}));
		}
		else {
			var newDrawing = new Drawing();
			newDrawing.update(callback, _.merge(fileData, {url: AWS_URL + fileData.newFile}));
		}
	});
}

function updateOrder(callback, drawing){
	DrawingOrder.findOne({}, function(err, drawingOrder){
		if (drawingOrder){
			drawingOrder.ordering.unshift(drawing._id);
		}
		else {
			var drawingOrder = new DrawingOrder();
			drawingOrder.ordering = [drawing._id];
		}
		drawingOrder.save(callback);
	});
}


function createToken(email){
	return jwt.sign(email, jwt_secret);
}