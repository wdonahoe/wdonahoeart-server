var mongoose 		= require('mongoose');
var _ 		 		= require('lodash');
var async 			= require('async');
var Schema 	 		= mongoose.Schema;

var DrawingOrderSchema = new Schema({
	ordering: {
		bw: [Schema.ObjectId],
		color: [Schema.ObjectId]
	}
});

DrawingOrderSchema.methods.update = function(callback, drawing){
	this.ordering.push(drawing._id);
	console.log(this.ordering);

	this.save(function(err, drawingOrder){
		callback(err, drawingOrder, drawing);
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