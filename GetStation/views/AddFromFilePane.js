///////////////////////////////////////////////////////////////////////////
// Copyright © Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define(["dojo/_base/declare",
		"dojo/_base/lang",
		"dojo/_base/array",
		"dojo/_base/json",
		"dojo/on",
		"dojo/topic",
		"dojo/Deferred",
		"dojo/dom-class",
		"dojo/dom-construct",
		"dijit/Viewport",
		"dojo/sniff",
		"dojox/data/CsvStore",
		"dijit/_WidgetBase",
		"dijit/_TemplatedMixin",
		"dijit/_WidgetsInTemplateMixin",
		"dojo/text!./templates/AddFromFilePane.html",
		"./LayerLoader",
		"./util",
		"dojo/_base/kernel",
		"esri/request",
		"esri/layers/FeatureLayer",
		"esri/layers/KMLLayer",
		"esri/geometry/scaleUtils",
		"esri/dijit/FeatureTable",
		"jimu/dijit/Message",
		"jimu/dijit/CheckBox"
	],
	function (declare, lang, array, dojoJson, on, topic, Deferred, domClass, domConstruct, Viewport, sniff, CsvStore,
		_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, template,
		LayerLoader, util, kernel, esriRequest, FeatureLayer, KMLLayer, scaleUtils, FeatureTable,
		Message) {
/*{
				"type": "shapefile",
				"url": "images/filetypes/zip.svg"
			}, {
				"type": "csv",
				"url": "images/filetypes/csv.svg"
			}, {
				"type": "kml",
				"url": "images/filetypes/kml.svg"
			}, {
				"type": "gpx",
				"url": "images/filetypes/gpx.svg"
			}, {
				"type": "geojson",
				"url": "images/filetypes/geojson.svg"
			}*/
	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		i18n: null,
		templateString: template,
		wabWidget: null,
		maxRecordCount: 1000,
		maxRecordThreshold: 100000,
		SHAPETYPE_ICONS: [ {
				"type": "csv",
				"url": "images/filetypes/csv.svg"
			}, {
				"type": "kml",
				"url": "images/filetypes/kml.svg"
			}
		],
		features: null,

		postCreate: function () {
			this.inherited(arguments);
			// this.generalizeCheckBox.setLabel(this.i18n.addFromFile.generalizeOn);
			this.own(Viewport.on("resize", this.resize()));
		},

		destroy: function () {
			this.inherited(arguments);
			//console.warn("AddFromFilePane::destroy");
		},

		startup: function () {
			if (this._started) {
				return;
			}
			if (this.wabWidget.isPortal) {
				this.SHAPETYPE_ICONS = [ {
						"type": "csv",
						"url": "images/filetypes/csv.svg"
					}, {
						"type": "kml",
						"url": "images/filetypes/kml.svg"
					}
				];
			}
			this.inherited(arguments);
			//console.warn("AddFromFilePane.startup .......................");

			var self = this,
			dropNode = this.dropArea;

			var v,
			config = this.wabWidget.config;
			if (config.addFromFile) {
				try {
					v = Number(config.addFromFile.maxRecordCount);
					if (typeof v === "number" && !isNaN(v)) {
						v = Math.floor(v);
						if (v >= 1 && v <= this.maxRecordThreshold) {
							this.maxRecordCount = v;
						}
					}
				} catch (ex) {
					console.warn("Error setting AddFromFile.maxRecordCount:");
					console.warn(ex);
				}
			}

			if (this.i18n.addFromFile.types) {
				try {
					for (var fileTypeName in this.i18n.addFromFile.types) {
						this._createFileTypeImage(fileTypeName);
					}
				} catch (ex) {
					console.warn("Error reading support file types:");
					console.warn(ex);
				}
			}

			this.own(on(this.fileNode, "change", function () {
					if (!self._getBusy()) {
						self._setBusy(true);
						var fileInfo = self._getFileInfo();
						if (fileInfo.ok) {
							self._execute(fileInfo);
						}
					}
				}));

			this.own(on(this.uploadLabel, "click", function (event) {
					if (self._getBusy()) {
						event.preventDefault();
						event.stopPropagation();
					}
				}));

			this.own(on(dropNode, "dragenter", function (event) {
					event.preventDefault();
					if (!self._getBusy()) {
						domClass.add(dropNode, "hit");
						self._setStatus("");
					}
				}));
			this.own(on(dropNode, "dragleave", function (event) {
					event.preventDefault();
					domClass.remove(dropNode, "hit");
				}));
			this.own(on(dropNode, "dragover", function (event) {
					event.preventDefault();
				}));
			this.own(on(dropNode, "drop", function (event) {
					event.preventDefault();
					event.stopPropagation();
					//console.warn("drop");
					if (!self._getBusy()) {
						self._setBusy(true);
						var fileInfo = self._getFileInfo(event);
						if (fileInfo.ok) {
							self._execute(fileInfo);
						}
					}
				}));

			// by default, dropping a file on a page will cause
			// the browser to navigate to the file
			var nd = this.wabWidget.domNode;
			this.own(on(nd, "dragenter", function (event) {
					event.preventDefault();
				}));
			this.own(on(nd, "dragleave", function (event) {
					event.preventDefault();
				}));
			this.own(on(nd, "dragover", function (event) {
					event.preventDefault();
				}));
			this.own(on(nd, "drop", function (event) {
					event.preventDefault();
				}));

			this.own(on(this.hintButton, "click", lang.hitch(this, function (event) {
						event.preventDefault();

						var test = '<div class="intro">' +
							'<label>' + this.i18n.addFromFile.intro + "</label>" +
							'<ul>' +
							'<li>' + this.i18n.addFromFile.types.CSV + '</li>' +
							'<li>' + this.i18n.addFromFile.types.KML + '</li>' +
							'<li><span class="note">' + this.i18n.addFromFile.maxFeaturesAllowedPattern
							.replace("{count}", this.maxRecordCount) + '</span></li>' +
							'</ul>' +
							'</div>';

						if (this.wabWidget.isPortal) {
							test = '<div class="intro">' +
								'<label>' + this.i18n.addFromFile.intro + "</label>" +
								'<ul>' +
								'<li>' + this.i18n.addFromFile.types.Shapefile + '</li>' +
								'<li>' + this.i18n.addFromFile.types.CSV + '</li>' +
								'<li>' + this.i18n.addFromFile.types.KML + '</li>' +
								'<li><span class="note">' + this.i18n.addFromFile.maxFeaturesAllowedPattern
								.replace("{count}", this.maxRecordCount) + '</span></li>' +
								'</ul>' +
								'</div>';
						}

						new Message({
							message: test
						});
					})));
		},

		_addFeatures: function (job, featureCollection) {
			//var triggerError = null; triggerError.length;
			var fullExtent,
			layers = [],
			map = job.map,
			nLayers = 0;
			var loader = new LayerLoader();
			if (featureCollection.layers) {
				nLayers = featureCollection.layers.length;
			}
			array.forEach(featureCollection.layers, lang.hitch(this, function (layer) {
					var featureLayer = new FeatureLayer(layer, {
							id: loader._generateLayerId(),
							outFields: ["*"]
						});
					featureLayer.xtnAddData = true;
					if (featureLayer.graphics) {
						job.numFeatures += featureLayer.graphics.length;
					}
					if (nLayers === 0) {
						featureLayer.name = job.baseFileName;
					} else if (typeof featureLayer.name !== "string" ||
						featureLayer.name.length === 0) {
						featureLayer.name = job.baseFileName;
					} else if (featureLayer.name.indexOf(job.baseFileName) !== 0) {
						featureLayer.name = this.i18n.addFromFile.layerNamePattern
							.replace("{filename}", job.baseFileName)
							.replace("{name}", featureLayer.name);
					}
					loader._setFeatureLayerInfoTemplate(featureLayer, null, null);
					if (featureLayer.fullExtent) {
						if (!fullExtent) {
							fullExtent = featureLayer.fullExtent;
						} else {
							fullExtent = fullExtent.union(featureLayer.fullExtent);
						}
					}
					layers.push(featureLayer);
				}));
			if (layers.length > 0) {
				//map.addLayers(layers);
				topic.publish("DnDFeatures", layers);
				if (fullExtent) {
					map.setExtent(fullExtent.expand(1.25), true);
				}
			}
		},

		_analyze: function (job, formData) {
			if (job.fileType.toLowerCase() !== "csv") {
				var dfd = new Deferred();
				dfd.resolve(null);
				return dfd;
			}

			var geocoder = null;
			if (this.wabWidget.batchGeocoderServers &&
				this.wabWidget.batchGeocoderServers.length > 0) {
				geocoder = this.wabWidget.batchGeocoderServers[0];
			}
			var analyzeParams = {
				"enableGlobalGeocoding": true,
				"sourceLocale": kernel.locale
			};
			if (geocoder) {
				analyzeParams.geocodeServiceUrl = geocoder.url;
				if (geocoder.isWorldGeocodeServer) {
					analyzeParams.sourceCountry = "world";
					analyzeParams.sourceCountryHint = "";
				}
			}

			var url = job.sharingUrl + "/content/features/analyze";
			var content = {
				f: "json",
				filetype: job.fileType.toLowerCase(),
				analyzeParameters: window.JSON.stringify(analyzeParams)
			};
			var req = esriRequest({
					url: url,
					content: content,
					form: formData,
					handleAs: "json"
				});
			req.then(function (response) {
				console.warn("Analyzed:", response);
				if (response && response.publishParameters) {
					job.publishParameters = response.publishParameters;
				}
			});
			return req;
		},

		_createFileTypeImage: function (fileTypeName) {
			var isRTL = window.isRTL;
			array.some(this.SHAPETYPE_ICONS, lang.hitch(this, function (filetypeIcon, index) {
					if (fileTypeName.toLowerCase() === filetypeIcon.type.toLowerCase()) {
						var iconImg = document.createElement("IMG");
						iconImg.src = this.wabWidget.folderUrl + filetypeIcon.url;
						iconImg.alt = fileTypeName;
						if (index === 0) {
							iconImg.className += " " + (isRTL ? "last" : "first") + "-type-icon";
						} else if (index === 1) {
							iconImg.className += " second-" + (isRTL ? "last" : "first") + "-type-icon";
						} else if (index === (this.SHAPETYPE_ICONS.length - 2)) {
							iconImg.className += " second-" + (isRTL ? "first" : "last") + "-type-icon";
						} else if (index === (this.SHAPETYPE_ICONS.length - 1)) {
							iconImg.className += " " + (isRTL ? "first" : "last") + "-type-icon";
						}
						this.supportedFileTypes.appendChild(iconImg);
					}
				}));
		},

		_execute: function (fileInfo) {
			var job = {
				map: this.wabWidget.map,
				sharingUrl: this.wabWidget.getSharingUrl(),
				baseFileName: fileInfo.baseFileName,
				fileName: fileInfo.fileName,
				fileType: fileInfo.fileType,
				generalize: true,
				publishParameters: {},
				numFeatures: 0
			};
			this._setBusy(true);
			this._setStatus(this.i18n.addFromFile.addingPattern
				.replace("{filename}", fileInfo.fileName));
			if (fileInfo.fileType.toLowerCase() === "kml") {
				return this._executeKml(fileInfo);
			}
			if (fileInfo.fileType.toLowerCase() === "csv") {
				return this._executeCsv(fileInfo);
			}

			var fileName = fileInfo.fileName;
			var self = this,
			formData = new FormData();
			formData.append("file", fileInfo.file);
			self._analyze(job, formData).then(function () {
				return self._generateFeatures(job, formData);
			}).then(function (response) {
				console.warn("Generated", response);
				// topic.publish("DnDFeatures", response.featureCollection);
				self.features = response.featureCollection;
				self._addFeatures(job, response.featureCollection);
				self._setBusy(false);
				self._setStatus(self.i18n.addFromFile.featureCountPattern
					.replace("{filename}", fileName)
					.replace("{count}", job.numFeatures));
			}).otherwise(function (error) {
				self._setBusy(false);
				self._setStatus(self.i18n.addFromFile.addFailedPattern
					.replace("{filename}", fileName));
				console.warn("Error generating features.");
				console.warn(error);
				if (error && typeof error.message === "string" && error.message.length > 0) {
					// e.g. The maximum number of records allowed (1000) has been exceeded.
					new Message({
						titleLabel: self.i18n._widgetLabel,
						message: self.i18n.addFromFile.generalIssue + "<br><br>" + error.message
					});
				}
			});
		},

		_executeKml: function (fileInfo) {
			var _self = this;
			var reader = new FileReader();
			var map = this.wabWidget.map;

			var handleError = function (pfx, error) {
				_self._setBusy(false);
				_self._setStatus(_self.i18n.addFromFile.addFailedPattern
					.replace("{filename}", fileInfo.fileName));
				console.warn(pfx);
				console.error(error);
				if (error && typeof error.message === "string" && error.message.length > 0) {
					new Message({
						titleLabel: _self.i18n._widgetLabel,
						message: _self.i18n.addFromFile.generalIssue + "<br><br>" + error.message
					});
				}
			};

			reader.onerror = function (err) {
				handleError("FileReader::onerror", err);
			};

			reader.onload = function (event) {
				if (reader.error) {
					handleError("FileReader::error", reader.error);
					return;
				}
				var v = event.target.result;
				var url = "";
				var loader = new LayerLoader();
				var id = loader._generateLayerId();
				var layer = new KMLLayer(url, {
						id: id,
						name: fileInfo.fileName,
						linkInfo: {
							visibility: false
						}
					});
				layer.visible = true;
				delete layer.linkInfo;

				layer._parseKml = function () {
					var self = this;
					this._fireUpdateStart();
					// Send viewFormat as necessary if this kml layer represents a
					// network link i.e., in the constructor options.linkInfo is
					// available and linkInfo has viewFormat property
					this._io = esriRequest({
							url: this.serviceUrl,
							content: {
								/*url: this._url.path + this._getQueryParameters(map),*/
								kmlString: encodeURIComponent(v),
								model: "simple",
								folders: "",
								refresh: this.loaded ? true : undefined,
								outSR: dojoJson.toJson(this._outSR.toJson())
							},
							callbackParamName: "callback",
							load: function (response) {
								//console.warn("response",response);
								self._io = null;
								self._initLayer(response);
								loader._waitForLayer(layer).then(lang.hitch(self, function (lyr) {
										console.warn("lyr", lyr);
										var num = 0;
										lyr.name = fileInfo.fileName;
										lyr.xtnAddData = true;
										var fieldNames = [];
										array.forEach(lyr.getLayers(), function (l) {
											if (l && l.graphics && l.graphics.length > 0) {
												array.forEach(l.graphics, function (g, gIndex) {
													var desc = g.attributes["description"];
													//var domNode = domConstruct.toDom(desc);
													var parser = new DOMParser();
													var doc = parser.parseFromString(desc, "text/html");
													if (doc.getElementsByTagName("table") && doc.getElementsByTagName("table").length>0) {
														var obj = {};
														var test = [].map.call((doc.getElementsByTagName("table")[1]).querySelectorAll('tr'), function(tr, index) {
															console.log(tr);
															var arr = tr.getElementsByTagName("td");
															if (gIndex == 0) {
																fieldNames.push({
																	name: arr[0].textContent
																});
															}
															obj[arr[0].textContent] = arr[1].textContent;
														});
														console.log(obj, fieldNames)
														lang.mixin(g.attributes, obj);
													}

												});
												lang.mixin(l.fields, fieldNames);
												num += l.graphics.length;

											}
										});
										var mapSR = map.spatialReference,
										outSR = lyr._outSR;
										var projOk = (mapSR && outSR) && (mapSR.equals(outSR) ||
											mapSR.isWebMercator() && outSR.wkid === 4326 ||
											outSR.isWebMercator() && mapSR.wkid === 4326);
										if (projOk) {
											/**
											 * Assuming nly one lyer type so far
											 */

											topic.publish("DnDFeatures", lyr.getLayers());
											//self.features = lyr.getLayers()[0].graphics;
											//map.addLayer(lyr);
										} else {
											new Message({
												titleLabel: self.i18n._widgetLabel,
												message: self.i18n.addFromFile.kmlProjectionMismatch
											});
										}
										_self._setBusy(false);
										_self._setStatus(_self.i18n.addFromFile.featureCountPattern
											.replace("{filename}", fileInfo.fileName)
											.replace("{count}", num));
									})).otherwise(function (err) {
									handleError("kml-_waitForLayer.error", err);
								});
							},
							error: function (err) {
								self._io = null;
								err = lang.mixin(new Error(), err);
								err.message = "Unable to load KML: " + (err.message || "");
								self._fireUpdateEnd(err);
								self._errorHandler(err);
								handleError("Unable to load KML", err);
							}
						}, {
							usePost: true
						});
				};
				layer._parseKml();

			};

			try {
				reader.readAsText(fileInfo.file);
			} catch (ex) {
				handleError("FileReader::readAsText", ex);
			}
		},

		isHTML: function (str) {
			var doc = new DOMParser().parseFromString(str, "text/html");
			return Array.from(doc.body.childNodes).some(function(node){ node.nodeType === 1});
		},

		_executeCsv: function (fileInfo) {
			var _self = this;
			var reader = new FileReader();
			var map = this.wabWidget.map;

			var handleError = function (pfx, error) {
				_self._setBusy(false);
				_self._setStatus(_self.i18n.addFromFile.addFailedPattern
					.replace("{filename}", fileInfo.fileName));
				console.warn(pfx);
				console.error(error);
				if (error && typeof error.message === "string" && error.message.length > 0) {
					new Message({
						titleLabel: _self.i18n._widgetLabel,
						message: _self.i18n.addFromFile.generalIssue + "<br><br>" + error.message
					});
				}
			};

			reader.onerror = function (err) {
				handleError("FileReader::onerror", err);
			};

			reader.onload = function (event) {
				if (reader.error) {
					handleError("FileReader::error", reader.error);
					return;
				}
				var data = event.target.result;
				var url = "";
				var loader = new LayerLoader();
				var id = loader._generateLayerId();
				var newLineIdx = data.indexOf("\n");
				var firstLine = lang.trim(data.substr(0, newLineIdx)); //remove extra whitespace, not sure if I need to do this since I threw out space delimiters
				var separator = _self.getSeparator(firstLine);
				var csvStore = new CsvStore({
						data: data,
						separator: separator
					});
				csvStore.fetch({
					onComplete: function (items) {
						var objectId = 0;
						var featureCollection = _self.generateFeatureCollectionTemplateCSV(csvStore, items);
						var latField,
						longField;
						var fieldNames = csvStore.getAttributes(items[0]);
						/* array.forEach(fieldNames, function (fieldName) {
						var matchId;
						matchId = array.indexOf(latFieldStrings,
						fieldName.toLowerCase());
						if (matchId !== -1) {
						latField = fieldName;
						}

						matchId = array.indexOf(longFieldStrings,
						fieldName.toLowerCase());
						if (matchId !== -1) {
						longField = fieldName;
						}
						});
						 */
						// Add records in this CSV store as graphics
						array.forEach(items, function (item) {
							var attrs = csvStore.getAttributes(item),
							attributes = {};
							// Read all the attributes for  this record/item
							array.forEach(attrs, function (attr) {
								var value = Number(csvStore.getValue(item, attr));
								attributes[attr] = isNaN(value) ? csvStore.getValue(item, attr) : value;
							});

							attributes["___OBJECTID"] = objectId;
							objectId++;

							// var latitude = parseFloat(attributes[latField]);
							// var longitude = parseFloat(attributes[longField]);

							//   if (isNaN(latitude) || isNaN(longitude)) {
							//     return;
							//   }

							var feature = {
								"attributes": attributes
							};
							featureCollection.featureSet.features.push(feature);
						});

						var featureLayer = new FeatureLayer(featureCollection, {
								id: 'csvLayer'
							});
						topic.publish("DnDFeatures", [featureLayer]);
						_self._setBusy(false);
						_self._setStatus(_self.i18n.addFromFile.featureCountPattern
							.replace("{filename}", fileInfo.fileName)
							.replace("{count}", featureCollection.featureSet.features.length));
					},
					onError: function (error) {
						// status.innerHTML = '<br/>Error fetching items from CSV store. ' + error.message;
						console.warn("Error fetching items from CSV store: ", error);
						_self._setBusy(false);
						topic.publish("DnDFeatures", []);
					}
				});
			};
			/* var layer = new KMLLayer(url, {
			id: id,
			name: fileInfo.fileName,
			linkInfo: {
			visibility: false
			}
			});
			layer.visible = true;
			delete layer.linkInfo;

			layer._parseKml = function() {
			var self = this;
			this._fireUpdateStart();
			// Send viewFormat as necessary if this kml layer represents a
			// network link i.e., in the constructor options.linkInfo is
			// available and linkInfo has viewFormat property
			this._io = esriRequest({
			url: this.serviceUrl,
			content: {
			/*url: this._url.path + this._getQueryParameters(map),*/
			/* kmlString: encodeURIComponent(v),
			model: "simple",
			folders: "",
			refresh: this.loaded ? true : undefined,
			outSR: dojoJson.toJson(this._outSR.toJson())
			},
			callbackParamName: "callback",
			load: function(response) {
			//console.warn("response",response);
			self._io = null;
			self._initLayer(response);
			loader._waitForLayer(layer).then(function(lyr) {
			console.warn("lyr", lyr);
			var num = 0;
			lyr.name = fileInfo.fileName;
			lyr.xtnAddData = true;
			array.forEach(lyr.getLayers(),function(l) {
			if (l && l.graphics && l.graphics.length > 0 ) {
			num += l.graphics.length;
			}
			});
			var mapSR = map.spatialReference, outSR = lyr._outSR;
			var projOk = (mapSR && outSR) && (mapSR.equals(outSR) ||
			mapSR.isWebMercator() && outSR.wkid === 4326 ||
			outSR.isWebMercator() && mapSR.wkid === 4326);
			if (projOk) {
			/**
			 * Assuming nly one lyer type so far
			 */
			//				   topic.publish("DnDFeatures", lyr.getLayers());
			//self.features = lyr.getLayers()[0].graphics;
			//map.addLayer(lyr);
			/*} else {
			new Message({
			titleLabel: self.i18n._widgetLabel,
			message: self.i18n.addFromFile.kmlProjectionMismatch
			});
			}
			_self._setBusy(false);
			_self._setStatus(_self.i18n.addFromFile.featureCountPattern
			.replace("{filename}",fileInfo.fileName)
			.replace("{count}",num)
			);
			}).otherwise(function(err) {
			handleError("kml-_waitForLayer.error",err);
			});
			},
			error: function(err) {
			self._io = null;
			err = lang.mixin(new Error(), err);
			err.message = "Unable to load KML: " + (err.message || "");
			self._fireUpdateEnd(err);
			self._errorHandler(err);
			handleError("Unable to load KML",err);
			}
			},{usePost:true});
			};
			layer._parseKml();

			};*/

			try {
				reader.readAsText(fileInfo.file);
			} catch (ex) {
				handleError("FileReader::readAsText", ex);
			}
		},

		generateFeatureCollectionTemplateCSV: function (store, items) {
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
				"objectIdField": "___OBJECTID",
				"type": "Feature Layer",
				"typeIdField": "",
				"drawingInfo": {
					"renderer": {
						"type": "simple",
						"symbol": {
							"type": "esriPMS",
							"url": "https://static.arcgis.com/images/Symbols/Basic/RedSphere.png",
							"imageData": "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",
							"contentType": "image/png",
							"width": 15,
							"height": 15
						}
					}
				},
				"fields": [{
						"name": "___OBJECTID",
						"alias": "___OBJECTID",
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

		_generateFeatures: function (job, formData) {
			var url = job.sharingUrl + "/content/features/generate";
			job.publishParameters = job.publishParameters || {};
			var params = lang.mixin(job.publishParameters, {
					name: job.baseFileName,
					targetSR: job.map.spatialReference,
					maxRecordCount: this.maxRecordCount,
					enforceInputFileSizeLimit: true,
					enforceOutputJsonSizeLimit: true
				});
			if (job.generalize) {
				// 1:40,000
				var extent = scaleUtils.getExtentForScale(job.map, 40000);
				var resolution = extent.getWidth() / job.map.width;
				params.generalize = true;
				params.maxAllowableOffset = resolution;
				// 1:4,000
				resolution = resolution / 10;
				var numDecimals = 0;
				while (resolution < 1) {
					resolution = resolution * 10;
					numDecimals++;
				}
				params.reducePrecision = true;
				params.numberOfDigitsAfterDecimal = numDecimals;
			}
			var content = {
				f: "json",
				filetype: job.fileType.toLowerCase(),
				publishParameters: window.JSON.stringify(params)
			};
			return esriRequest({
				url: url,
				content: content,
				form: formData,
				handleAs: "json"
			});
		},

		_getBaseFileName: function (fileName) {
			var a,
			baseFileName = fileName;
			if (sniff("ie")) { //fileName is full path in IE so extract the file name
				a = baseFileName.split("\\");
				baseFileName = a[a.length - 1];
			}
			a = baseFileName.split(".");
			//Chrome and IE add c:\fakepath to the value - we need to remove it
			baseFileName = a[0].replace("c:\\fakepath\\", "");
			return baseFileName;
		},

		_getBusy: function () {
			return domClass.contains(this.uploadLabel, "disabled");
		},

		_getFileInfo: function (dropEvent) {
			var file,
			files;
			var info = {
				ok: false,
				file: null,
				fileName: null,
				fileType: null
			};
			if (dropEvent) {
				files = dropEvent.dataTransfer.files;
			} else {
				files = this.fileNode.files;
			}
			if (files && files.length === 1) {
				info.file = file = files[0];
				info.fileName = file.name;
				if (util.endsWith(file.name, ".zip")) {
					info.ok = true;
					info.fileType = "Shapefile";
				} else if (util.endsWith(file.name, ".csv")) {
					info.ok = true;
					info.fileType = "CSV";
				} else if (util.endsWith(file.name, ".kml")) {
					info.ok = true;
					info.fileType = "KML";
				} else if (util.endsWith(file.name, ".gpx")) {
					info.ok = true;
					info.fileType = "GPX";
				} else if (util.endsWith(file.name, ".geojson") ||
					util.endsWith(file.name, ".geo.json")) {
					info.ok = true;
					info.fileType = "GeoJSON";
				}
			}
			if (info.ok) {
				info.ok = array.some(this.SHAPETYPE_ICONS, function (filetypeIcon) {
						return filetypeIcon.type.toLowerCase() === info.fileType.toLowerCase();
					});
			}
			if (info.ok) {
				info.baseFileName = this._getBaseFileName(info.fileName);
			} else {
				var msg = this.i18n.addFromFile.invalidType,
				usePopup = true;
				if (typeof info.fileName === "string" && info.fileName.length > 0) {
					msg = this.i18n.addFromFile.invalidTypePattern
						.replace("{filename}", info.fileName);
				}
				this._setBusy(false);
				this._setStatus(msg);
				if (usePopup) {
					var nd = document.createElement("div");
					nd.appendChild(document.createTextNode(msg));
					new Message({
						titleLabel: this.i18n._widgetLabel,
						message: nd
					});
				}
			}
			return info;
		},

		resize: function () {},

		_setBusy: function (isBusy) {
			if (isBusy) {
				domClass.add(this.uploadLabel, "disabled");
				domClass.add(this.dropArea, ["hit", "disabled"]);
			} else {
				domClass.remove(this.uploadLabel, "disabled");
				domClass.remove(this.dropArea, ["hit", "disabled"]);
			}
		},

		_setStatus: function (msg) {
			if (this.wabWidget) {
				// this.wabWidget._setStatus(msg);
				console.log(msg);
			}
		}

	});

});
