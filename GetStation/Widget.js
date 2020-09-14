define(['dojo/_base/declare',
		'dijit/_WidgetsInTemplateMixin',
		'jimu/BaseWidget',
		"jimu/dijit/SimpleTable",
		'jimu/dijit/TabContainer3',
		'jimu/dijit/Message',
		'jimu/LayerInfos/LayerInfos',
		'jimu/portalUrlUtils',
		'jimu/portalUtils',
		'dojo/on',
		'dojo/has',
		"dojo/_base/Color",
		"dojo/dom",
		"dojo/json",
		'dojo/query',
		'dojo/_base/html',
		'dojo/_base/array',
		'dojo/_base/lang',
		"dojo/dom-style",
		"dojo/keys",
		'dijit/form/TextBox',
		'dijit/form/Button',
		"dijit/layout/TabContainer",
		"dijit/layout/ContentPane",
		"dijit/form/ValidationTextBox",
		"dijit/form/NumberTextBox",
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
		"esri/symbols/jsonUtils",
		'esri/undoManager',
		"esri/renderers/Renderer",
		"dojo/data/ItemFileReadStore",
		"dojo/dom",
		"dojo/dom-construct",
		"dojo/json",
		"dojo/parser",
		"dijit/layout/BorderContainer",
		"dijit/layout/ContentPane",
		"dojo/store/Memory",
		"dijit/form/FilteringSelect",
		"dojox/data/CsvStore",
		"dojox/encoding/base64",
		"dojox/grid/DataGrid",
		"esri/layers/FeatureLayer",
		"esri/dijit/Popup",
		"esri/domUtils",
		"esri/dijit/Search",
		"esri/geometry/Extent",
		"esri/geometry/Multipoint",
		"esri/geometry/Point",

		"esri/geometry/webMercatorUtils",
		'./js/utils/MeasureTask1',
		'./views/DnD',
		'./js/utils/EsriQuery',
		'./js/utils/EsriQueryTask',
		'dijit/Tooltip',
		'dijit/form/CheckBox'
	],
	function (declare,
		_WidgetsInTemplateMixin,
		BaseWidget,
		SimpleTable,
		TabContainer3,
		Message,
		LayerInfos,
		portalUrlUtils,
		portalUtils,
		on,
		has,
		Color,
		dom,
		json,
		query,
		html,
		array,
		lang,
		domStyle,
		keys,
		TextBox,
		Button,
		TabContainer,
		ContentPane,
		ValidationTextBox,
		NumberTextBox,
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
		jsonUtils,
		UndoManager,
		Renderer,
		ItemFileReadStore, dom, domConstruct, json, parser, BorderContainer,
		ContentPane, Memory, FilteringSelect, CsvStore, dojoxBase64, DataGrid,
		FeatureLayer, Popup, domUtils, Search, Extent, Multipoint, Point, webMercatorUtils,
		MeasureTask1, DnD, EsriQuery, EsriQueryTask) {

	var clazz = declare([BaseWidget, _WidgetsInTemplateMixin], {

			baseClass: 'GetStation',
			drawActive: false,
			_feature: null,
			_input_location: null,
			undoManager: null,
			_renderer: null,
			layerIdPrefix: "__snap_",
			_managedLayers: null, // array of FeatureLayer
			_layerIdCounter: 0, // for generating unique layer IDs
			_snapManager:null,

			postCreate: function () {
				this.inherited(arguments);
				console.log('postCreate');
				if (this.config.enableSnapping) {
					var featureLayer = this._createFeatureLayer(this.config.snappingLayerUrl);
					this.map.addLayer(featureLayer)
					this._snapManager = this.map.enableSnapping({
							alwaysSnap: true,
							snapPointSymbol: jsonUtils.fromJson(this.config.snapSymbol),
							tolerance: this.config.snapTolerance
						});
					if (featureLayer) {
						var layerInfos = [{
								layer: featureLayer
							}
						];
						this._snapManager.setLayerInfos(layerInfos);
					}
				}
				this._initUI();
			},

			_createFeatureLayer: function (url, options) {
				options = options || {};

				var layerOptions = {
					id: this.layerIdPrefix + new Date().getTime() + "_" + this._layerIdCounter++,
					autoGeneralize: false,
					displayOnPan: false,
					opacity: 0 // not supported in IE
				};
				lang.mixin(layerOptions, options);

				var layer = new FeatureLayer(url, layerOptions);
				if (options.definitionExpression) {
					layer.setDefinitionExpression(options.definitionExpression);
				}

				// Use a custom renderer so that features are invisible on the map
				layer.setRenderer(this._getFeatureRenderer());

				// Remember this layer in order to manage its lifecycle
				if (!this._managedLayers) {
					this._managedLayers = [];
				}
				this._managedLayers.push(layer);

				return layer;
			},

			_getFeatureRenderer: function () {
				if (!this._renderer) {
					this._renderer = new SnapLayerRenderer();
				}
				return this._renderer;
			},

			_initUI: function () {
				var tabs = [];
				this.networkLayers = this.config.networkLayers;
				this.zoomScale = this.config.zoomScale;
				this.inputDraw.src = this.folderUrl + "images/draw_point.png";
				this.engineeringLayers = array.filter(this.networkLayers, function (layer) {
						return layer.type === "Engineering"
					});

				this.engineeringLayer = this.engineeringLayers[0];

				this.continuousLayers = array.filter(this.networkLayers, function (layer) {
						return layer.type === "Continuous"
					});

				this.continuousLayer = this.continuousLayers[0];

				/* var queryField = this.engineeringLayer.queryField;
				var esriQuery = new EsriQuery();
				esriQuery.url = this.engineeringLayer.queryUrl;
				esriQuery.whereClause = "1=1";
				esriQuery.outFields = [queryField];
				esriQuery.returnGeometry = false;
				esriQuery.returnDistinctValues = true;


				var esriQueryTask = new EsriQueryTask();
				esriQueryTask.loadResults(esriQuery).then(lang.hitch(this,function(queryResults){
				var features = queryResults;
				var lineNames = [];
				array.forEach(queryResults,function(f,index){
				var val = f.attributes[queryField];
				lineNames.push({id:val,lineName:val});
				});
				if(lineNames.length > 0){
				var lineNamesStore = new Memory({ data:  lineNames});
				this.lineName = new FilteringSelect({
				id: "lineNameFilter",
				store: lineNamesStore,
				autoComplete: true,
				searchAttr: "lineName",
				style: "width: 250px;",
				onChange: lang.hitch(this,this._loadRoutesForLineName),
				labelFunc: function labelFunc(item, store){
				var label = item.lineName;
				return label;
				}
				}, this.lineNameFilter);
				this.lineName.startup();
				this.lineName.set("value", lineNamesStore.getIdentity(lineNamesStore.data[0])); */

				this.undoManager = new UndoManager({
						maxOperations: 0
					});
				this.searchWidget = new Search({
						map: this.map,
						sources: [{
								featureLayer: new FeatureLayer(this.continuousLayer.queryUrl),
								searchFields: [this.continuousLayer.queryField],
								exactMatch: false,
								placeholder: this.nls.primaryPlaceholder,
								outFields: [this.continuousLayer.queryField],
								name: this.continuousLayer.primaryName,
								popupEnabled: false,
								popupOpenOnSelect: false,
								minSuggestCharacters: 1,
								resultGraphicEnabled: false,
								showInfoWindowOnSelect: false,
								autoNavigate: false,
								maxResults: 10,
								maxSuggestions: 15,
								enableButtonMode: false,
								suggestionTemplate: this.continuousLayer.primarysuggestionTemplate,
								searchQueryParams: {
									returnGeometry: false,
									returnZ: false
								}
							}
						]
					}, this.lineNameFilter);
				this.searchWidget.startup();
				this.own(on(this.searchWidget, 'select-result', lang.hitch(this, function (e) {
							console.log('selected result', e);
							if (e.result && e.result.feature) {
								this.searchWidget.set("value", e.result.feature.attributes[this.continuousLayer.queryField]);
							}
						})));

				this.dnd = new DnD({
						map: this.map,
						nls: this.nls,
						wabWidget: this,
						engineeringLayer: this.engineeringLayer,
						continuousLayer: this.continuousLayer,
						mapDomNode: this.map.domNode,
						config: this.config
					});
				domConstruct.place(this.dnd.domNode, this.containerNode);

				var measureTask = new MeasureTask1({
						map: this.map,
						engineeringLayer: this.engineeringLayer,
						continuousLayer: this.continuousLayer,
						undoManager: this.undoManager,
						x: this.x,
						y: this.y,
						nls: this.nls,
						xyTable: this.xyTable,
						lineName: this.searchWidget, //this.lineName,
						contRadio: this.contRadio,
						mileRadio: this.mileRadio,
						beginMeasure: this.beginMeasure,
						endMeasure: this.endMeasure,
						resultsdiv: this.resultsdiv,
						measureResultsdiv: this.measureResultsdiv,
						zoomScale: this.zoomScale,
						multiClick: this.multiClick.checked,
						config: this.config
					});

				tabs.push({
					title: this.nls.geometryToMeasure,
					content: this.geometryToMeasure.domNode
				});
				tabs.push({
					title: this.nls.measureToGeometry,
					content: this.measureToGeometry.domNode
				});
				tabs.push({
					title: this.nls.dnd,
					content: this.dndPanel.domNode
				});

				this._measureTask = measureTask;
				var _this = this;
				var tabsContainer = new TabContainer3({
						average: true,
						tabs: tabs
					}, this.tabsNode);
				this.own(on(this.locateBtn, 'click', lang.hitch(measureTask, measureTask.measureToGeom)));

				//bind UndoManager events
				this.own(on(this.undoManager, 'change', lang.hitch(this, this._onUndoManagerChanged)));

				this.toolbar = new Draw(this.map, {
						tooltipOffset: 20,
						drawTime: 90
					});

				this.btnUndo.setDisabled(true);
				this.btnRedo.setDisabled(true);

				this.toolbar.deactivate();
				this.toolbar.on("draw-end", function (evt) {
					if (_this.multiClick.checked) {
						measureTask.addToMap(evt);
					} else {
						measureTask.geomToMeasure(evt);
					}
				});
				this.own(on(this.multiClick, "change", function () {
					    if (_this.multiClick.checked) {
							_this.btnUndo.setDisabled(false);
							_this.btnRedo.setDisabled(false);
							_this.measureBtn.setDisabled(false);
							html.removeClass(_this.btnAddXYField, 'disable');
						} else {
							_this.btnUndo.setDisabled(true);
							_this.btnRedo.setDisabled(true);
							_this.measureBtn.setDisabled(true);
							html.addClass(_this.btnAddXYField, 'disable');
						}
						_this.map.graphics.clear();
						_this.map.infoWindow.hide();
						measureTask.setMultiClickValue(_this.multiClick.checked);
						_this.disableWebMapPopup();
						_this.toolbar.activate(Draw.POINT);
					}));
				this.own(on(this.inputDraw, "click", lang.hitch(this, this._toggleDraw)));

				this.own(on(this.btnUndo, "click", lang.hitch(this, this._onBtnUndoClicked)));
				this.own(on(this.btnRedo, "click", lang.hitch(this, this._onBtnRedoClicked)));
				this.own(on(this.measureBtn, "click", function () {
						_this._deactivateDrawKeepMeasure();
						measureTask.geomToMeasure();
					}));
				this.own(on(this.exportBtn, "click", lang.hitch(this, this.exportToCSV)));
				this.own(on(this.measureToGeomExportBtn, "click", lang.hitch(this, this.measureToGeomExportToCSV)));
				this.own(on(this.geomToMeasureClear, "click", lang.hitch(this, this._clearGeomToMeasure)));
				this.own(on(this.measureToGeomClear, "click", lang.hitch(this, this._clearMeasureToGeom)));

				this.own(on(this.btnAddXYField, 'click', lang.hitch(this, this._addXYFieldRow)));
				this.own(on(this.xyTable, 'row-delete', lang.hitch(this, function (tr) {
							if (tr.select) {
								tr.select.destroy();
								delete tr.select;
							}
						})));
				this._activeDraw();
				this.own(on(tabsContainer, 'tabChanged', lang.hitch(this, function (title) {
							//	console.log(title);
							if (title == this.nls.geometryToMeasure) {
								lang.hitch(this, this._activeDraw());
							} else {
								lang.hitch(this, this._deactivateDraw());
								this.enableWebMapPopup();
							}
						})));
				var table = query(".jimu-simple-table", this.domNode)[0];
				if (table) {
					html.setStyle(table, "display", "none");
				}

				//}
				//}));

			},

			_onBtnUndoClicked: function () {
				this.undoManager.undo();
			},

			_onBtnRedoClicked: function () {
				this.undoManager.redo();
			},

			_onUndoManagerChanged: function () {
				this.btnUndo.setDisabled(!this.undoManager.canUndo);
				this.btnRedo.setDisabled(!this.undoManager.canRedo);
			},

			onClose: function () {
				this._deactivateDraw();
				this.enableWebMapPopup();
			},

			_loadRoutesForLineName: function (e) {
				console.log(e);
			},

			disableWebMapPopup: function () {
				if (this.map) {
					this.map.setInfoWindowOnClick(false);
				}
			},

			enableWebMapPopup: function () {
				if (this.map) {
					this.map.setInfoWindowOnClick(true);
				}
			},

			resize: function () {
				console.log("Resize widget");
				this.dnd.resizeGrid();
				dijit.byId("tabsContainer").resize();
				//TODO
				domStyle.set(dijit.byId("tabsContainer"), "height", "auto");
				this.dndPanel.resize();
				domStyle.set(this.dndPanel, "height", "auto");
				this.dnd.grid.resize();
			},

			disableWebMapPopup2: function () {
				this.map.setInfoWindowOnClick(false);
				if (this.map && this.map.webMapResponse) {
					var handler = this.map.webMapResponse.clickEventHandle;
					if (handler) {
						handler.remove();
						this.map.webMapResponse.clickEventHandle = null;
					}
				}
			},

			enableWebMapPopup2: function () {
				this.map.setInfoWindowOnClick(true);
				if (this.map && this.map.webMapResponse) {
					var handler = this.map.webMapResponse.clickEventHandle;
					var listener = this.map.webMapResponse.clickEventListener;
					if (listener && !handler) {
						this.map.webMapResponse.clickEventHandle = on(this.map, 'click', lang.hitch(this.map, listener));
					}
				}
			},
		
			_clearGeomToMeasure: function () {
				this.btnUndo.setDisabled(true);
				this.btnRedo.setDisabled(true);

				this.xyTable.clear();
				this.xyTable.style.display = "none";
				var gl = this.map.getLayer("Geometry to Stationing Result");
				if (gl) {
					gl.clear();
				}
				var gll = this.map.getLayer("Geometry to Stationing Result Labels");
				if (gll) {
					gll.clear();
				}
				this.map.graphics.clear();
				this.map.infoWindow.hide();
				this._measureTask.clearInputs();
				this._deactivateDrawKeepMeasure();
			},

			_clearMeasureToGeom: function () {
				this.searchWidget.set("value", "");
				this.engRadio.checked = true;
				this.contRadio.checked = false;
				this.beginMeasure.set("value", "");
				this.endMeasure.set("value", "");
				this.resultsdiv.innerHTML = "";
				var gl = this.map.getLayer("Geometry to Stationing Result");
				if (gl) {
					gl.clear();
				}
				var gll = this.map.getLayer("Geometry to Stationing Result Labels");
				if (gll) {
					gll.clear();
				}
				this.map.graphics.clear();
				this.map.infoWindow.hide();
				this._measureTask.clearMeasureInputs();
			},

			_toggleDraw: function () {
				if (!this.drawActive) {
					this.disableWebMapPopup();
					this.toolbar.activate(Draw.POINT);
					this.drawActive = true;
					//this.inputDraw.style
					domStyle.set(this.inputDraw, "background-color", "#c0daf4");
					//this.x.set("value", "");
					//this.y.set("value", "");
					this.xyTable.clear();
					this._isDrawGeomToStation = true;
				} else {
					this.enableWebMapPopup();
					this.toolbar.deactivate();
					this.drawActive = false;
					domStyle.set(this.inputDraw, "background-color", "");
					this.map.graphics.clear();
					this.map.infoWindow.hide();
					this._isDrawGeomToStation = false;
				}
			},

			_activeDraw: function () {
				this.disableWebMapPopup();
				this._isDrawGeomToStation = true;
				this.toolbar.activate(Draw.POINT);
				this.drawActive = true;
				//this.inputDraw.style
				domStyle.set(this.inputDraw, "background-color", "#c0daf4");
				//this.x.set("value", "");
				//this.y.set("value", "");
				this.xyTable.clear();
			},

			_deactivateDrawKeepMeasure: function () {
				this.enableWebMapPopup();
				this.toolbar.deactivate();
				this.drawActive = false;
				domStyle.set(this.inputDraw, "background-color", "");
				this.map.graphics.clear();
				this.map.infoWindow.hide();
				this._isDrawGeomToStation = false;
			},

			_addXYFieldRow: function () {
				this._deactivateDraw();
				var table = query(".jimu-simple-table", this.domNode)[0];
				if (table) {
					html.setStyle(table, "display", "");
				}

				var result = this.xyTable.addRow({});
				if (result.success && result.tr) {
					var tr = result.tr;
					this._addXYFields(tr);
				}
			},

			_addXYFields: function (tr) {
				var xtd = query('.simple-table-cell', tr)[0];
				html.setStyle(xtd, "verticalAlign", "middle");
				var x, y;
				
				if(this.config.boundaryValues){
					x = new NumberTextBox({
						constraints:{min:this.config.boundaryValues.xmin,max:this.config.boundaryValues.xmax,places:8},
						invalidMessage: this.nls.invalidLatitudeValue,
						placeHolder: this.nls.xHint,
						rangeMessage: this.nls.invalidRange + this.config.boundaryValues.xmin + " and " + this.config.boundaryValues.xmax

					});
					y = new NumberTextBox({
						constraints:{min:this.config.boundaryValues.ymin,max:this.config.boundaryValues.ymax,places:8},
						invalidMessage: this.nls.invalidLongitudeValue,
						placeHolder: this.nls.yHint,
						rangeMessage: this.nls.invalidRange + this.config.boundaryValues.ymin + " and " + this.config.boundaryValues.ymax
					});
				} else {
					x = new ValidationTextBox({
						regExp: "^-?\\d*\\.?\\d+([eE][+-]?\\d+)?$",
						invalidMessage: this.nls.invalidLatitudeValue,
						placeHolder: this.nls.xHint

					});
					y = new ValidationTextBox({
						regExp: "^-?\\d*\\.?\\d+([eE][+-]?\\d+)?$",
						invalidMessage: this.nls.invalidLongitudeValue,
						placeHolder: this.nls.yHint
					});
				}
				x.startup();
				x.placeAt(xtd);

				var ytd = query('.simple-table-cell', tr)[1];
				html.setStyle(ytd, "verticalAlign", "middle");
				
				y.startup();
				y.placeAt(ytd);

				tr.xField = x;
				tr.yField = y;
			},

			_exportCsv: function () {
				var infos = this._measureTask.getGeomToStationCsvInfos();
				var len = infos.length;
				if (len === 0) {
					return false;
				}

				var popup = new Message({
						message: this.nls.exportMessage,
						titleLabel: this.nls.exportFiles,
						autoHeight: true,
						buttons: [{
								label: this.nls.ok,
								onClick: lang.hitch(this, function () {
									this.exportToCSV();
									popup.close();
								})
							}, {
								label: this.nls.cancel,
								onClick: lang.hitch(this, function () {
									popup.close();
								})
							}
						]
					});
			},

			exportToCSV: function () {

				var infos = this._measureTask.getGeomToStationCsvInfos();
				var len = infos.length;
				if (len === 0) {
					return false;
				}

				var csvString = "";

				// build the header
				var fields = [{
									fieldName:"Location",
									fieldAlias:"Location"
							   },{
									fieldName:"Result",
									fieldAlias:"Result"
							    },{
									fieldName:"Status", 
									fieldAlias:"Status"
							    },{
									fieldName:"LineName", 
									fieldAlias:this.nls.lineNameLabel.replace(" : ","")
							    },{
									fieldName:"Lat",
									fieldAlias:this.nls.latitudeLabel.replace(" : ","")
							    },{
									fieldName:"Long",
									fieldAlias:this.nls.longitudeLabel.replace(" : ","")
							    },{
									fieldName:"Station", 
									fieldAlias:this.nls.engineeringStationLabel.replace(" : ","")
							    },{
									fieldName:"ContStation",
									fieldAlias:this.nls.continuousStationLabel.replace(" : ","")
							    }];
				if (this.config.showMilePost) {
					fields.push({
									fieldName:"MilePost",
									fieldAlias:this.nls.milePostLabel.replace(" : ","")
							    })
				}
				var n_fields = fields.length;
				var lyr_fields_vals = infos;
				var tableCols = fields;

				for (var i = 0; i < n_fields; i++) {
					csvString += (csvString.length == 0 ? "" : ",") + '"' + fields[i].fieldAlias + '"';
				}
				csvString += "\r\n";

				// build the csv values
				//rows
				array.forEach(infos, function (info) {
					var csvRow = "";
					array.forEach(fields, function (field, index) {
						var val = typeof(info[field.fieldName]) !== "undefined" ? info[field.fieldName] : "";
						csvRow += (csvRow.length == 0 ? "" : ",") + '"' + val + '"';
					});
					csvString += csvRow + "\r\n";
				});

				this.download("geomToStation.csv", csvString);
			},

			measureToGeomExportToCSV: function () {
				var infos = this._measureTask.getStationToGeomCsvInfos();
				var len = infos.length;
				if (len === 0) {
					return false;
				}

				var csvString = "";

				// build the header
				var fields;
				var beginMeasure = this.beginMeasure.value;
				var endMeasure = this.endMeasure.value;
				if (endMeasure && endMeasure.replace(/\s/g, "") != "") {
					fields = [{
									fieldName:"Name", 
									fieldAlias:this.nls.lineNameLabel.replace(" : ","")
							    },{
									fieldName:"FromStation",
									fieldAlias:this.nls.fromEngineeringStationLabel.replace(" : ","")
							    },{
									fieldName:"ToStation",
									fieldAlias:this.nls.toEngineeringStationLabel.replace(" : ","")
							    },{
									fieldName:"FromConstStation", 
									fieldAlias:this.nls.fromContinuousStationLabel.replace(" : ","")
							    },{
									fieldName:"ToConstStation",
									fieldAlias:this.nls.toContinuousStationLabel.replace(" : ","")
							    }];
					if (this.config.showMilePost) {
						fields.push({
									fieldName:"FromMilePost",
									fieldAlias:this.nls.fromMilePostLabel.replace(" : ","")
							    });
						fields.push({
									fieldName:"ToMilePost",
									fieldAlias:this.nls.toMilePostLabel.replace(" : ","")
							    });
					}
					fields.push({
									fieldName:"FromLatLong", 
									fieldAlias:this.nls.fromLatLongLabel.replace(" : ","")
							    },{
									fieldName:"ToLatLong",
									fieldAlias:this.nls.toLatLongLabel.replace(" : ","")
							    });
				} else if (beginMeasure && beginMeasure.replace(/\s/g, "") != "") {
					fields = [{
									fieldName:"Name", 
									fieldAlias:this.nls.lineNameLabel.replace(" : ","")
							    },{
									fieldName:"Station", 
									fieldAlias:this.nls.engineeringStationLabel.replace(" : ","")
							    },{
									fieldName:"ConstStation",
									fieldAlias:this.nls.continuousStationLabel.replace(" : ","")
							    }];
					if (this.config.showMilePost) {
						fields.push({
									fieldName:"MilePost",
									fieldAlias:this.nls.milePostLabel.replace(" : ","")
							    })
					}
					fields.push({
									fieldName:"Lat",
									fieldAlias:this.nls.latitudeLabel.replace(" : ","")
							    },{
									fieldName:"Long",
									fieldAlias:this.nls.longitudeLabel.replace(" : ","")
							    }
					);
				} else {
					fields = [{
									fieldName:"Name", 
									fieldAlias:this.nls.lineNameLabel.replace(" : ","")
							    },{
									fieldName:"FromStation",
									fieldAlias:this.nls.fromEngineeringStationLabel.replace(" : ","")
							    },{
									fieldName:"ToStation",
									fieldAlias:this.nls.toEngineeringStationLabel.replace(" : ","")
							    },{
									fieldName:"FromConstStation", 
									fieldAlias:this.nls.fromContinuousStationLabel.replace(" : ","")
							    },{
									fieldName:"ToConstStation",
									fieldAlias:this.nls.toContinuousStationLabel.replace(" : ","")
							    }];
					if (this.config.showMilePost) {
						fields.push({
									fieldName:"FromMilePost",
									fieldAlias:this.nls.fromMilePostLabel.replace(" : ","")
							    });
						fields.push({
									fieldName:"ToMilePost",
									fieldAlias:this.nls.toMilePostLabel.replace(" : ","")
							    });
					}
					fields.push({
									fieldName:"FromLatLong", 
									fieldAlias:this.nls.fromLatLongLabel.replace(" : ","")
							    },{
									fieldName:"ToLatLong",
									fieldAlias:this.nls.toLatLongLabel.replace(" : ","")
							    }
					);
				}

				var n_fields = fields.length;
				var lyr_fields_vals = infos;
				var tableCols = fields;

				for (var i = 0; i < n_fields; i++) {
					csvString += (csvString.length == 0 ? "" : ",") + '"' + fields[i].fieldAlias + '"';
				}
				csvString += "\r\n";

				// build the csv values
				//rows
				array.forEach(infos, function (info) {
					var csvRow = "";
					array.forEach(fields, function (field, index) {
						var val = typeof(info[field.fieldName]) !== "undefined" ? info[field.fieldName] : "";
						csvRow += (csvRow.length == 0 ? "" : ",") + '"' + val + '"';
					});
					csvString += csvRow + "\r\n";
				});

				this.download("stationToGeom.csv", csvString);
			},

			download: function (filename, csvString) {
				var blob = new Blob([csvString], {
						type: 'text/csv;charset=utf-8;'
					});
				if (navigator.msSaveBlob) { // IE 10+
					navigator.msSaveBlob(blob, filename);
				} else if (has("ie")) { // has module unable identify ie11
					var oWin = window.top.open();

					oWin.document.write('sep=,\r\n' + csvString);

					oWin.document.close();

					oWin.document.execCommand('SaveAs', true, filename + ".csv");

					oWin.close();
				} else {
					 var blob = new Blob([csvString], {type: 'text/plain;charset=utf-8'});
					// Use saveAs(blob, name, true) to turn off the auto-BOM stuff
					saveAs(blob, filename, true);
				}
			},

			_isIE11: function () {
				var iev = 0;
				var ieold = (/MSIE (\d+\.\d+);/.test(navigator.userAgent));
				var trident = !!navigator.userAgent.match(/Trident\/7.0/);
				var rv = navigator.userAgent.indexOf("rv:11.0");

				if (ieold) {
					iev = Number(RegExp.$1);
				}
				if (navigator.appVersion.indexOf("MSIE 10") !== -1) {
					iev = 10;
				}
				if (trident && rv !== -1) {
					iev = 11;
				}

				return iev === 11;
			},

			_deactivateDraw: function () {
				//this.enableWebMapPopup();
				this.toolbar.deactivate();
				this.drawActive = false;
				domStyle.set(this.inputDraw, "background-color", "");
				this.map.graphics.clear();
				this.map.infoWindow.hide();
			},

			getSharingUrl: function () {
				//var p = portalUtils.getPortal(this.appConfig.portalUrl);
				//return portalUrlUtils.getSharingUrl(p.portalUrl);
				return "https://rats.maps.arcgis.com";
			}

		});

	/*
	 * A custom feature renderer that provides null-style symbols for any geometry type.
	 * This effectively renders invisible features.
	 */
	var SnapLayerRenderer = declare([Renderer], {
			_symbols: null, // maps geometry type to symbol

			constructor: function () {
				var symbols = {},
				nullColor = new Color([255, 255, 255, 0]);
				symbols["point"] = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 1, null, nullColor);
				symbols["multipoint"] = symbols["point"];
				symbols["polyline"] = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, nullColor, 1);
				symbols["polygon"] = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NULL, null, nullColor);
				this._symbols = symbols;
			},

			getSymbol: function (graphic) {
				if (graphic && graphic.geometry) {
					return this._symbols[graphic.geometry.type];
				}
				return null;
			}
		}); // end declare

	return clazz;
});
