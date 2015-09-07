var mongoose 		= require('mongoose');
var _ 		 		= require('lodash');
var Schema 	 		= mongoose.Schema;

var DrawingOrderSchema = new Schema({
	ordering: [Schema.ObjectId]
});

module.exports = mongoose.model('DrawingOrder',DrawingOrderSchema);