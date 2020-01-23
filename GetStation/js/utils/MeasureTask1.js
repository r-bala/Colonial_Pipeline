define([
		'dojo/_base/declare',
		"dojo/_base/Color",
		"dojo/dom",
		"dojo/json",
		'dojo/query',
		'dojo/_base/array',
		'dojo/_base/lang',
		'dojo/_base/html',
		"dojo/dom-style",
		'dojo/dom-construct',
		"dijit/_WidgetBase",
		'dijit/form/TextBox',
		'dijit/form/Button',
		"dijit/layout/TabContainer",
		"dijit/layout/ContentPane",
		"dijit/form/ValidationTextBox",
		"esri/toolbars/draw",
		"esri/geometry/geometryEngine",
		"esri/geometry/Extent",
		"esri/geometry/Point",
		"esri/geometry/Polyline",
		"esri/graphic",
		"esri/request",
		"esri/Color",
		"esri/symbols/Font",
		"esri/SpatialReference",
		'esri/symbols/SimpleFillSymbol',
		'esri/symbols/SimpleLineSymbol',
		'esri/symbols/SimpleMarkerSymbol',
		'esri/symbols/PictureMarkerSymbol',
		"esri/symbols/TextSymbol",
		"esri/InfoTemplate",
		"esri/symbols/jsonUtils",
		"dojo/data/ItemFileReadStore",
		"dojo/dom",
		"dojo/dom-construct",
		"dojo/json",
		"dojo/on",
		"dojo/number",
		"dijit/layout/BorderContainer",
		'jimu/dijit/Message',
		"dojox/data/CsvStore",
		"dojox/encoding/base64",
		"dojox/grid/DataGrid",
		'dojo/Deferred',
		"dojo/DeferredList",
		"dojo/keys",
		"esri/sniff",
		'esri/OperationBase',
		'esri/undoManager',
		"esri/dijit/Popup",
		"esri/domUtils",
		"esri/geometry/Extent",
		"esri/geometry/Multipoint",
		"esri/geometry/Point",
		"esri/layers/GraphicsLayer",
		"esri/geometry/webMercatorUtils",
		"esri/tasks/query",
		'./app-topics',
		'./EsriQuery',
		'./EsriQueryTask'
	], function (declare,
		Color,
		dom,
		json,
		query,
		array,
		lang,
		html,
		domStyle,
		domConstruct,
		_WidgetBase,
		TextBox,
		Button,
		TabContainer,
		ContentPane,
		ValidationTextBox,
		Draw,
		geometryEngine,
		Extent,
		Point,
		Polyline,
		Graphic,
		esriRequest,
		eColor,
		Font,
		SpatialReference,
		SimpleFillSymbol,
		SimpleLineSymbol,
		SimpleMarkerSymbol,
		PictureMarkerSymbol,
		TextSymbol,
		InfoTemplate,
		jsonUtils,
		ItemFileReadStore, dom, domConstruct, json, on, number, BorderContainer,
		Message, CsvStore, dojoxBase64, DataGrid, Deferred,
		DeferredList, keys, has,
		OperationBase, UndoManager, Popup, domUtils, Extent, Multipoint, Point, GraphicsLayer,
		webMercatorUtils, Query, appTopics, EsriQuery, EsriQueryTask) {
	//custom operations
	var customOp = {};
	customOp.Add = declare(OperationBase, {
			label: 'Add Graphic',
			constructor: function (/*graphicsLayer1,graphicsLayer2, loc,label*/ params) {
				this._graphicsLayer1 = params.graphicsLayer1;
				this._graphicsLayer2 = params.graphicsLayer2;
				this.graphics = params.graphic;
				this.labelGraphics = params.labelGraphic;
				_this = params.owner;
			},
			performUndo: function () {
				var len = _this._input_geoms.length;
				array.forEach(this.graphics, lang.hitch(this, function (graphic, index) {
						this._graphicsLayer1.remove(graphic);
						for (var i = len - 1; i >= 0; i--) {
							if (_this._input_geoms[i] == graphic.geometry) {
								_this._input_geoms.splice(i, 1);
								_this._input_locations.splice(i, 1);
								_this._input_locations_labels.splice(i, 1);
							}
						}
					}));
				array.forEach(this.labelGraphics, lang.hitch(this, function (graphic, index) {
						this._graphicsLayer2.remove(graphic);
					}));
			},
			performRedo: function () {
				array.forEach(this.graphics, lang.hitch(this, function (graphic, index) {
						this._graphicsLayer1.add(graphic);
						_this._input_geoms.push(graphic.geometry);
						_this._input_locations.push({
							graphic: graphic,
							fivePixels: 500
						});
					}));
				array.forEach(this.labelGraphics, lang.hitch(this, function (graphic, index) {
						this._graphicsLayer2.add(graphic);
						_this._input_locations_labels.push(graphic);
					}));
			}
		});
	customOp.Delete = declare(OperationBase, {
			label: 'Delete Graphic',
			constructor: function (/*graphicsLayer, deletedGraphics*/ params) {
				this._graphicsLayer1 = params.graphicsLayer1;
				this._graphicsLayer2 = params.graphicsLayer2;
				this.graphics = params.graphic;
				this.labelGraphics = params.labelGraphic;
			},
			performUndo: function () {
				array.forEach(this.graphics, lang.hitch(this, function (graphic, index) {
						this._graphicsLayer1.add(graphic);
						_this._input_geoms.push(graphic.geometry);
						_this._input_locations.push({
							graphic: graphic,
							fivePixels: 500
						});
					}));
				array.forEach(this.labelGraphics, lang.hitch(this, function (graphic, index) {
						this._graphicsLayer2.add(graphic);
						_this._input_locations_labels.push(graphic);
					}));
			},
			performRedo: function () {
				var len = _this._input_geoms.length;
				array.forEach(this.graphics, lang.hitch(this, function (graphic, index) {
						this._graphicsLayer1.remove(graphic);
						for (var i = len - 1; i >= 0; i--) {
							if (_this._input_geoms[i] == graphic.geometry) {
								_this._input_geoms.splice(i, 1);
								_this._input_locations.splice(i, 1);
								_this._input_locations_labels.splice(i, 1);
							}
						}
					}));
				array.forEach(this.labelGraphics, lang.hitch(this, function (graphic, index) {
						this._graphicsLayer2.remove(graphic);
					}));
			}
		});

	return declare(_WidgetBase, {
		_undoManager: null,
		constructor: function (args) {
			this.inherited(arguments);
			this.config = args.config;
			this._infoTemplate = new InfoTemplate("Attributes", "${*}");
			this._pictSymbol = jsonUtils.fromJson(this.config.geomToMeasureSymbol);
			this.btnUndo = args.btnUndo;
			this.btnRedo = args.btnRedo;
			this.multiClick = args.multiClick;
			this._geomToMeasureLayer = new GraphicsLayer({
					id: "Geometry to Stationing Result",
					infoTemplate: this._infoTemplate
				});
			this._geomToMeasureLabelLayer = new GraphicsLayer({
					id: "Geometry to Stationing Result Labels",
					infoTemplate: this._infoTemplate
				});
			this.map = args.map;
			this.map.addLayer(this._geomToMeasureLayer);
			this.map.addLayer(this._geomToMeasureLabelLayer);
			this._input_locations = [];
			this._input_geoms = [];
			this._input_locations_labels = [];
			this._infoWindowContent = [];
			this._undoManager = args.undoManager;
		},
		addToMap: function (evt) {
			this._geomToMeasureLayer.clear();
			this._geomToMeasureLabelLayer.clear();
			var _this = this;
			var map = this.map;
			var evts = [];
			var graphics = [];
			var labelGraphics = [];
			var isXYInputs = false;
			if (!evt.geometry) {
				var xys = this.collectXYLocations();
				if (xys.length == 0 && this._input_locations.length == 0) {
					new Message({
						message: this.nls.missingXY
					});
					return;
				} else {
					isXYInputs = true;
					array.forEach(xys, function (xy) {
						var xy = webMercatorUtils.lngLatToXY(Number(xy.y), Number(xy.x));
						var pt = new Point(xy[0], xy[1], new SpatialReference({
									wkid: map.spatialReference.wkid
								}));
						var levt = {};
						if (evt) {
							levt = lang.clone(evt);
						}
						levt.geometry = pt;
						levt.fivePixels = 500;
						evts.push(levt);
					});
				}
			} else {
				evts.push(evt);
			}
			console.log(evts);
			array.forEach(evts, function (evnt) {
				var textSymbol = new TextSymbol(_this._input_locations.length + 1).setOffset(0, 6).setColor(
						new eColor([128, 0, 0])).setFont(
						new Font("12pt").setWeight(Font.WEIGHT_BOLDER)).setVerticalAlignment("baseline");
				var graphic = new Graphic(evnt.geometry, _this._pictSymbol);
				var labelGraphic = new Graphic(evnt.geometry, textSymbol);
				graphics.push(graphic);
				labelGraphics.push(labelGraphic);
				_this._input_geoms.push(evnt.geometry);
				_this._input_locations.push({
					graphic: graphic,
					fivePixels: evnt.fivePixels
				});
				_this._input_locations_labels.push(labelGraphic);
			});
			var locs = this._input_locations;
			var labels = this._input_locations_labels;
			var addOperation = new customOp.Add({
					graphicsLayer1: this._geomToMeasureLayer,
					graphicsLayer2: this._geomToMeasureLabelLayer,
					graphic: graphics,
					labelGraphic: labelGraphics,
					owner: _this
				});
			this._undoManager.add(addOperation);
			array.forEach(locs, lang.hitch(this, function (loc, index) {
					this._geomToMeasureLayer.add(loc.graphic);
					this._geomToMeasureLabelLayer.add(labels[index]);
				}));
			if (isXYInputs) {
				var union = geometryEngine.union(this._input_geoms);
				if (this._input_geoms.length == 1) {
					if (this.map.__LOD.level < this.zoomScale) {
						this.map.centerAndZoom(union, this.zoomScale);
					} else {
						this.map.centerAt(union);
					}
				} else {
					if (this.map.__LOD.level < this.zoomScale) {
						this.map.centerAndZoom(union.getExtent().getCenter(), this.zoomScale);
					} else {
						this.map.centerAt(union.getExtent().getCenter());
					}
				}
			}
		},
		_pushDeleteOperation: function () {
			var locs = this._input_locations;
			var labels = this._input_locations_labels;
			var deleteOperation = new customOp.Delete({
					graphicsLayer1: this._geomToMeasureLayer,
					graphicsLayer2: this._geomToMeasureLabelLayer,
					loc: locs,
					label: labels
				});
			this._undoManager.add(deleteOperation);
		},
		setMultiClickValue: function (val) {
			this.multiClick = val;
		},
		geomToMeasure: function (evt) {
			if (this.multiClick) {
				this.addToMap({});
			} else {
				this.addToMap(evt);
			}
			this._geomToEnggMeasure(evt);
		},
		collectXYLocations: function () {
			var trs = this.xyTable.getRows();
			var xys = [];
			array.forEach(trs, function (tr) {
				var x = tr.xField.value;
				var y = tr.yField.value;
				xys.push({
					x: x,
					y: y
				});
			});
			return xys;
		},
		clearInputs: function (evt) {
			this._input_locations = [];
			this._input_geoms = [];
			this._input_locations_labels = [];
			this.measureResultsdiv.innerHTML = "";
			this._csvInfos = [];
		},
		clearMeasureInputs: function () {
			this._measureGeomInfos = [];
		},
		//Perform the geocode. This function runs when the "Locate" button is pushed.
		measureToGeom: function () {
			this.map.graphics.clear();
			// Set up SOE URL and parameters
			var serviceURL,
			queryURL,
			nameField,
			queryField,
			routeIdField,
			tolerance,
			targetServiceUrl,
			targetNetworkLayerId;
			var lineName = this.lineName.value;
			var beginMeasure = this.beginMeasure.value;
			var endMeasure = this.endMeasure.value;
			if( this.mileRadio.checked){
				if(beginMeasure && beginMeasure.replace(/\s/g, "") != ""){
				beginMeasure = (this.beginMeasure.value *5280).toString();
				}
				if(endMeasure && endMeasure.replace(/\s/g, "") != ""){
				endMeasure = (this.endMeasure.value * 5280).toString();
				}
			} else {
				
			}

			if ((this.contRadio.checked || this.mileRadio.checked)  && beginMeasure && beginMeasure.replace(/\s/g, "") != "") {
				serviceURL = this.continuousLayer.url + this.continuousLayer.measureToGeometry;
				queryURL = this.continuousLayer.queryUrl;
				queryField = this.continuousLayer.queryField;
				routeIdField = this.continuousLayer.routeIdField;
				nameField = this.continuousLayer.lineNameField;
				tolerance = this.continuousLayer.tolerance;
				targetServiceUrl = this.continuousLayer.url + this.continuousLayer.translate;
				targetNetworkLayerId = this.continuousLayer.targetNetworkLayerIds;
			} else {
				serviceURL = this.engineeringLayer.url + this.engineeringLayer.measureToGeometry;
				queryURL = this.engineeringLayer.queryUrl;
				queryField = this.engineeringLayer.queryField;
				routeIdField = this.engineeringLayer.routeIdField;
				nameField = this.engineeringLayer.routeNameField;
				tolerance = this.engineeringLayer.tolerance;
				targetServiceUrl = this.engineeringLayer.url + this.engineeringLayer.translate;
				targetNetworkLayerId = this.engineeringLayer.targetNetworkLayerIds;
			}
			//var routeId = this.routeId.value;
			//var toRouteId = this.toRouteId.value;

			var routeInfos = [];
			var esriQuery = new EsriQuery();
			esriQuery.url = queryURL;
			esriQuery.orderByFields = ["orderid"];
			esriQuery.whereClause = queryField + " = '" + lineName + "'";
			/* if (this.contRadio.checked) {
			esriQuery.outFields = [queryField, routeIdField, nameField];
			} else {
			esriQuery.outFields = [queryField, routeIdField, nameField, "lineid"];
			} */
			esriQuery.outFields = ["*"];
			esriQuery.returnGeometry = false;
			var esriQueryTask = new EsriQueryTask();
			esriQueryTask.loadResults(esriQuery).then(lang.hitch(this, function (queryResults) {
					var features = queryResults;
					var locations = [];
					array.forEach(features, function (feature) {
						var attributes = feature.attributes;
						var measureLocation = {
							'routeId': attributes[routeIdField]
						};
						measureLocation[queryField] = lineName;
						measureLocation[nameField] = attributes[nameField];
						routeInfos[attributes[routeIdField]] = measureLocation;
						if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
							/*if (toRouteId && toRouteId.replace(/\s/g, "") != "") {
							measureLocation.toRouteId = toRouteId;
							}*/
							measureLocation.fromMeasure = beginMeasure;
							measureLocation.toMeasure = endMeasure;
						} else if (beginMeasure && beginMeasure.replace(/\s/g, "") != "") {
							measureLocation.measure = beginMeasure;
						} else {
							measureLocation.fromMeasure = attributes["engfromm"];
							measureLocation.toMeasure = attributes["engtom"]; ;
						}
						locations.push(measureLocation);
					});
					if (locations.length > 0) {
						var qparams = {
							locations: json.stringify(locations),
							outSR: this.map.spatialReference.wkid,
							f: "json",
							callbackParamName: "callback"
						};
						// Run the SOE query
						var soeRequest = esriRequest({
								url: serviceURL,
								content: qparams,
								handleAs: "json",
								callbackParamName: "callback"
							});
						soeRequest.then(
							lang.hitch(this, function (response) {
								console.log("Success: ", response);
								response.routeInfos = routeInfos;
								var locations = [];
								array.forEach(features, function (feature) {
									var attributes = feature.attributes;
									var measureLocation = {
										'routeId': attributes[routeIdField]
									};
									measureLocation[queryField] = lineName;
									measureLocation[nameField] = attributes[nameField];
									if (beginMeasure && beginMeasure.replace(/\s/g, "") != "") {
										measureLocation.measure = beginMeasure;
										locations.push(measureLocation);
									}
									if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
										var mLocation = lang.clone(measureLocation);
										mLocation.measure = endMeasure;
										locations.push(mLocation);
									}
									if (beginMeasure.replace(/\s/g, "") == "" && endMeasure.replace(/\s/g, "") == "") {
										measureLocation.fromMeasure = attributes["engfromm"];
										measureLocation.toMeasure = attributes["engtom"];
										locations.push(measureLocation);
									}
								});
								this._getTranslatedMeasure(locations, targetServiceUrl, targetNetworkLayerId).then(lang.hitch(this, function (translatedResponse) {
										response.translatedLocations = translatedResponse;
										this._showResponse(response);
									}));
							}), lang.hitch(this, function (error) {
								console.log("Error: ", error.message);
								this._showError(error);
							}));
					} else {
						new Message({
							message: this.nls.noRoutes
						});
						return;
					}
				}));
		},
		_activateGeomToMeasure: function () {
			var map = this.map;
			// Listen for map onClick event
			this.mapClickHandler = on(map, "click", lang.hitch(this, function (evt) {
						map.graphics.clear();
						map.infoWindow.hide();
						// Set up SOE URL and parameters
						var serviceURL = this.engineeringLayer.url + this.engineeringLayer.geometryToMeasure;
						var geometryLocation = {
							'geometry': {
								'x': evt.mapPoint.x,
								'y': evt.mapPoint.y
							}
						};
						var locations = [geometryLocation];
						var fivePixels = (map.extent.getWidth() / map.width) * 5;
						if (this.engineeringLayer.tolerance) {
							fivePixels = this.engineeringLayer.tolerance;
						}
						var qparams = {
							locations: json.stringify(locations),
							tolerance: fivePixels,
							inSR: map.spatialReference.wkid,
							f: "json"
						};
						// Run the SOE query
						var soeRequest = esriRequest({
								url: serviceURL,
								content: qparams,
								handleAs: "json",
								callbackParamName: "callback"
							});
						var requestParams = {
							evt: evt,
							targetNetworkLayerIds: [this.engineeringLayer.targetNetworkLayerIds]
						};
						soeRequest.then(
							lang.hitch(this, function (response) {
								console.log("Success: ", response);
								requestParams.response = response;
								this._showMeasureResponse(requestParams);
							}), lang.hitch(this, function (error) {
								console.log("Error: ", error.message);
								this._showMeasureError(error, evt);
							}));
					}));
		},
		_collectRouteInfo: function (response, isMeasureToGeometry) {
			var def = new Deferred();
			var routeIds = "";
			var beginMeasure = this.beginMeasure.value;
			if (response && response.locations) {
				var locs = response.locations;
				array.forEach(locs, lang.hitch(this, function (loc) {
						var results = isMeasureToGeometry ? ((this.contRadio.checked || this.mileRadio.checked) && beginMeasure.replace(/\s/g, "") != "" ? loc.translatedLocations : [loc]) : loc.results;
						array.forEach(results, function (item) {
							if (routeIds.length > 0) {
								routeIds += ",";
							}
							routeIds += "'" + item.routeId + "'";
						});
					}));
			}
			if (routeIds.length == 0) {
				def.resolve({});
			} else {
				var routeIdField = this.engineeringLayer.routeIdField;
				var routeNameField = this.engineeringLayer.routeNameField;
				var lineIdField = this.engineeringLayer.lineIdField;
				var lineNameField = this.engineeringLayer.queryField;
				var esriQuery = new EsriQuery();
				esriQuery.url = this.engineeringLayer.queryUrl;
				esriQuery.whereClause = routeIdField + " in (" + routeIds + ")";
				esriQuery.outFields = [routeIdField, routeNameField, lineNameField, "ORDERID", lineIdField];
				esriQuery.returnGeometry = false;
				var esriQueryTask = new EsriQueryTask();
				esriQueryTask.loadResults(esriQuery).then(lang.hitch(this, function (queryResults) {
						def.resolve(queryResults);
					}));
			}
			return def;
		},
		_showError: function (error) {
			//this.map.graphics.clear();
			var rdiv = this.resultsdiv;
			rdiv.innerHTML = "<p><b>Result" + "</b></p>";
			rdiv.innerHTML += "Error: " + error.message;
		},
		_showResponse: function (response) {
			//  this.map.graphics.clear();
			// Parse the response
			var spatialReference = response.spatialReference;
			var locations = response.locations;
			var translatedLocations = response.translatedLocations.locations;
			var routeInfos = response.routeInfos;
			var showMilePost = this.config.showMilePost;
			var plusNotation = this.config.plusNotation;
			array.forEach(locations, function (loc, index) {
				var routeInfo = routeInfos[loc["routeId"]];
				lang.mixin(loc, routeInfo);
				lang.mixin(loc, translatedLocations[index]);
			});
			var validLocs = array.filter(locations, function (item) {
					return item.geometry != null && item.status != "esriLocatingFromToPartialMatch";
				});
			if (locations.length == 0 || validLocs.length == 0) {
				new Message({
					message: this.nls.noRoutes
				});
				return;
			}
			//Find pairs of From/To Partial Match
			var pairLoc = array.filter(locations, function (item) {
					return item.geometry != null && (item.status == "esriLocatingFromPartialMatch" || item.status == "esriLocatingToPartialMatch");
				});
			var displayLocs = array.filter(locations, function (item) {
					return item.geometry != null && item.status == "esriLocatingOK";
				});
			if (pairLoc && pairLoc.length > 0) {
				array.forEach(pairLoc, lang.hitch(this, function (location) {
						if (location.status == "esriLocatingFromPartialMatch") {
							delete location.fromMeasure;
							var translatedLocations = location.translatedLocations;
							array.forEach(translatedLocations, lang.hitch(this, function (translatedValue) {
									delete translatedValue.fromMeasure;
								}));
						} else if (location.status == "esriLocatingToPartialMatch") {
							delete location.toMeasure;
							var translatedLocations = location.translatedLocations;
							array.forEach(translatedLocations, lang.hitch(this, function (translatedValue) {
									delete translatedValue.toMeasure;
								}));
						}
						//displayLocs.push(location);
					}));
				var len = pairLoc.length;
				if (len & 1) {
					// Odd number of pairs
					if (len == 1) {
						var geom = new Polyline(pairLoc[0].geometry);
						geom.setSpatialReference(this.map.spatialReference);
						var firstPoint = geom.getPoint(0, 0)
							var lastPartIdx = geom.paths.length - 1;
						var lastPntIdx = geom.paths[lastPartIdx].length - 1;
						var lastPnt = geom.getPoint(lastPartIdx, lastPntIdx);
						pairLoc[0].geometryType = "esriGeometryPoint";
						if (pairLoc[0].status == "esriLocatingFromPartialMatch") {
							pairLoc[0].measure = pairLoc[0].toMeasure;
							pairLoc[0].geometry = lastPnt;
							delete pairLoc[0].fromMeasure;
							delete pairLoc[0].toMeasure;
							var translatedLocations = pairLoc[0].translatedLocations;
							array.forEach(translatedLocations, lang.hitch(this, function (translatedValue) {
									translatedValue.measure = translatedValue.toMeasure;
									delete translatedValue.fromMeasure;
									delete translatedValue.toMeasure;
								}));
						} else if (pairLoc[0].status == "esriLocatingToPartialMatch") {
							pairLoc[0].measure = pairLoc[0].fromMeasure;
							pairLoc[0].geometry = firstPoint;
							delete pairLoc[0].toMeasure;
							delete pairLoc[0].fromMeasure;
							var translatedLocations = pairLoc[0].translatedLocations;
							array.forEach(translatedLocations, lang.hitch(this, function (translatedValue) {
									translatedValue.measure = translatedValue.fromMeasure;
									delete translatedValue.fromMeasure;
									delete translatedValue.toMeasure;
								}));
						}
						displayLocs.push(pairLoc[0]);
					}
				} else {
					//even pairs - join them into one object;
					var obj = {};
					//Merge translated values
					var translatedLocations = pairLoc[0].translatedLocations;
					pairLoc[0].FROMROUTE = pairLoc[0].routename;
					pairLoc[1].TOROUTE = pairLoc[1].routename;
					array.forEach(translatedLocations, lang.hitch(this, function (translatedValue, index) {
							translatedValue = lang.mixin(translatedValue, pairLoc[1].translatedLocations[index]);
						}));
					delete pairLoc[1].translatedLocations;
					var geometryType = pairLoc[0].geometryType;
					if (geometryType != "esriGeometryPoint") {
						geometry = new Polyline(pairLoc[0].geometry);
						geometry.addPath(pairLoc[1].geometry.paths[0]);
					}
					delete pairLoc[1].geometry;
					//Merge location values
					lang.mixin(obj, pairLoc[0]);
					lang.mixin(obj, pairLoc[1]);
					displayLocs.push(obj);
				}
			}
			var rdiv = this.resultsdiv;
			rdiv.innerHTML = "<p><b>" + this.nls.resultLabel + " </b></p>";
			var content = [];
			content.push("<table class='attrTable' cellpadding='0px' cellspacing='10px'><tbody>");
			var _geoms = [];
			this._measureGeomInfos = [];
			// Loop through all point items in the response
			for (var i = 0; i < displayLocs.length; i++) {
				var location = displayLocs[i];
				var routeId = location.routeId;
				var toRouteId = location.toRouteId;
				var geometryType = location.geometryType;
				var status = location.status;
				var csvData = {};
				// Removing the "esriLocating" part from the status result.
				if (status.indexOf("esriLocating") == 0) {
					status = status.substring("esriLocating".length);
				}
				var translatedLocations = location.translatedLocations;
				var endMeasure = this.endMeasure.value;
				var beginMeasure = this.beginMeasure.value;
				//content.push("<br/>RouteId: " + routeId);
				content.push("<tr><td><table class='attrTable' cellpadding='5px' cellspacing='5px'><tbody>");
				if ((this.contRadio.checked || this.mileRadio.checked) && beginMeasure && beginMeasure.replace(/\s/g, "") != "") {
					//content.push("<br/>Linename :" +location.linename);
					content.push("<tr valign='top'><td class='attrName'>" + this.nls.lineNameLabel + "</td><td class='attrValue'>" + this.lineName.value.toUpperCase() + "</td></tr>");
					csvData.Name = location.routename;
					var milePost = null,
					fromMilePost = null,
					toMilePost = null;
					if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
						if (typeof(location.fromMeasure) !== "undefined") {
							var measure = this._roundNumber(location.fromMeasure, plusNotation);
							var milePost = number.format(location.fromMeasure / 5280, {
									places: 2
								});
							if (plusNotation) {
								if (showMilePost) {
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromMilePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
									csvData.FromMilePost = location.fromMeasure / 5280;
								}
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromContinuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
								csvData.FromConstStation = location.fromMeasure;
							} else {
								if (showMilePost) {
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromMilePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
									csvData.FromMilePost = location.fromMeasure / 5280;
								}
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromContinuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
								csvData.FromConstStation = location.fromMeasure;
							}
						}
						if (typeof(location.toMeasure) !== "undefined") {
							measure = this._roundNumber(location.toMeasure, plusNotation);
							var milePost = number.format(location.toMeasure / 5280, {
									places: 2
								});
							if (plusNotation) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.toContinuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
								if (showMilePost) {
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.toMilePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
									csvData.ToMilePost = location.fromMeasure / 5280;
								}
								csvData.ToConstStation = location.fromMeasure;
							} else {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.toContinuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
								if (showMilePost) {
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.toMilePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
									csvData.ToMilePost = location.toMeasure / 5280;
								}
								csvData.ToConstStation = location.toMeasure;
							}
						}
						if (typeof(location.measure) !== "undefined") {
							var measure = this._roundNumber(location.measure, plusNotation);
							var milePost = number.format(measure / 5280, {
									places: 2
								});
							if (plusNotation) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.continuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
								if (showMilePost) {
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.milePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
								}

							} else {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.continuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
								if (showMilePost) {
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.milePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
								}
							}
							if (status == "FromPartialMatch") {
								csvData.ToConstStation = location.measure;
								if (showMilePost) {
									csvData.ToMilePost = location.measure / 5280;
								}
							} else {
								csvData.FromConstStation = location.measure;
								if (showMilePost) {
									csvData.FromMilePost = location.measure / 5280;
								}
							}
						}
					} else {
						var measure = this._roundNumber(location.measure, plusNotation);
						var milePost = number.format(measure / 5280, {
								places: 2
							});
						if (plusNotation) {
							content.push("<tr valign='top'><td class='attrName'>" + this.nls.continuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
							csvData.ConstStation = location.measure;
							if (showMilePost) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.milePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
								csvData.MilePost = location.measure / 5280;
							}

						} else {
							content.push("<tr valign='top'><td class='attrName'>" + this.nls.continuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
							csvData.ConstStation = location.measure;
							if (showMilePost) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.milePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
								csvData.MilePost = location.measure / 5280;
							}
						}
					}
					array.forEach(translatedLocations, lang.hitch(this, function (translatedValue) {
							if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
								if (typeof(translatedValue.fromMeasure) !== "undefined") {
									var measure = this._roundNumber(translatedValue.fromMeasure, plusNotation);
									if (plusNotation) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromEngineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
									} else {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromEngineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
									}
									csvData.FromStation = translatedValue.fromMeasure;
								}
								if (typeof(translatedValue.toMeasure) !== "undefined") {
									measure = this._roundNumber(translatedValue.toMeasure, plusNotation);
									if (plusNotation) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.toEngineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
									} else {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.toEngineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
									}
									csvData.ToStation = translatedValue.toMeasure;
								}
								if (typeof(translatedValue.measure) !== "undefined") {
									var measure = this._roundNumber(translatedValue.measure, plusNotation);
									if (plusNotation) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
									} else {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
									}
									if (status == "FromPartialMatch")
										csvData.ToStation = translatedValue.measure;
									else
										csvData.FromStation = translatedValue.measure;
								}
							} else {
								var measure = this._roundNumber(translatedValue.measure, plusNotation);
								if (plusNotation) {
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
								} else {
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
								}
								csvData.Station = translatedValue.measure;
							}
							//	content.push("<br/>Route Id :" +translatedValue.routeId);
						}));
				} else {
					content.push("<tr valign='top'><td class='attrName'>" + this.nls.lineNameLabel + "</td><td class='attrValue'>" + location[this.engineeringLayer.queryField] + "</td></tr>");
					csvData.Name = location[this.engineeringLayer.queryField];
					//content.push("<br/>Route :" +location.routename);
					if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
						if (typeof(location.fromMeasure) !== "undefined") {
							var measure = this._roundNumber(location.fromMeasure, plusNotation);
							if (plusNotation) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromEngineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
							} else {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromEngineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
							}
							csvData.FromStation = location.fromMeasure;
						}
						if (typeof(location.toMeasure) !== "undefined") {
							measure = this._roundNumber(location.toMeasure, plusNotation);
							if (plusNotation) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.toEngineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
							} else {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.toEngineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
							}
							csvData.ToStation = location.toMeasure;
						}
						if (typeof(location.measure) !== "undefined") {
							var measure = this._roundNumber(location.measure, plusNotation);
							if (plusNotation) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
							} else {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
							}
							if (status == "FromPartialMatch")
								csvData.ToStation = location.measure;
							else
								csvData.FromStation = location.measure;
						}
					} else if (beginMeasure && beginMeasure.replace(/\s/g, "") != "") {
						var measure = this._roundNumber(location.measure, plusNotation);
						if (plusNotation) {
							content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
						} else {
							content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
						}
						csvData.Station = location.measure;
					} else {
						if (typeof(location.fromMeasure) !== "undefined") {
							var measure = this._roundNumber(location.fromMeasure, plusNotation);
							if (plusNotation) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromEngineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
							} else {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromEngineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
							}
							csvData.FromStation = location.fromMeasure;
						}
						if (typeof(location.toMeasure) !== "undefined") {
							measure = this._roundNumber(location.toMeasure, plusNotation);
							if (plusNotation) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.toEngineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
							} else {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.toEngineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
							}
							csvData.ToStation = location.toMeasure;
						}
						if (typeof(location.measure) !== "undefined") {
							var measure = this._roundNumber(location.measure, plusNotation);
							if (plusNotation) {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
							} else {
								content.push("<tr valign='top'><td class='attrName'>" + this.nls.engineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
							}
							if (status == "FromPartialMatch")
								csvData.ToStation = location.measure;
							else
								csvData.FromStation = location.measure;
						}
					}
					array.forEach(translatedLocations, lang.hitch(this, function (translatedValue) {
							if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
								if (typeof(translatedValue.fromMeasure) !== "undefined") {
									var measure = this._roundNumber(translatedValue.fromMeasure, plusNotation);
									var milePost = number.format(translatedValue.fromMeasure / 5280, {
											places: 2
										});
									if (plusNotation) {
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromMilePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
											csvData.FromMilePost = translatedValue.fromMeasure / 5280;
										}
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromContinuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
										csvData.FromConstStation = translatedValue.fromMeasure;
									} else {
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromMilePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
											csvData.FromMilePost = translatedValue.fromMeasure / 5280;
										}
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromContinuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
										csvData.FromConstStation = translatedValue.fromMeasure;
									}
								}
								if (typeof(translatedValue.toMeasure) !== "undefined") {
									measure = this._roundNumber(translatedValue.toMeasure, plusNotation);
									milePost = number.format(translatedValue.toMeasure / 5280, {
											places: 2
										});
									if (plusNotation) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.toContinuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
										csvData.ToConstStation = translatedValue.toMeasure;
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.toMilePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
											csvData.ToMilePost = translatedValue.toMeasure / 5280;
										}
									} else {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.toContinuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
										csvData.ToConstStation = translatedValue.toMeasure;
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.toMilePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
											csvData.ToMilePost = translatedValue.toMeasure / 5280;
										}
									}

								}
								if (typeof(translatedValue.measure) !== "undefined") {
									var measure = this._roundNumber(translatedValue.measure, plusNotation);
									var milePost = number.format(translatedValue.measure / 5280, {
											places: 2
										});
									if (plusNotation) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.continuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.milePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
										}
									} else {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.continuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.milePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
										}
									}
									if (status == "FromPartialMatch") {
										csvData.ToConstStation = translatedValue.measure;
										if (showMilePost) {
											csvData.ToMilePost = translatedValue.measure / 5280;
										}
									} else {
										csvData.FromConstStation = translatedValue.measure;
										if (showMilePost) {
											csvData.FromMilePost = translatedValue.measure / 5280;
										}
									}
								}
							} else if (beginMeasure && beginMeasure.replace(/\s/g, "") != "") {
								var measure = this._roundNumber(translatedValue.measure, plusNotation);
								var milePost = number.format(translatedValue.measure / 5280, {
										places: 2
									});
								if (plusNotation) {
									if (showMilePost) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromMilePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
										csvData.FromMilePost = translatedValue.measure / 5280;
									}
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromContinuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
									csvData.FromConstStation = translatedValue.measure;
								} else {
									if (showMilePost) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.milePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
										csvData.MilePost = translatedValue.measure / 5280;
									}
									content.push("<tr valign='top'><td class='attrName'>" + this.nls.continuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
									csvData.ConstStation = translatedValue.measure;

								}
							} else {
								if (typeof(translatedValue.fromMeasure) !== "undefined") {
									var measure = this._roundNumber(translatedValue.fromMeasure, plusNotation);
									var milePost = number.format(translatedValue.fromMeasure / 5280, {
											places: 2
										});
									if (plusNotation) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromContinuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
										csvData.FromConstStation = translatedValue.fromMeasure;
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromMilePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
											csvData.FromMilePost = translatedValue.fromMeasure / 5280;
										}
									} else {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromMilePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
										csvData.FromConstStation = translatedValue.fromMeasure;
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromContinuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
											csvData.FromMilePost = translatedValue.fromMeasure / 5280;
										}
									}
								}
								if (typeof(translatedValue.toMeasure) !== "undefined") {
									measure = this._roundNumber(translatedValue.toMeasure, plusNotation);
									milePost = number.format(translatedValue.toMeasure / 5280, {
											places: 2
										});
									if (plusNotation) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.toContinuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
										csvData.ToConstStation = translatedValue.toMeasure;
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.toMilePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
											csvData.ToMilePost = translatedValue.toMeasure / 5280;
										}
									} else {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.toContinuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
										csvData.ToConstStation = translatedValue.toMeasure;
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.toMilePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
											csvData.ToMilePost = translatedValue.toMeasure / 5280;
										}
									}
								}
								if (typeof(translatedValue.measure) !== "undefined") {
									var measure = this._roundNumber(translatedValue.measure, plusNotation);
									var milePost = number.format(translatedValue.measure / 5280, {
											places: 2
										});
									if (plusNotation) {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.continuousStationLabel + "</td><td class='attrValue'>" + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>");
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.milePostLabel + "</td><td class='attrValue'>" + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>");
										}

									} else {
										content.push("<tr valign='top'><td class='attrName'>" + this.nls.continuousStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>");
										if (showMilePost) {
											content.push("<tr valign='top'><td class='attrName'>" + this.nls.milePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>");
										}
									}
									if (status == "FromPartialMatch") {
										csvData.ToConstStation = translatedValue.measure;
										if (showMilePost) {
											csvData.ToMilePost = translatedValue.measure / 5280;
										}
									} else {
										csvData.FromConstStation = translatedValue.measure;
										if (showMilePost) {
											csvData.FromMilePost = translatedValue.measure / 5280;
										}
									}
								}
							}
							//content.push("<br/>Route Id :" +translatedValue.routeId);
						}));
				}
				var geometryType = location.geometryType;
				if (location.geometry == null)
					continue;
				var symbol,
				geometry;
				var geomGraphic,
				firstPointLabel,
				firstPointMarker,
				lastPointLabel,
				lastPointMarker;
				var _formatNumber = this._formatNumber;
				var font = new Font("12px", Font.STYLE_NORMAL, Font.VARIANT_NORMAL, Font.WEIGHT_BOLDER);
				if (geometryType == "esriGeometryPoint") {
					geometry = new Point(location.geometry);
					geometry.setSpatialReference(this.map.spatialReference);
					//this.map.centerAndZoom(geometry, 10);
					symbol = jsonUtils.fromJson(this.config.measureToGeometryPointSymbol);
					var geom = webMercatorUtils.webMercatorToGeographic(geometry, false);
					if (status == "FromPartialMatch") {
						csvData.ToLatLong = "(" + geom.y + "," + geom.x + ")";
					} else if (status == "ToPartialMatch") {
						csvData.FromLatLong = "(" + geom.y + "," + geom.x + ")";
					} else {
						csvData.Lat = geom.y;
						csvData.Long = geom.x;
					}
					// create a text symbol
					var textSymbol;
					if (this.contRadio.checked || this.mileRadio.checked) {
						textSymbol = new TextSymbol(
								this._roundNumber(csvData.ConstStation, plusNotation),
								font, new Color([0, 0, 0]));
					} else {
						textSymbol = new TextSymbol(
								this._roundNumber(csvData.Station, plusNotation),
								font, new Color([0, 0, 0]));
					}
					geomGraphic = new Graphic(geom, textSymbol);
					content.push("<tr valign='top'><td class='attrName'>" + this.nls.latitudeLabel + "</td><td class='attrValue'>" + _formatNumber(geom.y, 6) + "</td></tr>");
					content.push("<tr valign='top'><td class='attrName'>" + this.nls.longitudeLabel + "</td><td class='attrValue'>" + _formatNumber(geom.x, 6) + "</td></tr>");
				} else {
					geometry = new Polyline(location.geometry);
					geometry.setSpatialReference(this.map.spatialReference);
					//this.map.setExtent(geometry.getExtent().expand(1.2), true);
					symbol = jsonUtils.fromJson(this.config.measureToGeometryLineSymbol);
					var geom = webMercatorUtils.webMercatorToGeographic(geometry, false);
					var firstPoint = geom.getPoint(0, 0)
						var lastPartIdx = geom.paths.length - 1;
					var lastPntIdx = geom.paths[lastPartIdx].length - 1;
					var lastPnt = geom.getPoint(lastPartIdx, lastPntIdx);
					content.push("<tr valign='top'><td class='attrName'>" + this.nls.fromLatLongLabel + "</td><td class='attrValue'>" + "(" + _formatNumber(firstPoint.y, 6) + "," + _formatNumber(firstPoint.x, 6) + ")" + "</td></tr>");
					content.push("<tr valign='top'><td class='attrName'>" + this.nls.toLatLongLabel + "</td><td class='attrValue'>" + "(" + _formatNumber(lastPnt.y, 6) + "," + _formatNumber(lastPnt.x, 6) + ")" + "</td></tr>");
					csvData.FromLatLong = "(" + firstPoint.y + "," + firstPoint.x + ")";
					csvData.ToLatLong = "(" + lastPnt.y + "," + lastPnt.x + ")";
					firstPointMarker = new Graphic(firstPoint, this._pictSymbol);
					// create a text symbol
					var textSymbol;
					if (this.contRadio.checked || this.mileRadio.checked) {
						textSymbol = new TextSymbol(
								this._roundNumber(csvData.FromConstStation, plusNotation),
								font, new Color([0, 0, 0]));
					} else {
						textSymbol = new TextSymbol(
								this._roundNumber(csvData.FromStation, plusNotation),
								font, new Color([0, 0, 0]));
					}
					firstPointLabel = new Graphic(firstPoint, textSymbol);
					lastPointMarker = new Graphic(lastPnt, this._pictSymbol);
					// create a text symbol
					var textSymbol;
					if (this.contRadio.checked || this.mileRadio.checked) {
						textSymbol = new TextSymbol(
								this._roundNumber(csvData.ToConstStation, plusNotation),
								font, new Color([0, 0, 0]));
					} else {
						textSymbol = new TextSymbol(
								this._roundNumber(csvData.ToStation, plusNotation),
								font, new Color([0, 0, 0]));
					}
					lastPointLabel = new Graphic(lastPnt, textSymbol);
				}
				_geoms.push(geometry);
				this.map.graphics.add(new Graphic(geometry, symbol));
				if (geomGraphic) {
					// add the label point graphic to the map
					this.map.graphics.add(geomGraphic);
				}
				if (firstPointMarker) {
					this.map.graphics.add(firstPointMarker);
					// add the label point graphic to the map
					this.map.graphics.add(firstPointLabel);
				}
				if (lastPointMarker) {
					this.map.graphics.add(lastPointMarker);
					// add the label point graphic to the map
					this.map.graphics.add(lastPointLabel);
				}
				//content.push("<br/>Status: " + status);
				//content.push("<br/>Geometry Type: " + geometryType);
				//var geometryJson = (json.stringify(location.geometry)).toString();
				//content.push("<br/>Geometry: " + (geometryJson.length < 300 ? geometryJson : (geometryJson.substr(0, 300) + ".......")));
				content.push("</tbody></table></td></tr>");
				this._measureGeomInfos.push(csvData);
			}
			content.push("</tbody></table>");
			rdiv.innerHTML += content.join("");
			/* for (var i = 0; i < validLocs.length; i++) {
			var location = validLocs[i];
			var routeId = location.routeId;
			var toRouteId = location.toRouteId;
			var geometryType = location.geometryType;
			if (location.geometry == null)
			continue;
			var symbol, geometry;
			if (geometryType == "esriGeometryPoint") {
			geometry = new Point(location.geometry);
			geometry.setSpatialReference(this.map.spatialReference);
			//this.map.centerAndZoom(geometry, 10);
			symbol = jsonUtils.fromJson(this.config.measureToGeometryPointSymbol);
			} else {
			geometry = new Polyline(location.geometry);
			geometry.setSpatialReference(this.map.spatialReference);
			//this.map.setExtent(geometry.getExtent().expand(1.2), true);
			symbol = jsonUtils.fromJson(this.config.measureToGeometryLineSymbol);
			}
			var geom = webMercatorUtils.webMercatorToGeographic(geometry, false);
			csvData[i]
			_geoms.push(geometry);
			this.map.graphics.add(new Graphic(geometry, symbol));
			} */
			if (_geoms.length > 0) {
				var union = geometryEngine.union(_geoms);
				if (union.type == "point") {
					if (this.map.__LOD.level < this.zoomScale) {
						this.map.centerAndZoom(union, this.zoomScale);
					} else {
						this.map.centerAt(union);
					}
				} else {
					//if(this.map.__LOD.level < this.zoomScale)
					this.map.setExtent(union.getExtent().expand(1.2), true);
				}
			}
		},
		getPopupContent: function (graphic) {
			var infos = array.filter(this._csvInfos, function (info) {
					return info.geom === graphic.geometry
				});
			console.log({
				infos
			});
			if (infos && infos.length > 0) {}
		},
		_getRouteInfoFromResults: function (routeId, results, targetNetworkLayerId) {
			var feat = null;
			var fieldName;
			if (targetNetworkLayerId == this.continuousLayer.targetNetworkLayerIds[0]) {
				fieldName = this.continuousLayer.routeIdField;
			} else {
				fieldName = this.engineeringLayer.lineIdField;
			}
			if (results && results.length > 0) {
				for (var i = 0; i < results.length; i++) {
					var feature = results[i];
					if (feature && feature.attributes[fieldName] === routeId) {
						return feature;
					}
				};
			}
			return feat;
		},
		_getTranslatedMeasure: function (params, translateUrl, targetNetworkLayerId) {
			var def = new Deferred();
			if (params && params.length > 0) {
				// Set up SOE URL and parameters
				var qparams = {
					locations: json.stringify(params),
					targetNetworkLayerIds: json.stringify(targetNetworkLayerId),
					f: "json"
				};
				// Run the SOE query
				var soeRequest = esriRequest({
						url: translateUrl,
						content: qparams,
						handleAs: "json",
						callbackParamName: "callback"
					});
				soeRequest.then(
					lang.hitch(this, function (translatedResponse, params) {
						console.log("Success: ", translatedResponse);
						//
						this._collectRouteInfo(translatedResponse, true).then(lang.hitch(this, function (queryResult) {
								if (translatedResponse && translatedResponse.locations) {
									var locs = translatedResponse.locations;
									array.forEach(locs, lang.hitch(this, function (location) {
											var translatedLocations = location.translatedLocations;
											if (targetNetworkLayerId == this.continuousLayer.targetNetworkLayerIds[0]) {
												queryResult = array.filter(queryResult, lang.hitch(this, function (feature) {
															return feature.attributes[this.engineeringLayer.lineIdField] == location.routeId
														}));
											}
											if (translatedLocations && translatedLocations.length > 0) {
												for (var index = translatedLocations.length - 1; index >= 0; index--) {
													var routeId = translatedLocations[index].routeId;
													var routeInfo = this._getRouteInfoFromResults(routeId, queryResult, targetNetworkLayerId);
													if (routeInfo)
														lang.mixin(translatedLocations[index], routeInfo.attributes);
													else
														translatedLocations.splice(index, 1);
												};
												translatedLocations.sort(function (obj1, obj2) {
													return obj1.ORDERID - obj2.ORDERID;
												});
												var len = translatedLocations.length;
												var endMeasure = this.endMeasure.value;
												if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
													if (len > 1) {
														delete translatedLocations[0].toMeasure;
														delete translatedLocations[len - 1].fromMeasure;
														translatedLocations[0].FROMROUTE = translatedLocations[0].routename;
														translatedLocations[len - 1].TOROUTE = translatedLocations[len - 1].routename;
														lang.mixin(translatedLocations[0], translatedLocations[len - 1]);
														for (var i = len - 1; i >= 1; i--)
															translatedLocations.splice(i, 1);
													} else if (len == 1) {
														translatedLocations[0].FROMROUTE = translatedLocations[0].routename;
														translatedLocations[0].TOROUTE = translatedLocations[0].routename;
													}
												}
											}
										}));
									var len = locs.length;
									var index1 = 0;
									var index2 = 1
										var endMeasure = this.endMeasure.value;
									if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
										while (index2 < len) {
											locs[index1].fromMeasure = locs[index1].measure;
											delete locs[index1].measure;
											var translatedLocations = locs[index1].translatedLocations;
											if (translatedLocations && translatedLocations.length > 0) {
												translatedLocations[0].fromMeasure = translatedLocations[0].measure;
												delete translatedLocations[0].measure;
											} else {
												translatedLocations.push({});
											}
											locs[index2].toMeasure = locs[index2].measure;
											delete locs[index2].measure;
											var translatedLocations = locs[index2].translatedLocations;
											if (translatedLocations && translatedLocations.length > 0) {
												translatedLocations[0].toMeasure = translatedLocations[0].measure;
												delete translatedLocations[0].measure;
											} else {
												translatedLocations.push({});
											}
											lang.mixin(locs[index1].translatedLocations[0], locs[index2].translatedLocations[0]);
											delete locs[index2].translatedLocations;
											lang.mixin(locs[index1], locs[index2]);
											//locs.splice(index2,1);
											index1 += 2;
											index2 += 2;
										}
										for (var i = len - 1; i >= 1; i = i - 2)
											locs.splice(i, 1);
									}
								}
								def.resolve(translatedResponse);
							}));
						/*} else {
						def.resolve(translatedResponse);
						} */
					}), lang.hitch(this, function (error) {
						console.log("Error: ", error.message);
						this._showMeasureError(error, params.evt);
					}));
			} else {
				def.resolve(null);
			}
			return def;
		},
		_getCumulativeMeasure: function (params) {
			if (params.response && params.response.locations) {
				var locs = params.response.locations;
				if (locs.length == 0) {
					this._showMeasureResponse(params);
					return;
				}
				//var results = locs[0].results;
				var results = array.map(locs, function (loc) {
						if (loc.results.length > 0) {
							return loc.results;
						}
					});
				if (!results || results.length == 0) {
					this._showMeasureResponse(params);
					return;
				}
				var locations = [];
				array.forEach(results, function (result) {
					array.forEach(result, function (item) {
						var location = {
							routeId: item.routeId,
							measure: item.measure
						};
						locations.push(location);
					});
				});
				if (locations.length == 0) {
					params.translatedResponse = null;
					this._showMeasureResponse(params);
				} else {
					// Set up SOE URL and parameters
					var serviceURL = this.engineeringLayer.url + this.engineeringLayer.translate;
					var qparams = {
						locations: json.stringify(locations),
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
							params.translatedResponse = translatedResponse;
							this._showMeasureResponse(params);
						}), lang.hitch(this, function (error) {
							console.log("Error: ", error.message);
							this._showMeasureError(error, params.evt);
						}));
				}
			}
		},
		_geomToEnggMeasure: function (evt) {
			var map = this.map;
			// map.graphics.clear();
			map.infoWindow.hide();
			var engineeringLayer = this.engineeringLayer;
			var graphics = array.map(this._input_locations, function (loc) {
					return loc.graphic;
				});
			var requestParams = {
				evt: evt,
				geoms: this._input_geoms,
				graphics: graphics,
				label: this._input_locations_labels,
				targetNetworkLayerIds: [engineeringLayer.targetNetworkLayerIds]
			};
			if (this._input_locations) {
				// Set up SOE URL and parameters
				var serviceURL = engineeringLayer.url + this.engineeringLayer.geometryToMeasure;
				var geometryLocations = [];
				var inLocs = this._input_locations;
				array.forEach(inLocs, function (inLoc) {
					var geometryLocation = {
						'geometry': {
							'x': inLoc.graphic.geometry.x,
							'y': inLoc.graphic.geometry.y
						}
					};
					geometryLocations.push(geometryLocation);
				});
				var locations = geometryLocations;
				var w = (map.extent.getWidth() / map.width);
				var m = w > 100 ? 5 : 10;
				var fivePixels = w * m;
				if (inLocs[0].fivePixels) {
					fivePixels = inLocs[0].fivePixels;
				}
				if (engineeringLayer.tolerance) {
					fivePixels = engineeringLayer.tolerance;
				}
				var qparams = {
					locations: json.stringify(locations),
					tolerance: fivePixels,
					inSR: map.spatialReference.wkid,
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
					lang.hitch(this, function (response) {
						console.log("Success: ", response);
						requestParams.response = response;
						this._collectRouteInfo(response, false).then(lang.hitch(this, function (routeInfos) {
								requestParams.routeInfos = routeInfos;
								if (engineeringLayer.translate && engineeringLayer.targetNetworkLayerIds) {
									this._getCumulativeMeasure(requestParams);
								} else {
									this._showMeasureResponse(requestParams);
								}
							}));
					}), lang.hitch(this, function (error) {
						console.log("Error: ", error.message);
						this._showMeasureError(error, evt);
					}));
			}
		},
		_deactivateGeomToMeasure: function () {
			/*if(this.mapClickHandler){
			this.mapClickHandler.remove();
			}*/
		},
		_showMeasureError: function (error, evt) {
			//this.map.graphics.clear();
			var title = "Error";
			var content = error.message;
			this.map.infoWindow.clearFeatures();
			this.map.infoWindow.setTitle(title);
			this.map.infoWindow.setContent(content);
			if (evt) {
				if (evt.screenPoint) {
					this.map.infoWindow.show(evt.screenPoint, this.map.getInfoWindowAnchor(evt.screenPoint));
				} else if (evt.geometry) {
					this.map.infoWindow.show(evt.geometry, this.map.getInfoWindowAnchor(evt.geometry));
				}
			}
			console.log(error);
		},
		_formatNumber: function (value) {
			return number.format(value, {
				places: 6
			});
		},
		_roundNumber: function (value, plusNotation) {
			if (plusNotation) {
				return number.format(Math.round(value), {
					pattern: '#####000'
				});
			} else {
				return number.format(Math.round(value), {
					places: 0
				});
			}
		},
		_showMeasureResponse: function (fullResponse, evt) {
			//this.map.graphics.clear();
			var nls = this.nls;
			var resultsdiv = this.measureResultsdiv;
			var response = fullResponse.response;
			var _formatNumber = this._formatNumber;
			var _roundNumber = this._roundNumber;
			var plusNotation = this.config.plusNotation;
			var showMilePost = this.config.showMilePost;
			var routeIdField = this.continuousLayer.routeIdField;
			var translatedResponse = fullResponse.translatedResponse;
			var routeInfos = fullResponse.routeInfos;
			var multiClick = this.multiClick;
			var translatedLocations = [];
			if (translatedResponse) {
				translatedLocations = translatedResponse.locations;
			}
			var evt = fullResponse.evt;
			// Parse the response
			var measureUnit = response.unitsOfMeasure;
			var locations = response.locations;
			var title = nls.routeLocation;
			var geoms = fullResponse.geoms;
			// "Unit of Measure: " + measureUnit;
			var locContent = [];
			var distance = "";
			// Loop through all point items in the response
			var inLocs = array.map(this._input_locations, function (loc) {
					return loc.graphic;
				});
			var i = 0;
			this._csvInfos = [];
			this._infoWindowContent = [];
			var startCumMeasure,
			startLineName,
			endCumMeasure,
			endLineName,
			isSingleResult = false;
			if (inLocs && inLocs.length > 0) {
				while (response.locations[i]) {
					var content = "";
					var status = response.locations[i].status;
					var locGeom = inLocs[i].geometry;
					var normalizedVal = webMercatorUtils.xyToLngLat(locGeom.x, locGeom.y);
					// Removing the "esriLocating" part from the status result.
					if (status.indexOf("esriLocating") == 0) {
						status = status.substring("esriLocating".length);
					}
					if (status === "MultipleLocation") {
						distance = "<br/><b>" + nls.distanceLabel + " " + nls.notApplicableValue + "</b><br/>";
						isSingleResult = false;
						//  status = nls.multiplePipes;
					} else if (status === "OK") {
						/**
						 * Logic to calculate Distance
						 */
						isSingleResult = true;
						//  status = nls.pipeLocated;
					} else if (status === "CannotFindLocation") {
						distance = "<br/><b>" + nls.distanceLabel + " " + nls.notApplicableValue + "</b><br/>";
						isSingleResult = false;
						content += "<br/><br/><b>" + nls.noResult + (i + 1) + ".</b><br/>";
					}
					//content += status;
					var results = response.locations[i].results;
					if (results.length == 1) {
						content += "<br/><br/><b>" + nls.singleResult + (i + 1) + "</b>";
					} else if (results.length > 1) {
						content += "<br/><br/><b>" + nls.multipleResult + (i + 1) + "</b>";
					}
					content += "<table class='attrTable' cellpadding='0px' cellspacing='10px'><tbody>";
					for (var j = 0; j < results.length; j++) {
						var routeTranslation,
						routeInfo;
						var measureVal = results[j].measure;
						var routeId = results[j].routeId;
						var csvData = {
							loc: inLocs[i],
							geom: locGeom,
							Lat: normalizedVal[1],
							Long: normalizedVal[0],
							Location: "" + (i + 1),
							Result: "" + (j + 1)
						};
						lang.mixin(csvData, {
							Status: status
						});
						if (translatedLocations.length > 0) {
							//routeTranslation = translatedLocations[j];
							routeTranslation = null;
							var transLocs = array.filter(translatedLocations, function (translatedLocation) {
									return translatedLocation.routeId === routeId && translatedLocation.measure.toFixed(9) === measureVal.toFixed(9);
								});
							if (transLocs && transLocs.length > 0) {
								console.log(transLocs);
								routeTranslation = transLocs.length == 1 ? transLocs[0] : transLocs[j];
							}
						}
						if (routeInfos.length > 0 && routeInfos[j]) {
							var ris = array.filter(routeInfos, function (ri) {
									return ri.attributes[routeIdField] == routeId
								});
							routeInfo = ris[0].attributes;
						}
						content += "<tr><td>" + (j + 1) + "</td><td><table class='attrTable' cellpadding='5px' cellspacing='5px'><tbody>";
						//  content += "<tr valign='top'><td class='attrName'>Route Name:</td><td class='attrValue'>" + routeInfo["routename"] + "</td></tr>";
						if (routeInfo) {
							var lineName = routeInfo[this.engineeringLayer.queryField];
							lang.mixin(csvData, {
								LineName: lineName
							});
							content += "<tr valign='top'><td class='attrName'>" + nls.lineNameLabel + "</td><td class='attrValue'>" + lineName.toUpperCase() + "</td></tr>";
						}
						if (normalizedVal) {
							content += "<tr valign='top'><td class ='attrName'>" + nls.latitudeLabel + "</td><td class='attrValue'>" + _formatNumber(normalizedVal[1], 6) + "</td></tr>";
							content += "<tr valign='top'><td class ='attrName'>" + nls.longitudeLabel + "</td><td class='attrValue'>" + _formatNumber(normalizedVal[0], 6) + "</td></tr>";
						}
						var measure = _roundNumber(measureVal, plusNotation);
						lang.mixin(csvData, {
							Station: measure
						});
						if (this.config.plusNotation) {
							content += "<tr valign='top'><td class='attrName'>" + nls.engineeringStationLabel + "</td><td class='attrValue'> " + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>";
						} else {
							content += "<tr valign='top'><td class='attrName'>" + nls.engineeringStationLabel + "</td><td class='attrValue'>" + measure + "</td></tr>";
						}
						if (routeTranslation) {
							var translatedMeasure = _roundNumber(routeTranslation.translatedLocations[0].measure, plusNotation);
							var milePost = number.format((routeTranslation.translatedLocations[0].measure / 5280), {
									places: 2
								});
							lang.mixin(csvData, {
								ContStation: translatedMeasure
							});
							if (showMilePost) {
								lang.mixin(csvData, {
									MilePost: milePost
								});
							}
							if (this.config.plusNotation && translatedMeasure) {
								content += "<tr valign='top'><td class='attrName'>" + nls.continuousStationLabel + "</td><td class='attrValue'> " + [translatedMeasure.substr(0, translatedMeasure.length - 2), "+", translatedMeasure.substr(translatedMeasure.length - 2)].join("") + "</td></tr>";
								if (showMilePost) {
									content += "<tr valign='top'><td class='attrName'>" + nls.milePostLabel + "</td><td class='attrValue'> " + [milePost.substr(0, milePost.length - 2), "+", milePost.substr(milePost.length - 2)].join("") + "</td></tr>";
								}
							} else {
								content += "<tr valign='top'><td class='attrName'>" + nls.continuousStationLabel + "</td><td class='attrValue'>" + translatedMeasure + "</td></tr>";
								if (showMilePost) {
									content += "<tr valign='top'><td class='attrName'>" + nls.milePostLabel + "</td><td class='attrValue'>" + milePost + "</td></tr>";
								}
							}
						}
						content += "</table></td></tr>";
						this._csvInfos.push(csvData);
						csvData.loc.setAttributes({
							LineName: csvData.LineName,
							Station: csvData.Station,
							ContinuousStation: csvData.ContStation
						});
						if (showMilePost) {
							csvData.loc.setAttributes({
								MilePost: csvData.MilePost
							})
						}
						if (isSingleResult) {
							if (i === 0) {
								startLineName = csvData.LineName;
								startCumMeasure = Number(csvData.ContStation.replace(/,/g, ''));
							} else if (i === inLocs.length - 1) {
								endLineName = csvData.LineName;
								endCumMeasure = Number(csvData.ContStation.replace(/,/g, ''));
							}
						}
					}
					content += "</tbody></table>";
					/***
					 * Set Attributes for  locations
					 **/
					inLocs[i].setAttributes({
						contentd: content
					});
					locContent.push(content);
					i++;
				}
			}
			this._input_locations = [];
			this._input_geoms = [];
			this._input_locations_labels = [];
			if (!multiClick) {
				this.map.infoWindow.clearFeatures();
				this.map.infoWindow.setTitle(title);
				this.map.infoWindow.setContent(locContent.join("<br/>"));
				if (evt) {
					if (evt.screenPoint) {
						this.map.infoWindow.show(evt.screenPoint, this.map.getInfoWindowAnchor(evt.screenPoint));
					} else if (evt.geometry) {
						this.map.infoWindow.show(evt.geometry, this.map.getInfoWindowAnchor(evt.geometry));
					}
				}
			}
			/*  this.map.infoWindow.clearFeatures();
			this.map.infoWindow.setTitle(title);
			this.map.infoWindow.setContent(content);*/
			if (isSingleResult) {
				if (startLineName && endLineName) {
					if (startLineName === endLineName) {
						if (startCumMeasure && endCumMeasure) {
							var footage = Math.abs(endCumMeasure - startCumMeasure);
							var mileage = number.format(footage / 5280, {
									places: 2
								});
							distance = "<br/>" + nls.distanceLabel + footage + " feet<br/>" + nls.mileageLabel + mileage;
						}
					}
				}
			}
			resultsdiv.innerHTML = distance + locContent.join("<br/>");
			if (evt) {
				/*  if (evt.screenPoint) {
				this.map.infoWindow.show(evt.screenPoint, this.map.getInfoWindowAnchor(evt.screenPoint));
				} else if (evt.geometry) {
				this.map.infoWindow.show(evt.geometry, this.map.getInfoWindowAnchor(evt.geometry));
				} else if (geoms && geoms.length > 0) {
				this.map.infoWindow.show(geoms[0], this.map.getInfoWindowAnchor(geoms[0]));
				}*/
			}
		},
		getGeomToStationCsvInfos: function () {
			return this._csvInfos;
		},
		getStationToGeomCsvInfos: function () {
			return this._measureGeomInfos;
		}
	});
});
