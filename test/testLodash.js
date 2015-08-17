var _ = require('lodash');

var diffs = ['a','b','c','d'];
var data = {
	'a':1,
	'b':2,
	'c':3
};

var myDiff = _.rearg(_.difference,[1,0]);

console.log(myDiff(diffs))