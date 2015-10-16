'use strict';

let mongoose 		= require('mongoose');
let DrawingOrder 	= require('./drawingOrder');
let _ 		 		= require('lodash');
let Schema 	 		= mongoose.Schema;

let DrawingSchema = new Schema({
	title: 		{ type: String, unique: true },
	url: 		{ type: String },
	medium: 	{ type: String },
	width: 		{ type: String },
	height: 	{ type: String },
	isBw: 		{ type: Boolean },
	updated_at: { type: Date, required: false },
	created_at: { type: Date, required: false }
});


DrawingSchema.pre('save', function(next){
	let now = new Date();
	this.updated_at = now;
	if (!this.created_at){
		this.created_at = now;
	}
	next();
});

DrawingSchema.methods.update = function(callback, data){
	this.title 	= data.title;
	this.medium = data.medium.toLowerCase();
	this.width 	= Number(data.width);
	this.height = Number(data.height);
	this.isBw 	= data.isBw;
	this.url 	= data.url;

	this.save((err, drawing) => callback(err, drawing));
}

_.each(_.keys(DrawingSchema.paths), attr => {
	if (DrawingSchema.path(attr).isRequired === undefined){
		DrawingSchema.path(attr).required(true);
	}
});

module.exports = mongoose.model('Drawing',DrawingSchema);