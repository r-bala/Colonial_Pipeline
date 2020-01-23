define([
  'dojo/_base/declare'
], function(declare) {
    return declare(null, {
      url: null,
      whereClause: "1=1",
      f: 'json',
      outFields: ["*"],
      returnGeometry: false,
      returnDistinctValues: false
   });
});
