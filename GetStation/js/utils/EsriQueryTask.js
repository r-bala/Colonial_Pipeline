define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/topic',
  "dstore/Memory",
  'dojo/Deferred',
  "dojo/DeferredList",
  'esri/request',
  "esri/tasks/QueryTask",
  "esri/tasks/query",
  './app-topics'
],function(declare,
           lang,
           array,
           topic,
           Memory,
           Deferred,
           DeferredList,
           esriRequest,
           QueryTask,
           Query,
           appTopics){
    return declare(null, {

      query: null,

      loadResults: function(params){
        var def = new Deferred();
        var queryTask = new QueryTask( params.url);
        var queryParams = new Query();
        queryParams.returnGeometry = params.returnGeometry;
        queryParams.outFields = params.outFields;
        queryParams.where = params.whereClause;
        if(params.returnDistinctValues){
          queryParams.returnDistinctValues = true;
        }

        // When resolved, returns features and graphics that satisfy the query.
        queryTask.execute(queryParams).then(function(results){
          console.log(results);
          var features = results.features;
          def.resolve(features);
        });
        return def;
      },

      executeQuery: function(query){
        this.query = query;
        var requestHandle = esriRequest({
              "url": query.queryUrl,
              "content": query,
              handleAs:'json'
            },{
              useProxy:false
            });
          return requestHandle;
      },

      executeRestQuery: function(query){
        this.query = query;
        var requestHandle = esriRequest({
              "url": query.queryUrl,
              "content": query,
              handleAs:'json'
            },{
              useProxy:false
            });
          requestHandle.then(lang.hitch(this,this._onQueryFinish), this._onQueryError);
      },

      _onQueryFinish: function(results, io){
        topic.publish(appTopics.search, null, { success: true, results: results, query: this.query, io:io });
      },

      _onQueryError:function(error, io){
        topic.publish(appTopics.search, null, { success: false, error: error, io:io  });
      }

   });
});
