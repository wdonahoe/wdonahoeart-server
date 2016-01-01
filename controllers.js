'use strict';

let Drawing 		= require('./models/drawing');
let DrawingOrder 	= require('./models/drawingOrder');
let config 			= require('./config/config');
let template 		= require('es6-template-strings');
let httpStatus 		= require('http-status');
let mongoose 		= require('mongoose');
let aws 			= require('aws-sdk');
let fs 				= require('fs');
let bcrypt 			= require('bcrypt-nodejs');
let jwt 			= require('jsonwebtoken');
let async 			= require('async');
let path 			= require('path');
let _ 				= require('lodash');

let AWS_ACCESS_KEY 	= config.aws.aws_access;
let AWS_SECRET_KEY 	= config.aws.aws_secret;
let AWS_URL 		= config.aws.aws_url;
let S3_BUCKET 		= config.aws.aws_bucket;

let admin_emails 	= config.admin.emails;
let admin_pass		= config.admin.pass_hash;

let jwt_secret 		= config.jwt.secret;

module.exports = {
	"getDrawings": 		getDrawings,
	"getDrawingSet": 	getDrawingSet,
	"putDrawings": 		putDrawings,
	"login": 			login,
	"upload": 			upload,
	"reorderDrawings":  reorderDrawings,
	"getDrawing": 		getDrawing
};

function getDrawings(req, res, next){
	/**
	* Retreive all drawings, or the set of drawings with type
	* matching req.gallery (color || bw)
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	let gallery = req.params.gallery;
	if (_.some(['color','bw'], val => val === gallery )){
		getDrawingSet(gallery, (err, drawings) => {
			if (err)
				return next(err);
			let ret = {};
			ret[gallery] = drawings;
			res.status(httpStatus[200]).json(ret);
		});
	} else if (gallery === 'all'){
		async.parallel({
			bw: 	done => getDrawingSet('bw', done),
			color: 	done => getDrawingSet('color', done)
		}, (err, results) => {
			if (err)
				return next(err);
			console.log(results);
			res.status(httpStatus[200]).json(results);
		});
	} else {
		return next(err);
	}
}

function getDrawingSet(gallery, next){
	/**
	* Retreive all b/w-drawing documents.
	* @param {String} gallery 
	* @param {function} next
	*/
	async.waterfall([
		done => {
			DrawingOrder.findOne({}, (err, drawingOrder) => done(err, gallery === 'bw' ? drawingOrder.ordering.bw : drawingOrder.ordering.color));
		},
		(ordering, done) => {
			async.map(ordering, (drawingID, done) => {
				Drawing.findOne({_id: drawingID}).lean().exec((err, drawing) => {
					drawing.dimensions = template('${height}\" x ${width}\"', {height: drawing.height, width: drawing.width});
					done(err, drawing);
				});
			}, (err, drawings) => done(err, drawings));
		}
	], (err, drawings) => next(err, drawings));
}

function reorderDrawings(req, res, next){
	/** 
	* Update DrawingOrder
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	DrawingOrder.findOne({}, (err, drawingOrder) => {
		drawingOrder.ordering.bw = _.map(req.body.bw, drawing => drawing._id);
		drawingOrder.ordering.color = _.map(req.body.color, drawing => drawing._id);
		drawingOrder.save((err, drawingOrder) => {
			if (err)
				return next(err);
			res.sendStatus(httpStatus[200]);
		});
	});
}

function getDrawing(req, res, next){
	/**
	* Update a drawing document.
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	Drawing.findOne({_id: mongoose.Types.ObjectId(req.params.id)}).lean().exec((err, drawing) => {
		if (err)
			return next(err);
		drawing.dimensions = template('${height}\" x ${width}\"', {height: drawing.height, width: drawing.width});
		res.status(httpStatus[200]).json(drawing);
	});
}

function putDrawings(req, res, next){
	/**
	* Update a drawing document.
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	let drawing = JSON.parse(req.body.drawing);
	let imgType;
	let newFile;
	let fileData;
	if (req.file !== undefined){
		imgType = _.last(req.file.originalname.split('.'));
		newFile = drawing.title.split(/\s+/g).join('-') + "." + imgType;
		fileData = _.assign({newFile: newFile},{file: req.file});
	}

	async.parallel({
		drawing: (done) => { Drawing.findOne({_id: mongoose.Types.ObjectId(req.params.id)}, (err, drawing) => {
					_.forIn(drawing, (value, key) => {
						drawing[key] = value;
					});
					drawing.updatedAt = Date.now();
					drawing.save(done);
				}); 
		},
		aws: (done) => awsUpload(fileData, done)
	}, (err, result) => {
		if (err)
			return next(err);
		res.status(httpStatus[200]).json(result.drawing[0]);
	});
}

function login(req, res){
	/**
	* Create a JSON web token for user on successful authentication.
	* @param {Object} req
	* @param {Object} res
	*/
	let email 		= req.body.email;
	let password 	= req.body.password;

	if (!email || !password)
		res.sendStatus(httpStatus[400]);

	if (_.includes(admin_emails, email)){
		if (bcrypt.compareSync(password, admin_pass))
			res.status(httpStatus[201]).json({ id_token: jwt.sign(email, jwt_secret), user: email.split("@")[0] });
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

	let file 		= req.file;
	let data 		= JSON.parse(req.body.data);
	let imgType 	= _.last(req.file.originalname.split('.'));
	let newFile 	= data.title.split(/\s+/g).join('-') + "." + imgType;

	async.parallel({
			aws: (done) => awsUpload(_.merge(data, {file: file}, {newFile: newFile}), done),
			db:  (done) => dbSave(_.merge(data, {newFile: newFile}), done),
	 	}, (err, result) => {
		    if (err)
				return next(err);
			res.status(httpStatus[200]).send(result.db);
		}
	);

}

function awsUpload(fileData, next){
	/**
	* Upload a drawing image to AWS bucket
	* Save drawing to database. 
	* @param {Object} fileData
	* @param {function} next
	*/
	if (fileData === undefined)
		return next(null);

	fs.readFile(fileData.file.path, (err, data) => {
		if (err)
			next(err);

		aws.config.update({accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY});
	    let s3 = new aws.S3();
	    let s3Params = {
	    	Bucket: S3_BUCKET,
	    	ACL: 'public-read',
	    	Key: fileData.newFile,
	    	Body: data,
	    	ContentType: 'image/jpeg'
	    };
	    s3.putObject(s3Params, (err, result) => fs.unlink(fileData.file.path, err => next(err, result)));
	});

}

function dbSave(fileData, next){
	/**
	* Save drawing to database and update the order of all drawings. 
	* @param {Object} fileData
	* @param {function} next
	*/
	async.waterfall([
		done => saveDrawing(fileData, done),
	   (drawing, done) => updateOrder(drawing, done)
	], (err, result) => next(err, result));

}

function saveDrawing(fileData, next){
	/**
	* Save a new drawing to the database or update a current drawing.
	* @param {Object} fileData
	* @param {function} next
	*/
	Drawing.findOne({ title: fileData.title }, (err, drawing) => {
		if (drawing){
			drawing.update(next, _.merge(fileData, {url: AWS_URL + fileData.newFile}));
		}
		else {
			let newDrawing = new Drawing();
			newDrawing.update(next, _.merge(fileData, {url: AWS_URL + fileData.newFile}));
		}
	});
}

function getValuesByKey(obj, key){
	return _.forIn(obj, value => value[key]);
}

function updateOrder(drawing, next){
	/**
	* Update drawing order.
	* @param {Object} drawing
	* @param {function} next
	*/
	DrawingOrder.findOne({}, (err, drawingOrder) => {
		if (drawingOrder){
			if (drawing.isBw)
				drawingOrder.ordering.bw.unshift(drawing._id);
			else
				drawingOrder.ordering.color.unshift(drawing._id);
		}
		else {
			let drawingOrder = new DrawingOrder();
			if (drawing.isBw){
				drawingOrder.ordering.bw = [drawing._id];
				drawingOrder.ordering.color = [];
			}
			else {
				drawingOrder.ordering.color = [drawing._id];
				drawingOrder.ordering.bw = [];
			}
		}
		drawingOrder.save((err, drawingOrder) => next(err, drawing));
	});
}