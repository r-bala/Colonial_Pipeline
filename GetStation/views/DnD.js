define(['dojo/_base/declare',
		'dijit/_WidgetsInTemplateMixin',
		"dijit/_WidgetBase",
		'dijit/_TemplatedMixin',
		'jimu/dijit/Message',
		'jimu/LayerInfos/LayerInfos',
		'jimu/FeatureActionManager',
		'dojo/on',
		"dojo/_base/Color",
		"dojo/dom",
		'dojo/query',
		"dojo/json",
		'dojo/_base/array',
		'dojo/_base/lang',
		'dojo/_base/html',
		"dojo/dom-style",
		'dijit/form/TextBox',
		'dijit/form/Button',
		"dijit/layout/TabContainer",
		"dijit/layout/ContentPane",
		"dijit/form/ValidationTextBox",
		"esri/toolbars/draw",
		"esri/geometry/Extent",
		"esri/geometry/Point",
		"esri/geometry/Polyline",
		"esri/graphic",
		"esri/request",
		"esri/Color",
		"esri/SpatialReference",
		'esri/symbols/SimpleFillSymbol',
		'esri/symbols/SimpleLineSymbol',
		'esri/symbols/SimpleMarkerSymbol',
		'esri/tasks/FeatureSet',
		"esri/symbols/jsonUtils",
		"dojo/data/ItemFileReadStore",
		'dojo/data/ItemFileWriteStore',
		"dojo/dom",
		"dojo/dom-construct",
		"dojo/json",
		"dojo/parser",
		"dijit/layout/BorderContainer",
		"dijit/layout/ContentPane",
		"dijit/form/RadioButton",
		"dojox/data/CsvStore",
		"dojox/encoding/base64",
		"dojox/grid/DataGrid",
		"dojo/Deferred",
		'dojo/text!./DnD.html',
		"esri/dijit/Popup",
		"esri/domUtils",
		"esri/geometry/Extent",
		"esri/geometry/Multipoint",
		"esri/geometry/Point",
		"esri/InfoTemplate",
		"esri/layers/FeatureLayer",
		"esri/layers/CSVLayer",
		"esri/geometry/webMercatorUtils",
		"esri/tasks/query",
		'./AddFromFilePane',
		'.././js/utils/EsriQuery',
		'.././js/utils/EsriQueryTask'
	],
	function (declare,
		_WidgetsInTemplateMixin,
		_WidgetBase,
		_TemplatedMixin,
		Message,
		LayerInfos,
		FeatureActionManager,
		on,
		Color,
		dom,
		query,
		json,
		array,
		lang,
		html,
		domStyle,
		TextBox,
		Button,
		TabContainer,
		ContentPane,
		ValidationTextBox,
		Draw,
		Extent,
		Point,
		Polyline,
		Graphic,
		esriRequest,
		eColor,
		SpatialReference,
		SimpleFillSymbol,
		SimpleLineSymbol,
		SimpleMarkerSymbol,
		FeatureSet,
		jsonUtils,
		ItemFileReadStore, ItemFileWriteStore, dom, domConstruct, json, parser, BorderContainer,
		ContentPane, RadioButton, CsvStore, dojoxBase64, DataGrid, Deferred, template,
		Popup, domUtils, Extent, Multipoint, Point, InfoTemplate, FeatureLayer, CSVLayer,
		webMercatorUtils, Query, AddFromFilePane, EsriQuery, EsriQueryTask) {

	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {

		templateString: template,
		baseClass: 'sempra-DnD',

		// Properties to be sent into constructor
		//list of lat and lon field strings
		latFieldStrings: ['lat', 'latitude', 'y', 'ycenter'],
		longFieldStrings: ['lon', 'long', 'longitude', 'x', 'xcenter'],
		routeFieldStrings: ["routeid", "rid", "route", "routeId", "RouteId", "routeid"],
		lineNameFieldStrings: ["linename", "lineName", "pipeName", "LineName", "PipeName"],
		measureFieldStrings: ["measure", "meas", "beginmeasure", "cMeasure"],
		routeField: null,
		measureField: null,
		lineNameField: null,
		latField:null,
		longField:null,

		postCreate: function () {
			// summary:
			//    Overrides method of same name in dijit._Widget.
			// tags:
			//    private
			//  parser.parse();
			this._initUI();
			this.featureActionManager = FeatureActionManager.getInstance();
			LayerInfos.getInstance(this.map, this.map.itemInfo).then(lang.hitch(this, function (layerInfosObj) {
					this.layerInfosObj = layerInfosObj;
					var layers = this.layerInfosObj.getLayerInfoArray();
					this.own(layerInfosObj.on(
							'layerInfosChanged',
							lang.hitch(this, this.onLayerInfosChanged)));
				}));
			this.inherited(arguments);

		},

		resizeGrid: function () {
			console.log("Resize Dnd grid");
			//domStyle.set(this.gridDiv, "height", "100%");
			console.log(query(".gridDiv").parents(".jimu-widget-frame")[0].offsetHeight);
			var height = query(".gridDiv").parents(".jimu-widget-frame")[0].offsetHeight - 160;
			this.grid.resize();
			this.grid.update();
			domStyle.set(this.gridDiv, "height", "auto");
			domStyle.set("dgrid", "height", height + "px");
		},

		_initUI: function () {

			this.own(on(this.clearBtn, "click", lang.hitch(this, this.clearAll)));
			this.own(on(this.exportBtn, "click", lang.hitch(this, this.exportCsv)));

			this.own(on(window, "resize", lang.hitch(this, this.resizeGrid)));

			/*set up layout*/
			var layout = [[{
						'name': 'X',
						'field': 'x',
						'width': '100px'
					}, {
						'name': 'Y',
						'field': 'y',
						'width': '100px'
					}, {
						'name': 'Status',
						'field': 'status',
						'width': '100px'
					}, {
						'name': 'Route Name',
						'field': 'routeName',
						'width': '150px'
					}, {
						'name': 'Engineering Stationing',
						'field': 'measure',
						'width': '150px'
					}, {
						'name': 'Continuous Stationing',
						'field': 'cMeasure',
						'width': '150px'
					}, {
						'name': 'OID',
						'field': 'oid',
						'width': '100px'
					}
				]];

			var data = {
				items: []
			};

			var store = new ItemFileWriteStore({
					identifier: "id",
					data: data
				});

			this.addFromFilePane = new AddFromFilePane({
					wabWidget: this.wabWidget,
					i18n: this.nls
				}, this.fileNode);
			topic.subscribe("DnDFeatures", lang.hitch(this, function (layers) {
					console.error("Features", layers);
					this.onLayerFetchComplete(this, layers[0]);
				}));
			this.addFromFilePane.startup();

			/*create a new grid*/
			this.grid = new DataGrid({
					id: 'dgrid',
					store: store,
					rowsPerPage: 5,
					rowSelector: '20px'
				});

			/*append the new grid to the div*/
			this.grid.placeAt(this.gridDiv);
			
			html.setStyle(this.fileNode, "display", "");
			
			html.setStyle(this.gridDiv, "display", "none");

			/*Call startup() to render the grid*/
			this.grid.startup();

			this.own(
				on(this.grid, 'CellClick', lang.hitch(this, this.onRowClickHandler)));

			/*this.grid.on("CellClick", lang.hitch(this,function(event){
			var rowId = event.rowIndex;
			this.grid.selection.setSelected(rowId, true);
			this.grid.render();
			}));*/

		},

		onLayerFetchComplete: function (_this, layer) {

			var status = _this.status;
			console.warn({
				layer
			});

			var _getCumulativeMeasure = lang.hitch(_this, _this._getCumulativeMeasure);

			var fieldNames = array.map(layer.fields, function (field) {
					return field.name;
				});

			var routeMeasureRadio = _this.routeMeasureRadio;

			var showResponse = lang.hitch(_this, _this.showResponse);

			var engineeringLayer = _this.engineeringLayer;

			var locationServiceURL = _this.engineeringLayer.url + _this.engineeringLayer.geometryToMeasure;
			var routeMeasureServiceURL = _this.engineeringLayer.url + _this.engineeringLayer.measureToGeometry;
			var serviceUrl = locationServiceURL;
			var outputDef;
			if (routeMeasureRadio.checked) {
				serviceUrl = routeMeasureServiceURL;
				outputDef = this._processRouteMeasure(_this, layer, fieldNames);
			} else {
				outputDef = this._processXY(_this, layer, fieldNames);
			}

			if (outputDef == null)
				return;

			outputDef.then(function (output) {
				// Run the SOE query
				var params = {
					serviceUrl: serviceUrl,
					content: output.content,
					items: layer,
					locations: output.locations,
					engineeringLayer: engineeringLayer,
					status: status,
					_getCumulativeMeasure: _getCumulativeMeasure,
					_this: _this,
					showResponse: showResponse
				};
				if (routeMeasureRadio.checked) {
					_this._executeMeasureSOERequest(params);
				} else {
					_this._executeSOERequest(params);
				}
			});
		},

		_lookUpRouteId: function (_this, layer, routeFieldStrings, lineNameField) {
			var def = new Deferred();
			var uniqueLineNames = [];
			array.forEach(layer.graphics, function (feature) {
				var lineName = "'" + feature.attributes[lineNameField] + "'";
				if (uniqueLineNames.indexOf(lineName) == -1) {
					uniqueLineNames.push(lineName);
				}
			});

			var engineeringLayer = _this.engineeringLayer;
			var queryField = engineeringLayer.queryField;
			var routeIdField = engineeringLayer.routeIdField;
			var routeNameField = engineeringLayer.routeNameField;
			var esriQuery = new EsriQuery();
			esriQuery.url = engineeringLayer.queryUrl;
			esriQuery.whereClause = queryField + " in (" + uniqueLineNames.toString() + ")";
			esriQuery.outFields = [queryField, routeIdField, routeNameField];
			esriQuery.returnGeometry = false;
			esriQuery.returnDistinctValues = true;

			var esriQueryTask = new EsriQueryTask();
			esriQueryTask.loadResults(esriQuery).then(lang.hitch(_this, function (queryResults) {
					var features = queryResults;
					var routeIds = [];
					array.forEach(queryResults, function (f, index) {
						routeIds.push({
							lineName: f.attributes[queryField],
							routeId: f.attributes[routeIdField]
						});
					});
					if (routeIds.length > 0) {
						def.resolve(routeIds);
					} else {
						def.resolve(null);
					}
				}));

			return def;
		},

		_lookUpLineDetails: function (_this, routeId) {
			var def = new Deferred();
			var engineeringLayer = _this.engineeringLayer;
			var queryField = engineeringLayer.queryField;
			var lineIdField = engineeringLayer.lineIdField;
			var routeIdField = engineeringLayer.routeIdField;
			var routeNameField = engineeringLayer.routeNameField;
			var esriQuery = new EsriQuery();
			esriQuery.url = engineeringLayer.queryUrl;
			esriQuery.whereClause = routeIdField + " = '" + routeId.toString() + "'";
			esriQuery.outFields = [queryField, routeIdField, lineIdField];
			esriQuery.returnGeometry = false;
			esriQuery.returnDistinctValues = true;

			var esriQueryTask = new EsriQueryTask();
			esriQueryTask.loadResults(esriQuery).then(lang.hitch(_this, function (queryResults) {
					var features = queryResults;
					var lineItems = [];
					array.forEach(queryResults, function (f, index) {
						lineItems.push({
							lineName: f.attributes[queryField],
							lineId: f.attributes[lineIdField],
							routeId: f.attributes[routeIdField]
						});
					});
					if (lineItems.length > 0) {
						def.resolve(lineItems);
					} else {
						def.resolve(null);
					}
				}));
			return def;
		},

		_processRouteMeasure: function (_this, layer, fieldNames) {
			var def = new Deferred();
			var routeFieldStrings = _this.routeFieldStrings;
			var lineNameFieldStrings = _this.lineNameFieldStrings;
			var measureFieldStrings = _this.measureFieldStrings;
			var map = _this.map;
			var tolerance = 0.005;
			if (_this.engineeringLayer.tolerance) {
				tolerance = _this.engineeringLayer.tolerance;
			}
			array.forEach(fieldNames, function (fieldName) {
				var matchId;
				matchId = dojo.indexOf(routeFieldStrings, fieldName.toLowerCase());
				if (matchId !== -1) {
					_this.routeField = fieldName;
				}

				matchId = dojo.indexOf(lineNameFieldStrings, fieldName.toLowerCase());
				if (matchId !== -1) {
					_this.lineNameField = fieldName;
				}

				matchId = dojo.indexOf(measureFieldStrings, fieldName.toLowerCase());
				if (matchId !== -1) {
					_this.measureField = fieldName;
				}
			});

			var lookUpDef;
			if (!_this.routeField) {
				if (_this.lineNameField) {
					lookUpDef = _this._lookUpRouteId(_this, layer, routeFieldStrings, _this.lineNameField);
				} else {
					// return message
					new Message({
						message: _this.nls.routeIdAndlineNameFieldsNotFound
					});
					return null;
				}
			}

			if (lookUpDef) {
				lookUpDef.then(function (routeIds) {
					var locations = new Array();
					array.forEach(layer.graphics, function (feature) {

						var measure = parseFloat(feature.attributes[_this.measureField]);
						var routeIdObjs = array.filter(routeIds, function (route) {
								return route.lineName == feature.attributes[_this.lineNameField];
							});
						if (routeIdObjs && routeIdObjs.length > 0) {
							array.forEach(routeIdObjs, function (routeIdObj) {
								var routeId = routeIdObj.routeId;
								var measureLocation = {
									'routeId': routeId,
									'lineName': feature.attributes[_this.lineNameField],
									'measure': measure
								};
								locations.push(measureLocation);
							});
						}
					});

					var content = {
						'locations': json.stringify(locations),
						'tolerance': tolerance,
						'f': "json"
					};

					lang.mixin(content, {
						outSR: map.spatialReference.wkid
					});
					def.resolve({
						content: content,
						locations: locations
					});

				});
			} else {
				var locations = new Array();
				array.forEach(layer.graphics, function (feature) {
					var routeId = feature.attributes[_this.routeField];
					var measure = parseFloat(feature.attributes[_this.measureField]);

					var measureLocation = {
						'routeId': routeId===undefined?"":routeId,
						'measure': measure
					};
					locations.push(measureLocation);
				});

				var content = {
					'locations': json.stringify(locations),
					'tolerance': tolerance,
					'f': "json"
				};

				lang.mixin(content, {
					outSR: map.spatialReference.wkid
				});
				def.resolve({
					content: content,
					locations: locations
				});
			}

			return def;

		},

		_processXY: function (_this, layer, fieldNames) {
			var def = new Deferred();
			var latField,
			longField;
			var latFieldStrings = _this.latFieldStrings;
			var longFieldStrings = _this.longFieldStrings;
			var tolerance = 0.005;
			if (_this.engineeringLayer.tolerance) {
				tolerance = _this.engineeringLayer.tolerance;
			}
			array.forEach(fieldNames, function (fieldName) {
				var matchId;
				matchId = array.indexOf(latFieldStrings, fieldName.toLowerCase());
				if (matchId !== -1) {
					_this.latField = latField = fieldName;
				}

				matchId = array.indexOf(longFieldStrings, fieldName.toLowerCase());
				if (matchId !== -1) {
					_this.longField = longField = fieldName;
				}
			});
			var locations = new Array();
			array.forEach(layer.graphics, function (feature) {

				var latitude = parseFloat(feature.attributes[latField]);
				var longitude = parseFloat(feature.attributes[longField]);

				var geometryLocation = {
					'geometry': {
						'x': longitude,
						'y': latitude
					}
				};
				locations.push(geometryLocation);
			});

			var content = {
				'locations': json.stringify(locations),
				'tolerance': tolerance,
				'f': "json"
			};
			lang.mixin(content, {
				inSR: 4326
			});
			def.resolve({
				content: content,
				locations: locations
			});

			return def;
		},

		_checkAmbiguousLocations: function (response) {
			var locations = response.locations;
			if (locations.length > 0) {
				var validLocations = array.filter(locations, function (location) {
						return location.status !== "esriLocatingCannotFindLocation";
					});

				var notFoundLocations = array.filter(locations, function (location) {
						return location.status === "esriLocatingCannotFindLocation";
					});

				var singleLocations = array.filter(locations, function (location) {
						return location.status === "esriLocatingOK";
					});

				var multipleLocations = array.filter(locations, function (location) {
						return location.status === "esriLocatingMultipleLocation";
					});

				return {
					multipleLocations: multipleLocations,
					singleLocations: singleLocations,
					notFoundLocations: notFoundLocations,
					validLocations: validLocations
				};

			}

			// lang.mixin(response,{locations:validlocations});

		},

		_executeMeasureSOERequest: function (params) {
			esriRequest({
				url: params.serviceUrl,
				content: params.content,
				callbackParamName: "callback",
				handleAs: "json",
				load: function (response) {
					params.status.innerHTML = '';
					if (response && response.locations) {
						var locs = response.locations;
						if (locs.length == 0) {
							this.showResponse(response, items, locations);
							return;
						}
					}
					var locationInfos = params._this._checkAmbiguousLocations(response);
					if (locationInfos) {
						if (locationInfos.multipleLocations) {}
						//lang.mixin(response,{locations:locationInfos.singleLocations});
						if (params.engineeringLayer.translate && params.engineeringLayer.targetNetworkLayerIds) {
							params._getCumulativeMeasure(response, params.items, params.locations);
						} else {
							params.showResponse(response, params.items, params.locations);
						}
					}
				},
				error: function (error) {
					//params.status.innerHTML = '<br/>Error fetching measures for locations. Details:' + error.message;
					console.error("Error fetching route measures for locations: ", error);
					this.routeField =null;
					this.measureField= null;
					this.lineNameField =null;
					this.latField = null;
					this.longField = null;
					this.longField = null;
					new Message({
						message: params._this.nls.fileMissingFields
					});
					return null;
				}
			});
		},

		_executeSOERequest: function (params) {
			esriRequest({
				url: params.serviceUrl,
				content: params.content,
				callbackParamName: "callback",
				handleAs: "json",
				load: function (response) {
					params.status.innerHTML = '';
					var locationInfos = params._this._checkAmbiguousLocations(response);
					if (locationInfos) {
						if (locationInfos.multipleLocations) {}
						//  lang.mixin(response,{locations:locationInfos.singleLocations});
						if (params.engineeringLayer.translate && params.engineeringLayer.targetNetworkLayerIds) {
							params._getCumulativeMeasure(response, params.items, params.locations);
						} else {
							params.showResponse(response, params.items, params.locations);
						}
					}
				},
				error: function (error) {
					//params.status.innerHTML = '<br/>Error fetching measures for locations. Details:' + error.message;
					console.error("Error fetching route measures for locations: ", error);
					this.routeField =null;
					this.measureField= null;
					this.lineNameField =null;
					this.latField = null;
					this.longField = null;
					new Message({
						message: params._this.nls.fileMissingFields
					});
					return null;
				}
			});
		},

		_getCumulativeMeasure: function (response, items, locations) {
			var locationParams = [];
			var locs = response.locations;
			if (this.routeMeasureRadio.checked) {
				array.forEach(locs, function (item) {
					var result = item;
					if (item.geometry && item.geometry.m) {
						result.measure = item.geometry.m;
					} else {
						result.measure = 0;
					}
					if (result) {
						locationParams.push({
							routeId: result.routeId,
							measure: result.measure
						});
					}
				});
			} else {
				array.forEach(locs, function (item) {
					var results = item.results;
					array.forEach(results, function (result) {
						if (result) {
							locationParams.push({
								routeId: result.routeId,
								measure: result.measure
							});
						}
					});
				});
			}

			// Set up SOE URL and parameters
			var serviceURL = this.engineeringLayer.url + this.engineeringLayer.translate;
			var qparams = {
				locations: json.stringify(locationParams),
				targetNetworkLayerIds: json.stringify(this.engineeringLayer.targetNetworkLayerIds),
				f: "json"
			};

			// Run the SOE query
			var soeRequest = esriRequest({
					url: serviceURL,
					content: qparams,
					handleAs: "json",
					callbackParamName: "callback"
				});

			soeRequest.then(
				lang.hitch(this, function (translatedResponse) {
					console.log("Success: ", translatedResponse);
					response.translatedResponse = translatedResponse
						this.showResponse(response, items, locations);
				}), lang.hitch(this, function (error) {
					status.innerHTML = '<br/>Error getting continuous measures. ' + error.message;
					console.error("Error getting continuous measures: ", error);

					this.showResponse(response, items, locations);
				}));
		},

		_createRow: function (params, _this) {
			//var items = params.items;
			var layer = params.layer;
			var item = params.responseLocation;
			var location = params.location;
			var responseLocation = params.responseLocation;
			var translatedLocation = params.translatedLocation;
			var objectId = params.objectId;
			var map = params.map;
			if (!params.features) {
				params.features = [];
			}
			var attributes = {};

			var routeId,
			measure,
			geometry,
			geometryType,
			x,
			y,
			geometryJson,
			cMeasure;

			attributes["__OBJECTID"] = objectId;

			if (params.isRouteMeasure) {
				routeId = responseLocation.routeId;
				geometryType = responseLocation.geometryType;

				if (responseLocation.geometry) {
					geometry = (esri.geometry.Point)(responseLocation.geometry);
					geometry.setSpatialReference(map.spatialReference);
					geometryJson = geometry.toJson();

					//    attributes["Longitude"] = x;
					//    attributes["Latitude"] = y;
				}

				routeId = location.routeId;
				measure = location.measure

					//    attributes["RouteId"] = routeId;
					attributes["EngineeringStationing"] = Math.round(measure);

			} else {

				if (!isNaN(location.geometry.x) && !isNaN(location.geometry.y)) {
					geometry = new Point(location.geometry.x, location.geometry.y);
					geometry = webMercatorUtils.geographicToWebMercator(geometry);
					geometry.setSpatialReference(map.spatialReference);
					geometryJson = geometry.toJson();

					//    attributes["Longitude"] = x;
					//    attributes["Latitude"] = y;
				}

				routeId = responseLocation.routeId;
				measure = responseLocation.measure;

				//    attributes["RouteId"] = routeId;
				attributes["EngineeringStationing"] = Math.round(measure);

			}
			var geoGeometry = webMercatorUtils.webMercatorToGeographic(geometry);
			x = geoGeometry.x;
			y = geoGeometry.y;

			var routeNames = array.filter(params.routeNamesMap, function (r) {
					return r.routeId === routeId;
				});

			objectId++;
			var routeName = "";
			if (routeNames && routeNames.length > 0) {
				routeName = routeNames[0].routeName;
			}
			if (translatedLocation) {
				//lang.mixin(row,{cMeasure:Math.round(translatedLocation.measure)});
				cMeasure = Math.round(translatedLocation.measure);
			}
			attributes["ContinousStationing"] = cMeasure;
			attributes["RouteName"] = routeName;

			var csvItems = array.filter(layer.graphics, function (feature) {
					if (params.isRouteMeasure) {
						var csvRouteId = feature.attributes[_this.routeField ? _this.routeField : _this.lineNameField];
						var msure = feature.attributes[_this.measureField];
						if (csvRouteId && csvRouteId == (_this.routeField ? routeId : location.lineName) && msure && msure == measure) {
							return feature;
						}
					} else {
						var csvLat = feature.attributes[_this.latField];
						var csvLon = feature.attributes[_this.longField];
						if (csvLat && csvLon && location.geometry && csvLat == location.geometry.y && csvLon == location.geometry.x) {
							return feature;
						}
					}
				});

			var row = {};
			lang.mixin(row, attributes);
			if (params.isRouteMeasure) {
				lang.mixin(row, {
					X: x,
					Y: y,
					Staus: responseLocation.status,
					RouteId: routeId
				});
			} else {
				lang.mixin(row, {
					Staus: responseLocation.status,
					RouteId: routeId
				});
			}
			if (csvItems && csvItems.length > 0) {
				for(var key in csvItems[0].attributes){
					attributes[key] = csvItems[0].attributes[key];
				}
			}
			lang.mixin(row, csvItems[0].attributes);

			if (params.isRouteMeasure) {
				attributes["Lat"] = y;
				attributes["Long"] = x;
			}
			attributes["LineName"] = routeNames[0].lineName;

			var feature = {
				"geometry": geometryJson,
				"attributes": attributes
			};
			params.features.push(feature);
			params.fields = attributes;

			params.gridData.push(row);

			return objectId;

		},

		_lookUpRouteNames: function (_this, locations) {
			var def = new Deferred();
			if (locations && locations.length > 0) {
				var routeIds = []
				array.forEach(locations, function (location) {
					var routeId = location.routeId;
					var results = location.results;
					if (results && results.length > 0) {
						array.forEach(results, function (result) {
							routeId = result.routeId
								if (routeId && routeIds.indexOf("'" + routeId + "'") == -1) {
									routeIds.push("'" + routeId + "'");
								}
						});
					} else {
						if (routeId && routeIds.indexOf("'" + routeId + "'") == -1) {
							routeIds.push("'" + routeId + "'");
						}
					}
				});

				var routeIdField = _this.engineeringLayer.routeIdField;
				var routeNameField = _this.engineeringLayer.routeNameField;
				var lineIdField = _this.engineeringLayer.lineIdField;
				var lineNameField = _this.engineeringLayer.queryField;
				var esriQuery = new EsriQuery();
				esriQuery.url = this.engineeringLayer.queryUrl;
				esriQuery.whereClause = routeIdField + " in (" + routeIds + ")";
				esriQuery.outFields = [routeNameField, routeIdField, lineIdField, lineNameField];
				esriQuery.returnGeometry = false;

				var esriQueryTask = new EsriQueryTask();
				esriQueryTask.loadResults(esriQuery).then(function (queryResults) {
					var features = queryResults;
					var routeNameMap = [];
					array.forEach(queryResults, function (f, index) {
						var attr = f.attributes;
						routeNameMap.push({
							routeId: attr[routeIdField],
							routeName: attr[routeNameField],
							lineId: attr[lineIdField],
							lineName: attr[lineNameField]
						})
					});
					def.resolve(routeNameMap);
				});
			}
			return def;
		},

		showResponse: function (response, layer, locations) {
			this.map.graphics.clear();
			var _this = this;
			var routeMeasureRadio = this.routeMeasureRadio;
			var objectId = 0;
			var responseLocations = response.locations;
			var features = [];
			var fields;
			var idx = 0;
			var table = query(".add-file-pane", this.domNode)[0];
			if (table) {
				html.setStyle(table, "display", "none");
			}
			html.setStyle(this.gridDiv, "display", "");

			this._lookUpRouteNames(this, routeMeasureRadio.checked ? locations : responseLocations).then(function (routeNamesMap) {

				//var popupInfo = this.generateDefaultPopupInfo(featureCollection);
				var infoTemplate = new InfoTemplate("Attributes", "${*}"); //new InfoTemplate(this.buildInfoTemplate(popupInfo));
				//var latField, longField;
				//    var fieldNames = csvStore.getAttributes(items[0]);


				var gridData = [];
				var translatedLocations = [];
				if (response.translatedResponse) {
					translatedLocations = response.translatedResponse.locations;
				}

				var skipNotFoundLocs = responseLocations.length >= layer.graphics.length ? true : false;
				// Add records in this CSV store as graphics
				array.forEach(responseLocations, function (responseLocation, index) {

					if (!skipNotFoundLocs || (responseLocation.status == "esriLocatingMultipleLocation" || responseLocation.status == "esriLocatingOK")) {

						if (routeMeasureRadio.checked) {
							var params = {
								objectId: objectId,
								layer: layer,
								responseLocation: responseLocation,
								location: locations[index],
								routeNamesMap: routeNamesMap,
								isRouteMeasure: routeMeasureRadio.checked,
								gridData: gridData,
								features: features,
								map: _this.map
							};
							if (translatedLocations // && routeTranslation.routeId == locationInfo.routeId
								 && translatedLocations.length > 0) {

								var tLocs = translatedLocations[index].translatedLocations;

								if (tLocs && tLocs.length == 1) {
									array.forEach(tLocs, function (tLoc) {
										lang.mixin(params, {
											translatedLocation: tLoc,
											objectId: objectId
										});
										objectId = _this._createRow(params, _this);
									});
								} else if (tLocs && tLocs.length > 1) {
									var lineIdObj = array.filter(params.routeNamesMap, function (r) {
											return r.routeId === params.location.routeId;
										});

									var filteredtLocs = array.filter(tLocs, function (tLoc) {
											return tLoc.routeId == lineIdObj[0].lineId;
										});
									lang.mixin(params, {
										translatedLocation: filteredtLocs[0],
										objectId: objectId
									});
									objectId = _this._createRow(params, _this);
								} else {
									lang.mixin(params, {
										translatedLocation: translatedLocations[index],
										objectId: objectId
									});
									objectId = _this._createRow(params, _this);
								}
							}
							fields = params.fields;
						} else {

							var locationResults = responseLocation.results;
							array.forEach(locationResults, function (locationInfo) {
								console.log(idx);
								var tLocs = translatedLocations[idx].translatedLocations;

								lang.mixin(locationInfo, {
									status: responseLocation.status
								});

								var params = {
									objectId: objectId,
									layer: layer,
									responseLocation: locationInfo,
									location: locations[index],
									routeNamesMap: routeNamesMap,
									isRouteMeasure: routeMeasureRadio.checked,
									gridData: gridData,
									features: features,
									map: _this.map
								};

								if (tLocs && tLocs.length == 1) {
									array.forEach(tLocs, function (tLoc) {
										lang.mixin(params, {
											translatedLocation: tLoc,
											objectId: objectId
										});
										objectId = _this._createRow(params, _this);
									});
								} else if (tLocs && tLocs.length > 1) {
									var lineIdObj = array.filter(params.routeNamesMap, function (r) {
											return r.routeId === locationInfo.routeId;
										});

									var filteredtLocs = array.filter(tLocs, function (tLoc) {
											return tLoc.routeId == lineIdObj[0].lineId;
										});
									lang.mixin(params, {
										translatedLocation: filteredtLocs[0],
										objectId: objectId
									});
									objectId = _this._createRow(params, _this);
								} else {
									objectId = _this._createRow(params, _this);
								}
								fields = params.fields;
								idx++;
							});

						}
					}
				});
				var featureCollection = _this.generateFeatureCollectionTemplateCsv({
						features: features,
						fields: fields
					});

				featureLayer = new FeatureLayer(featureCollection, {
						infoTemplate: infoTemplate,
						id: 'csvLayer' + "-" + Date.now()
					});
				_this.featureLayer = featureLayer;
				featureLayer.advancedQueryCapabilities = {
					"supportsPagination": false,
					"supportsQueryWithDistance": false,
					"supportsReturningQueryExtent": false,
					"supportsStatistics": false,
					"supportsOrderBy": false,
					"supportsDistinct": false
				};
				// featureLayer.__popupInfo = popupInfo;
				_this.map.addLayer(featureLayer);
				_this.zoomToData(featureLayer);

				var data = {
					items: gridData
				};
				var gridLayout = [];
				for (var key in gridData[0]) {
					gridLayout.push({
						field: key,
						name: key,
						editable: false
					});
				}

				var store = new ItemFileWriteStore({
						data: data
					});
				_this.grid.setStructure(gridLayout);
				_this.grid.setStore(store);
			});
		},

		generateFeatureCollectionTemplateCsv: function (params) {
			//create a feature collection for the input csv file
			var featureCollection = {
				"layerDefinition": null,
				"featureSet": {
					"features": params.features,
					"geometryType": "esriGeometryPoint"
				}
			};
			featureCollection.layerDefinition = {
				"geometryType": "esriGeometryPoint",
				"objectIdField": "__OBJECTID",
				"type": "Feature Layer",
				"typeIdField": "",
				"drawingInfo": {
					"renderer": {
						"type": "simple",
						"symbol": jsonUtils.fromJson(this.config.csvLayerSymbol)
					}
				},
				"fields": [{
						"name": "__OBJECTID",
						"alias": "__OBJECTID",
						"type": "esriFieldTypeOID",
						"editable": false,
						"domain": null
					}
				],
				"types": [],
				"capabilities": "Query"
			};

			var fields = Object.keys(params.fields);
			var features = params.features;
			array.forEach(fields, function (field) {
				if (field !== "__OBJECTID") {
					var value = params.fields[field];
					var parsedValue = Number(value);
					if (isNaN(parsedValue)) { //check first value and see if it is a number
						featureCollection.layerDefinition.fields.push({
							"name": field,
							"alias": field,
							"type": "esriFieldTypeString",
							"editable": true,
							"domain": null
						});
					} else {
						featureCollection.layerDefinition.fields.push({
							"name": field,
							"alias": field,
							"type": "esriFieldTypeDouble",
							"editable": true,
							"domain": null
						});
					}
				}
			});
			return featureCollection;
		},

		generateFeatureCollectionTemplateCsv2: function (store, items) {
			//create a feature collection for the input csv file
			var featureCollection = {
				"layerDefinition": null,
				"featureSet": {
					"features": [],
					"geometryType": "esriGeometryPoint"
				}
			};
			featureCollection.layerDefinition = {
				"geometryType": "esriGeometryPoint",
				"objectIdField": "__OBJECTID",
				"type": "Feature Layer",
				"typeIdField": "",
				"drawingInfo": {
					"renderer": {
						"type": "simple",
						"symbol": jsonUtils.fromJson(this.config.csvLayerSymbol)
					}
				},
				"fields": [{
						"name": "__OBJECTID",
						"alias": "__OBJECTID",
						"type": "esriFieldTypeOID",
						"editable": false,
						"domain": null
					}
				],
				"types": [],
				"capabilities": "Query"
			};

			var fields = store.getAttributes(items[0]);
			array.forEach(fields, function (field) {
				var value = store.getValue(items[0], field);
				var parsedValue = Number(value);
				if (isNaN(parsedValue)) { //check first value and see if it is a number
					featureCollection.layerDefinition.fields.push({
						"name": field,
						"alias": field,
						"type": "esriFieldTypeString",
						"editable": true,
						"domain": null
					});
				} else {
					featureCollection.layerDefinition.fields.push({
						"name": field,
						"alias": field,
						"type": "esriFieldTypeDouble",
						"editable": true,
						"domain": null
					});
				}
			});
			return featureCollection;
		},

		generateDefaultPopupInfo: function (featureCollection) {
			var fields = featureCollection.layerDefinition.fields;
			var decimal = {
				'esriFieldTypeDouble': 1,
				'esriFieldTypeSingle': 1
			};
			var integer = {
				'esriFieldTypeInteger': 1,
				'esriFieldTypeSmallInteger': 1
			};
			var dt = {
				'esriFieldTypeDate': 1
			};
			var displayField = null;
			var fieldInfos = array.map(fields, lang.hitch(this, function (item, index) {
						if (item.name.toUpperCase() === "NAME") {
							displayField = item.name;
						}
						var visible = (item.type !== "esriFieldTypeOID" && item.type !== "esriFieldTypeGlobalID" && item.type !== "esriFieldTypeGeometry");
						var format = null;
						if (visible) {
							var f = item.name.toLowerCase();
							var hideFieldsStr = ",stretched value,fnode_,tnode_,lpoly_,rpoly_,poly_,subclass,subclass_,rings_ok,rings_nok,";
							if (hideFieldsStr.indexOf("," + f + ",") > -1 || f.indexOf("area") > -1 || f.indexOf("length") > -1 || f.indexOf("shape") > -1 || f.indexOf("perimeter") > -1 || f.indexOf("objectid") > -1 || f.indexOf("_") == f.length - 1 || f.indexOf("_i") == f.length - 2) {
								visible = false;
							}
							if (item.type in integer) {
								format = {
									places: 0,
									digitSeparator: true
								};
							} else
								if (item.type in decimal) {
									format = {
										places: 2,
										digitSeparator: true
									};
								} else
									if (item.type in dt) {
										format = {
											dateFormat: 'shortDateShortTime'
										};
									}
						}

						return lang.mixin({}, {
							fieldName: item.name,
							label: item.alias,
							isEditable: false,
							tooltip: "",
							visible: visible,
							format: format,
							stringFieldOption: 'textbox'
						});
					}));

			var popupInfo = {
				title: displayField ? '{' + displayField + '}' : '',
				fieldInfos: fieldInfos,
				description: null,
				showAttachments: false,
				mediaInfos: []
			};
			return popupInfo;
		},

		buildInfoTemplate: function (popupInfo) {
			var json = {
				content: "<table>"
			};

			array.forEach(popupInfo.fieldInfos, function (field) {
				if (field.visible) {
					json.content += "<tr><td valign='top'>" + field.label + ": <\/td><td valign='top'>${" + field.fieldName + "}<\/td><\/tr>";
				}
			});
			json.content += "<\/table>";
			return json;
		},

		clearAll: function () {
			var table = query(".add-file-pane", this.domNode)[0];
			if (table) {
				html.setStyle(table, "display", "");
			}
			html.setStyle(this.gridDiv, "display", "none");
			this.routeField =null;
			this.measureField= null;
			this.lineNameField =null;
			this.latField =null;
			this.longField= null;
			this.map.infoWindow.hide();
			this.map.graphics.clear();
			this.grid.setStore(null);
			var layerIds = this.map.graphicsLayerIds.slice(0);
			layerIds = layerIds.concat(this.map.layerIds.slice(1));
			var csvLayer = this.featureLayer; //this.map.getLayer('csvLayer');
			if (csvLayer) {
				this.map.removeLayer(csvLayer);
			}
			/*array.forEach(layerIds, lang.hitch(this,function(layerId) {
			this.map.removeLayer(this.map.getLayer(layerId));
			}));*/
		},

		onLayerInfosChanged: function (layerInfo, changeType, layerInfoSelf) {
			if (!layerInfoSelf || !layerInfo) {
				return;
			}
			if ('added' === changeType) {
				layerInfoSelf.getSupportTableInfo().then(lang.hitch(this, function (supportTableInfo) {
						if (supportTableInfo.isSupportedLayer) {
							this.layerInfo = layerInfoSelf;
						}
					}));
			} else if ('removed' === changeType) {
				// do something
			}
		},

		_getFeatureSet: function (layer) {
			var featureSet = new FeatureSet();
			featureSet.fields = lang.clone(layer.fields);
			featureSet.features = [].concat(layer.graphics);
			featureSet.geometryType = layer.geometryType;
			featureSet.fieldAliases = {};
			array.forEach(featureSet.fields, lang.hitch(this, function (fieldInfo) {
					var fieldName = fieldInfo.name;
					var fieldAlias = fieldInfo.alias || fieldName;
					featureSet.fieldAliases[fieldName] = fieldAlias;
				}));
			return featureSet;
		},

		exportCsv: function () {
			var featureSet = this._getFeatureSet(this.featureLayer);
			this.featureActionManager.getSupportedActions(featureSet, this.featureLayer).then(lang.hitch(this, function (actions) {
				array.forEach(actions, lang.hitch(this, function (action) {
						action.data = featureSet;
					}));

				actions = array.filter(actions, lang.hitch(this, function (action) {
							return action.label === 'Export to CSV file';
						}))[0];
				if (actions) {
					var layer;
					if (actions.data.features && actions.data.features.length > 0) {
						layer = actions.data.features[0].getLayer();
					}
					actions.onExecute(actions.data, layer);
				}
			}));

		},

		getSeparator: function (string) {
			var separators = [",", "      ", ";", "|"];
			var maxSeparatorLength = 0;
			var maxSeparatorValue = "";
			array.forEach(separators, function (separator) {
				var length = string.split(separator).length;
				if (length > maxSeparatorLength) {
					maxSeparatorLength = length;
					maxSeparatorValue = separator;
				}
			});
			return maxSeparatorValue;
		},

		zoomToData: function (featureLayer) {
			// Zoom to the collective extent of the data
			var multipoint = new Multipoint(this.map.spatialReference);
			array.forEach(featureLayer.graphics, function (graphic) {
				var geometry = graphic.geometry;
				if (geometry) {
					multipoint.addPoint({
						x: geometry.x,
						y: geometry.y
					});
				}
			});

			if (multipoint.points.length > 0) {
				this.map.setExtent(multipoint.getExtent().expand(1.25), true);
			}
		},

		//File upload for older browsers
		uploadFile: function (files) {
			if (files && files.length === 1) {
				console.log("handle files");
				this.handleCsv(files[0]);
			} else {
				this.status.innerHTML = "Uploading...";
				var requestHandle = esriRequest({
						url: reflectURL,
						form: dom.byId("uploadForm"),
						load: requestSucceeded,
						error: requestFailed
					});
			}
		},

		requestSucceeded: function (response) {
			this.status.innerHTML = "";
			this.handleCsv(response);
		},

		requestFailed: function (error) {
			this.status.innerHTML = 'Unable to upload' + error.message;
			console.log(error);
		},

		//Zoom to the location when the user clicks a row
		onRowClickHandler: function (evt) {
			this.map.graphics.clear();
			this.map.infoWindow.hide();
			var _this = this;
			var query = new Query();
			query.objectIds = this.grid.getItem(evt.rowIndex).__OBJECTID;
			featureLayer.selectFeatures(query, FeatureLayer.SELECTION_NEW, function (features) {
				//zoom to the selected feature
				if (features.length == 0 || features[0].geometry == null)
					return;
				var geometry = ((Point)(features[0].geometry));
				_this.map.setExtent(_this.pointToExtent(_this.map, geometry, 200));
				_this.map.infoWindow.setFeatures(features);
				_this.map.infoWindow.show(geometry);
			});
		},

		pointToExtent: function (map, point, toleranceInPixel) {
			var pixelWidth = map.extent.getWidth() / map.width;
			var toleraceInMapCoords = toleranceInPixel * pixelWidth;
			return new Extent(point.x - toleraceInMapCoords, point.y - toleraceInMapCoords, point.x + toleraceInMapCoords, point.y + toleraceInMapCoords, map.spatialReference);
		}
	});
});
