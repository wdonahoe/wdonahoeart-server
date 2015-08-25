var mongoose = require('mongoose');
var _ 		 = require('lodash');
var Schema 	 = mongoose.Schema;

var DrawingSchema = new Schema({
	title: 		{ type: String, unique: true },
	url: 		{ type: String, required: false },
	medium: 	{ type: String },
	width: 		{ type: String },
	height: 	{ type: String },
	is_bw: 		{ type: Boolean },
	year: 		{ type: String, required: false },
	order: 		{ type: Number, default: 0 },
	updated_at: { type: Date, required: false },
	created_at: { type: Date, required: false }
});

DrawingSchema.virtual('dimensions')
	.get(function(){
		return this.width + " x " + this.height;
	});

DrawingSchema.virtual('url_title')
	.get(function(){
		return this.title.split(/\s+/g).join('-');
	});

DrawingSchema.pre('save', function(next){
	var now = new Date();
	this.updated_at = now;
	if (!this.created_at){
		this.created_at = now;
	}
	next();
});

_.each(_.keys(DrawingSchema.paths), function(attr){
	if (DrawingSchema.path(attr).isRequired === undefined){
		DrawingSchema.path(attr).required(true);
	}
});

module.exports = mongoose.model('Drawing',DrawingSchema);