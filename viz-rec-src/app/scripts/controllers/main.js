'use strict';

angular.module('vizRecSrcApp')
  .controller('MainCtrl', function ($scope, dataManager) {
    function set2dSorter(sorterType){
      $scope.current2dSorter = $scope.sorter2d[sorterType];
      updatePairs();

    }
    function updatePairs(){
      var col = $scope.selectedField, dataTable = $scope.dataTable, currentSorter = $scope.current2dSorter;
      var _colPairs = _(dataTable).filter(function(c,i){return c!=col && i < dataTable.originalLength;})
        .map(function(c){
          var pair = [col,c];
          pair.metric = currentSorter.metric(pair);
          return pair;
        })
        .sortBy("metric");

      $scope.colPairs = currentSorter.reverse ? _colPairs.reverse().value(): _colPairs.value();
    }

    //TODO(kanitw): refactor this method's code maybe we need to move them to a separate controller or directives

    /** map of type of sorter */
    $scope.sorter2d = {
      cardinality: {
        metric: function(pair){
          return (pair[1].type == dv.type.numeric ? 20 : pair[1].countTable.length);
        },
        reverse: false
      },
      mutualInformationDistance: {
        metric: function(pair){
          return dataManager.currentData.mi_distance[pair[0].index][pair[1].index];
        },
        reverse: true
      }
    };

    $scope.sorter2dTypes = _.keys($scope.sorter2d);
    $scope.currentSorter2dType = "mutualInformationDistance";
    $scope.$watch("currentSorter2dType", set2dSorter);

    $scope.sorter1d = {
      name:{
        metric: null,
        reverse: false
      },
      cardinality: {
        metric: function(col){
          return col.type == dv.type.numeric ? 20 : col.countTable.length;
        },
        reverse: false
      }
    }

    $scope.sorter1dTypes = _.keys($scope.sorter1d);
    $scope.currentSorter1dType = "name";
    $scope.$watch("currentSorter1dType", set1dSorter);

    function set1dSorter(sorterType){
      $scope.current1dSorter = $scope.sorter1d[sorterType];
      updateSingles();
    }

    function updateSingles(){
      var col = $scope.selectedField, dataTable = $scope.dataTable, currentSorter = $scope.current1dSorter;
      var _cols = _(dataTable).filter(function(c){return !c.isBinCol;});
      if(currentSorter.metric)
        _cols = _cols .sortBy(function(c){
          return currentSorter.metric(c);
        });
      $scope.cols = currentSorter.reverse ? _cols.reverse().value(): _cols.value();
    }


    dataManager.load("data/movies.json", "movies", true, function callback(dataTable){
      console.log("data loaded!");
      $scope.dataTable = dataTable;
      $scope.fix = {type:'nominal', values:['1','1','2']};
      $scope.select = function(col){
        if($scope.selectedField==col)return; //Do nothing
        $scope.selectedField = col;
        updatePairs();
      };

      updateSingles();
      $scope.select(dataTable[0]);
    });



  });