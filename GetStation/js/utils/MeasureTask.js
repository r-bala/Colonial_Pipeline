define([
		'dojo/_base/declare',
		"dojo/_base/Color",
		"dojo/dom",
		"dojo/json",
		'dojo/_base/array',
		'dojo/_base/lang',
		"dojo/dom-style",
		"dijit/_WidgetBase",
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
		array,
		lang,
		domStyle,
		_WidgetBase,
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

		ItemFileReadStore, dom, domConstruct, json, on, number, BorderContainer,
		Message, CsvStore, dojoxBase64, DataGrid, Deferred,
		DeferredList,
		Popup, domUtils, Extent, Multipoint, Point, GraphicsLayer,
		webMercatorUtils, Query, appTopics, EsriQuery, EsriQueryTask) {
	return declare(_WidgetBase, {

		constructor: function (args) {
			this.inherited(arguments);

			this.inputSymb = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 20,
					new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
						new eColor([255, 255, 0.5]), 10),
					new eColor([255, 255, 0, 0.4]));
			this._geomToMeasureLayer = new GraphicsLayer({
					id: "Geometry to Stationing Result"
				});
			this.map = args.map;
			this.map.addLayer(this._geomToMeasureLayer);
		},

		addToMap: function (evt) {
			this._geomToMeasureLayer.clear();

			if (!evt.geometry) {
				if (this.x.value.length == 0 || this.y.value.length == 0) {
					new Message({
						message: this.nls.missingXY
					});
					return;
				} else {
					var xy = webMercatorUtils.lngLatToXY(Number(this.y.value), Number(this.x.value));
					var pt = new Point(xy[0], xy[1], new SpatialReference({
								wkid: this.map.spatialReference.wkid
							}));
					evt.geometry = pt;
					evt.fivePixels = 100;
				}
			}
			console.log(evt);
			var graphic = new Graphic(evt.geometry, this.inputSymb);
			this._input_location = evt.geometry;
			this._geomToMeasureLayer.add(graphic);
			if (this.map.__LOD.level < 15)
				this.map.centerAndZoom(evt.geometry, 15);
			// this.toolbar.deactivate();
			this._geomToEnggMeasure(evt);
		},

		//Perform the geocode. This function runs when the "Locate" button is pushed.
		measureToGeom: function () {
			this.map.graphics.clear();
			// Set up SOE URL and parameters
			var serviceURL,
			queryURL,
			queryField,
			routeIdField;
			if (this.contRadio.checked) {
				serviceURL = this.continuousLayer.url + this.continuousLayer.measureToGeometry;
				queryURL = this.continuousLayer.queryUrl;
				queryField = this.continuousLayer.queryField;
				routeIdField = this.continuousLayer.routeIdField;
			} else {
				serviceURL = this.engineeringLayer.url + this.engineeringLayer.measureToGeometry;
				queryURL = this.engineeringLayer.queryUrl;
				queryField = this.engineeringLayer.queryField;
				routeIdField = this.engineeringLayer.routeIdField;
			}
			//var routeId = this.routeId.value;
			//var toRouteId = this.toRouteId.value;
			var lineName = this.lineName.value;
			var beginMeasure = this.beginMeasure.value;
			var endMeasure = this.endMeasure.value;

			var esriQuery = new EsriQuery();
			esriQuery.url = queryURL;
			esriQuery.whereClause = queryField + " = '" + lineName + "'";
			esriQuery.outFields = [queryField, routeIdField];
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

						if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
							/*if (toRouteId && toRouteId.replace(/\s/g, "") != "") {
							measureLocation.toRouteId = toRouteId;
							}*/
							measureLocation.fromMeasure = beginMeasure;
							measureLocation.toMeasure = endMeasure;
						} else {
							measureLocation.measure = beginMeasure;
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
								this._showResponse(response);
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

		_collectRouteInfo: function (response) {
			var def = new Deferred();
			var routeIds = "";
			if (response && response.locations) {
				var locs = response.locations;
				var results = locs[0].results;
				array.forEach(results, function (item) {
					if (routeIds.length > 0) {
						routeIds += ",";
					}
					routeIds += "'" + item.routeId + "'";
				});
			}

			if (routeIds.length == 0) {
				def.resolve({});
			} else {
				var routeIdField = this.engineeringLayer.routeIdField;
				var esriQuery = new EsriQuery();
				esriQuery.url = this.engineeringLayer.queryUrl;
				esriQuery.whereClause = routeIdField + " in (" + routeIds + ")";
				esriQuery.outFields = ["routeid", "routename", "linename"];
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
			var invalidLocs = array.filter(locations, function (item) {
					return item.status === "esriLocatingCannotFindLocation"
				});
			if (locations.length == 0 || (invalidLocs && invalidLocs.length == locations.length)) {
				new Message({
					message: this.nls.noRoutes
				});
				return;
			}

			var rdiv = this.resultsdiv;
			rdiv.innerHTML = "<p><b>Result" + "</b></p>";
			var content = [];
			// Loop through all point items in the response
			for (var i = 0; i < locations.length; i++) {
				var location = locations[i];
				var routeId = location.routeId;
				var toRouteId = location.toRouteId;
				var geometryType = location.geometryType;
				var status = location.status;
				// Removing the "esriLocating" part from the status result.
				if (status.indexOf("esriLocating") == 0) {
					status = status.substring("esriLocating".length);
				}

				content.push("Status: " + status);
				content.push("<br/>Route ID: " + routeId);
				if (toRouteId) {
					content.push("<br/>To Route ID: " + toRouteId);
				}
				content.push("<br/>Geometry Type: " + geometryType);
				var geometryJson = (json.stringify(location.geometry)).toString();
				content.push("<br/>Geometry: " + (geometryJson.length < 300 ? geometryJson : (geometryJson.substr(0, 300) + ".......")));
				rdiv.innerHTML += content.join("");

				if (location.geometry == null)
					continue;

				var symbol,
				geometry;
				if (geometryType == "esriGeometryPoint") {
					geometry = new Point(location.geometry);
					geometry.setSpatialReference(this.map.spatialReference);
					this.map.centerAndZoom(geometry, 10);
					symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 20, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 0, 0.5]), 10), new Color([255, 255, 0, 0.9]));
				} else {
					geometry = new Polyline(location.geometry);
					geometry.setSpatialReference(this.map.spatialReference);
					this.map.setExtent(geometry.getExtent().expand(1.2), true);
					symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 0]), 8);
				}
				this.map.graphics.add(new Graphic(geometry, symbol));
			}
		},

		_getCumulativeMeasure: function (params) {
			if (params.response && params.response.locations) {
				var locs = params.response.locations;
				if (locs.length == 0) {
					this._showMeasureResponse(params);
					return;
				}
				var results = locs[0].results;
				if (!results || results.length == 0) {
					this._showMeasureResponse(params);
					return;
				}
				var locations = array.map(results, function (item) {
						var location = {
							routeId: item.routeId,
							measure: item.measure
						};
						return location;
					});

				// Set up SOE URL and parameters
				var serviceURL = this.engineeringLayer.url + this.engineeringLayer.translate;
				var qparams = {
					locations: json.stringify(locations),
					targetNetworkLayerIds: [this.engineeringLayer.targetNetworkLayerIds],
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
						params.translatedResponse = translatedResponse
							this._showMeasureResponse(params);
					}), lang.hitch(this, function (error) {
						console.log("Error: ", error.message);
						this._showMeasureError(error, params.evt);
					}));

			}
		},

		_geomToEnggMeasure: function (evt) {
			var map = this.map;
			// map.graphics.clear();
			map.infoWindow.hide();
			var engineeringLayer = this.engineeringLayer;
			var requestParams = {
				evt: evt,
				targetNetworkLayerIds: [engineeringLayer.targetNetworkLayerIds]
			};
			if (this._input_location) {

				// Set up SOE URL and parameters
				var serviceURL = engineeringLayer.url + this.engineeringLayer.geometryToMeasure;
				var geometryLocation = {
					'geometry': {
						'x': this._input_location.x,
						'y': this._input_location.y
					}
				};
				var locations = [geometryLocation];
				var w = (map.extent.getWidth() / map.width);
				var m = w > 100 ? 5 : 10;
				var fivePixels = w * m;
				if (evt.fivePixels) {
					fivePixels = evt.fivePixels;
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
						this._collectRouteInfo(response).then(lang.hitch(this, function (routeInfos) {
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

		_formatNumber: function (value, places) {
			return number.format(value, {
				places: places ? places : 2
			});
		},

		_roundNumber: function (value) {
			return number.format(Math.round(value), {
				pattern: '#####000'
			});
		},

		_showMeasureResponse: function (fullResponse, evt) {
			//this.map.graphics.clear();
			var nls = this.nls;
			var response = fullResponse.response;
			var _formatNumber = this._formatNumber;
			var _roundNumber = this._roundNumber;
			var translatedResponse = fullResponse.translatedResponse;
			var routeInfos = fullResponse.routeInfos;
			var translatedLocations = [];
			if (translatedResponse) {
				translatedLocations = translatedResponse.locations;
			}
			var evt = fullResponse.evt;
			// Parse the response
			var measureUnit = response.unitsOfMeasure;
			var locations = response.locations;
			var title = "Route Location";
			var content = ""; // "Unit of Measure: " + measureUnit;
			// Loop through all point items in the response
			var i = 0;
			while (response.locations[i]) {
				var status = response.locations[i].status;
				// Removing the "esriLocating" part from the status result.
				if (status.indexOf("esriLocating") == 0) {
					status = status.substring("esriLocating".length);
				}
				if (status === "MultipleLocation") {
					status = nls.multiplePipes;
				} else if (status === "OK") {
					status = nls.pipeLocated;
				} else if (status === "CannotFindLocation") {
					status = nls.noPipes;
				}
				content += status;
				var results = response.locations[i].results;
				if (results.length == 1) {
					content += "<br/><br/><b>Location</b>";
				} else if (results.length > 1) {
					content += "<br/><br/><b>Locations</b>";
				}
				for (var j = 0; j < results.length; j++) {
					var routeTranslation,
					routeInfo;
					var routeId = results[j].routeId;
					var geom = results[j].geometry;
					var measure = _roundNumber(results[j].measure);

					var normalizedVal = webMercatorUtils.xyToLngLat(geom.x, geom.y);
					if (translatedLocations.length > 0) {
						/*routeTranslation = array.filter(translatedLocations, function(location) {
						var tloc = location.translatedLocations[0];
						return location.routeId === routeId && tloc.routeId === routeId
						&& tloc.networkLayerId === fullResponse.targetNetworkLayerIds[0];
						});*/
						routeTranslation = translatedLocations[j];
					}
					var translatedMeasure = _roundNumber(routeTranslation.translatedLocations[0].measure);

					if (routeInfos.length > 0) {
						routeInfo = routeInfos[j].attributes;
					}
					content += "<br/><table class='attrTable' cellpadding='0px' cellspacing='5px'><tbody>";
					//  content += "<tr valign='top'><td class='attrName'>Route Name:</td><td class='attrValue'>" + routeInfo["routename"] + "</td></tr>";
					content += "<tr valign='top'><td class='attrName'>Line Name:</td><td class='attrValue'>" + routeInfo["linename"] + "</td></tr>";
					if (normalizedVal) {
						content += "<tr valign='top'><td class ='attrName'>Latitude:</td><td class='attrValue'>" + _formatNumber(normalizedVal[1], 6) + "</td></tr>";
						content += "<tr valign='top'><td class ='attrName'>Longitude:</td><td class='attrValue'>" + _formatNumber(normalizedVal[0], 6) + "</td></tr>";
					}
					content += "<tr valign='top'><td class='attrName'>Engineering Stationing:</td><td class='attrValue'> " + [measure.substr(0, measure.length - 2), "+", measure.substr(measure.length - 2)].join("") + "</td></tr>";
					if (routeTranslation) {
						content += "<tr valign='top'><td class='attrName'>Cumulative Stationing:</td><td class='attrValue'> " + [translatedMeasure.substr(0, translatedMeasure.length - 2), "+", translatedMeasure.substr(translatedMeasure.length - 2)].join("") + "</td></tr>";
					}
					content += "</table>";
				}
				i++;
			}

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
		}

	});
});
