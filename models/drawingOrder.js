'use strict';

let mongoose 		= require('mongoose');
let _ 		 		= require('lodash');
let async 			= require('async');
let Schema 	 		= mongoose.Schema;

let DrawingOrderSchema = new Schema({
	ordering: {
		bw: [Schema.ObjectId],
		color: [Schema.ObjectId]
	}
});

DrawingOrderSchema.methods.update = function(callback, drawing){
	this.ordering.push(drawing._id);
	this.save((err, drawingOrder) => callback(err, drawingOrder, drawing));
}

DrawingOrderSchema.statics.getOrdering = function(callback){
	this.findOne({}, (err, drawingOrder) => {
		if (err)
			callback(err);
		callback(drawingOrder.ordering);
	});
}

module.exports = mongoose.model('DrawingOrder',DrawingOrderSchema);