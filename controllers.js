'use strict';

let Drawing 		= require('./models/drawing');
let DrawingOrder 	= require('./models/drawingOrder');
let config 			= require('./config/config');
let template 		= require('es6-template-strings');
let httpStatus 		= require('http-status');
let mongoose 		= require('mongoose');
let aws 			= require('aws-sdk');
let fs 				= require('fs');
let s3fs 			= require('s3fs');
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

let s3fsImpl = new s3fs( S3_BUCKET, {
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

function putDrawings(req, res){
	/**
	* Update a drawing document.
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	res.status(httpStatus[200]).json({});
}

function deleteDrawings(req, res){
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
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
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
	* Save drawing to database. 
	* @param {Object} req
	* @param {Object} res
	* @param {function} next
	*/
	async.waterfall([
		done => saveDrawing(fileData, done),
	   (drawing, done) => updateOrder(drawing, done)
	], (err, result) => next(err, result));

}

function saveDrawing(fileData, next){
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

function updateOrder(drawing, next){
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