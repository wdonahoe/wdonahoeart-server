var mongoose 		= require('mongoose');
var DrawingOrder 	= require('./drawingOrder');
var _ 		 		= require('lodash');
var Schema 	 		= mongoose.Schema;

var DrawingSchema = new Schema({
	title: 		{ type: String, unique: true },
	url: 		{ type: String },
	medium: 	{ type: String },
	width: 		{ type: String },
	height: 	{ type: String },
	isBw: 		{ type: Boolean },
	updated_at: { type: Date, required: false },
	created_at: { type: Date, required: false }
});

DrawingSchema.virtual('dimensions')
	.get(function(){
		return this.width + "\"" + " x " + "\"" + this.height;
	});

DrawingSchema.pre('save', function(next){
	this.width = _.padRight(this.width,'x');
	this.height = _.padRight(this.height,'x');

	var now = new Date();
	this.updated_at = now;
	if (!this.created_at){
		this.created_at = now;
	}
	next();
});

DrawingSchema.methods.update = function(callback, data){
	this.title 	= data.title;
	this.medium = data.medium.toLowerCase();
	this.width 	= data.width;
	this.height = data.height;
	this.isBw 	= data.isBw;
	this.url 	= data.url;

	this.save(function(err, drawing){
		callback(err, drawing);
	});
}

_.each(_.keys(DrawingSchema.paths), function(attr){
	if (DrawingSchema.path(attr).isRequired === undefined){
		DrawingSchema.path(attr).required(true);
	}
});

module.exports = mongoose.model('Drawing',DrawingSchema);