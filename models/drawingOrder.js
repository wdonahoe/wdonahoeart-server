var mongoose 		= require('mongoose');
var _ 		 		= require('lodash');
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

module.exports = mongoose.model('DrawingOrder',DrawingOrderSchema);