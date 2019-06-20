import * as movie from "./js6_examples.js"
// var movie = require('./js6_examples');
movie.printHarryPotter(); // movie.js에서 exports 한 이름으로 호출하면 사용할 수 있다.
movie.printDawnOfDead();


import {schema} from  "../node_modules/prosemirror-schema-basic/src/schema-basic" //"prosemirror-schema-basic"
alert(schema);

