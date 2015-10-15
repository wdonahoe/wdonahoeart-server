'use strict';

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
var path 			= require('path');
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
	"dummyUnprotected": dummyUnprotected,
	"dummyProtected": 	dummyProtected,
	"getDrawings": 		getDrawings,
	"getDrawingSet": 	getDrawingSet,
	"putDrawings": 		putDrawings,
	"deleteDrawings": 	deleteDrawings,
	"login": 			login,
	"upload": 			upload
};


function dummyUnprotected(req, res, next){
	res.json({message: "You've accessed an unprotected resource!"});
}

function dummyProtected(req, res, next){
	res.json({message: "You've accessed a protected resource!"});
}

function getDrawings(req, res, next){
	var gallery = req.params.gallery;
	if (_.some(['color','bw'],function(val){ return val === gallery; })){
		getDrawingSet(gallery, function(err, drawings){
			if (err)
				return next(err);
			var ret = {};
			ret[gallery] = drawings;
			res.status(httpStatus[200]).json(ret);
		});
	} else if (gallery === 'all'){
		async.parallel({
			// bw: (done) => getDrawingSet('bw', done),
			// color: (done) => getDrawingSet('color', done)
			bw: function(done){
				getDrawingSet('bw', done);
			},
			color: function(done){
				getDrawingSet('color', done);
			}
		}, function(err, results){
			if (err)
				return next(err);
			res.status(httpStatus[200]).json(results);
		});
	} else {
		return next(err);
	}
}

function getDrawingSet(gallery, next){
	/**
	* Retreive all b/w-drawing documents.
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	async.waterfall([
		function(done){
			DrawingOrder.findOne({}, function(err, drawingOrder){
				var ordering = gallery === 'bw' ? drawingOrder.ordering.bw : drawingOrder.ordering.color;
				done(err, ordering);
			});
		},
		function(ordering, done){
			async.map(ordering, function(drawingID, done){
				Drawing.findOne({_id: drawingID}).lean().exec(function(err, drawing){
					drawing.dimensions = drawing.height + "\"" + " x " + drawing.width + "\"";
					done(err, drawing);
				});
			}, function(err, drawings){
				done(err, drawings);
			});
		}
	], function(err, drawings){
		return next(err, drawings);
	});
}

function putDrawings(req, res, next){
	/**
	* Update a drawing document.
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	res.status(httpStatus[200]).json({});
}

function deleteDrawings(req, res, next){
	/**
	* Delete a drawing document.
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	res.status(httpStatus[200]).json({});
}

function login(req, res){
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
}

function upload(req, res, next){
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

	async.parallel({
			aws: function(callback){
				awsUpload(_.merge(data, {file: file}, {newFile: newFile}), callback);
			},
			db: function(callback){
				dbSave(_.merge(data, {newFile: newFile}), callback);
			},
	 	},
	 	function(err, result){
		    if (err)
				return next(err);
			res.status(httpStatus[200]).send(result.db);
		}
	);

}

function awsUpload(fileData, callback){
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

function dbSave(fileData, callback){
	/**
	* Save drawing to database. 
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	async.waterfall([
		function(done){
			saveDrawing(fileData, done);
		},
		function(drawing, done){
			updateOrder(drawing, done);
		}
	], function(err, result){
		callback(err, result);
	});

}

function saveDrawing(fileData, callback){
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

function updateOrder(drawing, callback){
	DrawingOrder.findOne({}, function(err, drawingOrder){
		if (drawingOrder){
			if (drawing.isBw)
				drawingOrder.ordering.bw.unshift(drawing._id);
			else
				drawingOrder.ordering.color.unshift(drawing._id);
		}
		else {
			var drawingOrder = new DrawingOrder();
			if (drawing.isBw){
				drawingOrder.ordering.bw = [drawing._id];
				drawingOrder.ordering.color = [];
			}
			else {
				drawingOrder.ordering.color = [drawing._id];
				drawingOrder.ordering.bw = [];
			}
		}
		drawingOrder.save(function(err, drawingOrder){
			console.log(drawing);
			callback(err, drawing);
		});
	});
}


function createToken(email){
	return jwt.sign(email, jwt_secret);
}