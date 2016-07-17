import {expect} from 'chai';
import {fixture} from '../fixture';
import {Type} from 'vega-lite/src/type';


import * as consts from '../../src/consts';

import * as def from '../../src/trans/def'
import * as neighbor from '../../src/trans/neighbor';
import * as trans from '../../src/trans/trans';
import * as util from '../../src/util';
import {SchemaField} from '../../src/schema';

var startVL = {
  "data": { "url": "/data/cars.json" },
  "mark": "area",
  "transform": {"filter": "datum.Year > 1970 "},
  "encoding": {
    "x": { "type": "temporal", "field": "Year", "timeUnit": "year" },
    "y": { "type": "quantitative",
           "field": "*",
            "aggregate": "count"
      },
    "color": { "type": "nominal", "field": "Origin" }
  }
};

var destinationVL = {
  "data": { "url": "/data/cars.json" },
  "mark": "point",
  "encoding": {
    "x": { "type": "quantitative", "field": "Horsepower", "scale": {"type": "log"} },
    "y": {
      "type": "quantitative",
      "field": "Acceleration",
      "scale": {"type": "log"}
    },
    "color": {"type": "ordinal", "field":"Origin"}
  }
};

describe.only('cp.trans.trans', function () {
  describe('marktype transition', function () {
    it('should return a marktype transition correctly.', function () {
      expect(trans.marktypeTransitionSet(startVL, destinationVL)[0].cost)
           .to.eq(def.DEFAULT_MARKTYPE_TRANSITIONS["AREA_POINT"].cost); //AREA_POINT
    });
  });

  describe('transform transition', function () {
    it('should return SCALE,AGGREGATE, and SORT transitions correctly.', function () {
      expect(trans.transformBasic(startVL, destinationVL, "y", "SCALE", def.DEFAULT_TRANSFORM_TRANSITIONS).cost).to.eq(def.DEFAULT_TRANSFORM_TRANSITIONS["SCALE"].cost);
      expect(trans.transformBasic(startVL, destinationVL, "y", "AGGREGATE", def.DEFAULT_TRANSFORM_TRANSITIONS).cost).to.eq(def.DEFAULT_TRANSFORM_TRANSITIONS["AGGREGATE"].cost);
      expect(trans.transformBasic(startVL, destinationVL, "y", "SORT", def.DEFAULT_TRANSFORM_TRANSITIONS)).to.eq(undefined);
    });
    it('should omit SCALE if omitIncludeRawDomain is true.', function () {
      var testVL = util.duplicate(startVL);
      testVL.encoding.y["scale"] = { includeRawDomain: true };
      var real = trans.transformBasic(startVL, testVL, "y", "SCALE", def.DEFAULT_TRANSFORM_TRANSITIONS, { omitIncludeRawDomain : true });
      expect(real).to.eq(undefined);

    });

    it('should return SETTYPE transition correctly.', function () {
      expect(trans.transformSettype(startVL, destinationVL, "color" , def.DEFAULT_TRANSFORM_TRANSITIONS ).name).to.eq("SETTYPE");
    });

    it('should return all transitions without order.', function(){
      expect(trans.transformTransitionSet(startVL, destinationVL, def.DEFAULT_TRANSFORM_TRANSITIONS).length).to.eq(4);
    });


    var filterTransitions = {
                            "MODIFY_FILTER": def.DEFAULT_TRANSFORM_TRANSITIONS["MODIFY_FILTER"],
                            "ADD_FILTER" : def.DEFAULT_TRANSFORM_TRANSITIONS["ADD_FILTER"],
                            "REMOVE_FILTER" : def.DEFAULT_TRANSFORM_TRANSITIONS["REMOVE_FILTER"]
                          };

    it('should return ADD_FILTER / REMOVE_FILTER transition correctly.', function () {
      var startVL = { "transform": {"filter" : "datum.A == 0 && datum.B == 100 && datum.C == 3  " } };
      var destinationVL = { "transform": {"filter" : "datum.A == 0 && datum.B == 100 && datum.D == 4" }  };
      var sd = trans.filterTransitionSet(startVL, destinationVL, filterTransitions);

      expect(sd.length).to.eq(2);
      console.log(sd[0].detail.field.toString());
      expect(sd[0].name).to.eq("ADD_FILTER");
      expect(sd[0].detail.field).to.eq("D");
      expect(sd[0].detail.op).to.eq("==");
      expect(sd[0].detail.value).to.eq("4");
      expect(sd[1].name).to.eq("REMOVE_FILTER");
      expect(sd[1].detail.field).to.eq("C");
      expect(sd[1].detail.op).to.eq("==");
      expect(sd[1].detail.value).to.eq("3");
    });

    it('should return MODIFY_FILTER  transition correctly.', function () {
      var startVL = { "transform": {"filter" : "datum.Running_Time_min > 0" } };
      var destinationVL = { "transform": {"filter" : "datum.Running_Time_min == 100 && datum.Rotten_Tomato_Rating == 100" }  };
      var sd = trans.filterTransitionSet(startVL, destinationVL, filterTransitions);
      expect(sd[0].name).to.eq("MODIFY_FILTER");
      expect(sd[0].detail.op).to.eq(">, ==");
      expect(sd[0].detail.value).to.eq("0, 100");
      expect(sd[1].name).to.eq("ADD_FILTER");
      expect(sd[1].detail.field).to.eq("Rotten_Tomato_Rating");
      expect(sd[1].detail.op).to.eq("==");
      expect(sd[1].detail.value).to.eq("100");

      startVL = { "transform": {"filter" : "datum.A == 0 && datum.B == 100" } };
      destinationVL = { "transform": {"filter" : "datum.A != 0 && datum.D == 100" }  };
      sd = trans.filterTransitionSet(startVL, destinationVL, filterTransitions);

      expect(sd[0].name).to.eq("MODIFY_FILTER");
      expect(sd[0].detail.op).to.eq("==, !=");
      expect(sd[0].detail.value).to.eq(undefined);

      expect(sd[1].name).to.eq("ADD_FILTER");
      expect(sd[1].detail.field).to.eq("D");
      expect(sd[1].detail.op).to.eq("==");
      expect(sd[1].detail.value).to.eq("100");

      expect(sd[2].name).to.eq("REMOVE_FILTER");
      expect(sd[2].detail.field).to.eq("B");
      expect(sd[2].detail.op).to.eq("==");
      expect(sd[2].detail.value).to.eq("100");
    });


    it('should return FILTER ARITHMETIC transition correctly.', function () {
      var startVL = { "transform": {"filter" : "datum.Running_Time_min > 0" } };
      var destinationVL = { "transform": {"filter" : "datum.Running_Time_min > 10" }  };
      expect(trans.filterTransitionSet(startVL, destinationVL, filterTransitions)[0].name).to.eq("MODIFY_FILTER");

      startVL = { "transform": {"filter" : "datum.A == 0 && datum.B == 100 && datum.S !== 1" } };
      destinationVL = { "transform": {"filter" : "datum.A == 0 && datum.S !== 1 && datum.B == 100" }  };
      expect(trans.filterTransitionSet(startVL, destinationVL, filterTransitions).length).to.eq(0);

      startVL = { "transform": {"filter" : "datum.Running_Time_min > 0" } };
      destinationVL = { "transform": {"filter" : "datum.Running_Time_min == 0" }  };
      expect(trans.filterTransitionSet(startVL, destinationVL, filterTransitions)[0].name).to.eq("MODIFY_FILTER");
    });
  });
  describe('encoding transition', function(){
    it('should return empty array if start is equal to dest.', function(){
      expect(trans.encodingTransitionSet(startVL, startVL, def.DEFAULT_ENCODING_TRANSITIONS).length).to.eq(0);
    });
    it('should return all encoding transitions', function () {
      var source = {
        "data": {"url": "data/cars.json"},
        "mark": "point",
        "encoding": {
          "x": {"field": "Horsepower", "type": "quantitative"}
        }
      };
      var target1 = util.duplicate(source);
      target1.encoding.y = {"field": "Origin", "type": "ordinal"};
      var target2 = util.duplicate(target1);
      delete target2.encoding.x;
      target2.encoding.color = {"field": "Horsepower", "type": "quantitative"};

      var result1 = trans.encodingTransitionSet(source, target1, def.DEFAULT_ENCODING_TRANSITIONS);
      var result2 = trans.encodingTransitionSet(source, target2, def.DEFAULT_ENCODING_TRANSITIONS);
      var result3 = trans.encodingTransitionSet(startVL, destinationVL, def.DEFAULT_ENCODING_TRANSITIONS);


      expect(result1.length).to.eq(1);
      expect(result2.length).to.eq(2);
      expect(result3.length).to.eq(2);

      var destination = {
        "description": "A scatterplot showing horsepower and miles per gallons for various cars.",
        "data": {"url": "data/cars.json"},
        "mark": "point",
        "encoding": {
          "x": {"type": "quantitative","field": "Acceleration"},
          "y": {"type": "quantitative","field": "Horsepower"}
        }
      };


      var origin = {
        "description": "A scatterplot showing horsepower and miles per gallons for various cars.",
        "data": {"url": "data/cars.json"},
        "mark": "point",
        "encoding": {
          "x": {
            "type": "quantitative",
            "field": "Acceleration",
            "bin": true
          },
          "y": {
            "type": "quantitative",
            "field": "*",
            "scale": {"type": "log"},
            "aggregate": "count"
          }
        }
      };
      var result4 = trans.encodingTransitionSet(origin, destination, def.DEFAULT_ENCODING_TRANSITIONS);

      expect(result4.length).to.eq(1);
    });
    it('should return OVER_THE_CEILING if the sum of encoding transitions exceed OVER_THE_CEILING\'s cost', function(){
      this.timeout(10000);
      var startVL = {
        "data": {"url": "data/cars.json"},
        "mark": "line",
        "encoding": {
          "x": {"field": "Year", "type": "temporal", "timeUnit":"year"},
          "y": {"field": "Miles_per_Gallon", "type": "quantitative", "aggregate":"mean"},
          "column" : {"field": "Cylinders", "type": "ordinal"}
        }
      };
      var destinationVL = {
        "data": {"url": "data/cars.json"},
        "mark": "point",
        "encoding": {
          "x": {"field": "Horsepower", "type": "quantitative", "aggregate":"mean"},
          "y": {"field": "Weight_in_lbs", "type": "quantitative", "aggregate":"mean"},
          "size": {"field": "*", "type":"quantitative", "aggregate":"count"}
        }
      };

      expect(trans.encodingTransitionSet(startVL, destinationVL, def.DEFAULT_ENCODING_TRANSITIONS)[0].name)
        .to.eq("OVER_THE_CEILING");
    })
    it('should return the correct answer for redundant encodings', function(){

      var source = {
        "encoding": {
          "x": {
            "field": "Major_Genre",
            "type": "nominal",
            "sort": {"op":"mean","field":"Profit", "order":"descending"}
          },
          "y": {
            "field": "Profit",
            "aggregate":"mean",
            "type":"quantitative"
          }
        }
      };
      var target = util.duplicate(source);
      target.encoding.size = {
        "field":"Profit",
        "aggregate":"stdev",
        "type":"quantitative"
      }
      var result1 = trans.encodingTransitionSet(source, target, def.DEFAULT_ENCODING_TRANSITIONS);

      expect(result1.length).to.eq(1);
    });

  })

  describe('whole transition', function (){
    it('should return all transitions correctly.', function () {

      var result = trans.transitionSet(startVL, destinationVL, def.TRANSITIONS );
      console.log(result);
      expect(result.marktype[0].cost).to.eq(def.DEFAULT_MARKTYPE_TRANSITIONS["AREA_POINT"].cost);
      expect(result.transform.length).to.eq(4);
      expect(result.encoding.length).to.eq(2);


    });
  });
});