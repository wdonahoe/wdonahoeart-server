var mongoose 		= require('mongoose');
var _ 		 		= require('lodash');
var async 			= require('async');
var Schema 	 		= mongoose.Schema;

var DrawingOrderSchema = new Schema({
	ordering: [Schema.ObjectId]
});

DrawingOrderSchema.methods.update = function(callback, drawingID){
	this.ordering.push(drawingID);
	console.log(this.ordering);

	this.save(function(err, drawingOrder){
		callback(err, drawingOrder);
	});
}

DrawingOrderSchema.statics.getOrdering = function(callback){
	this.findOne({}, function(err, drawingOrder){
		if (err)
			callback(err);
		console.log(drawingOrder.ordering);
		callback(drawingOrder.ordering);
	});
}

module.exports = mongoose.model('DrawingOrder',DrawingOrderSchema);