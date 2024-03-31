import '../scss/style.scss';
import { Map, View } from 'ol';
// import $ from 'jquery/dist/jquery'
import $ from 'jquery'
window.jQuery = window.$ = $

import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS.js';
import Geolocation from 'ol/Geolocation.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import {Circle as CircleStyle, Fill, Stroke, Style, Icon} from 'ol/style.js';
import {Vector as VectorLayer} from 'ol/layer.js';
import {Vector as VectorSource} from 'ol/source.js';
import * as olProj from 'ol/proj';
import WMSCapabilities from 'ol/format/WMSCapabilities.js';

// var init
// create map

window.mapRef = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM(),
      title: 'Open Street Map',
      visible: false
    })
  ],
  view: new View({
    center: [0, 0],
    zoom: 1
  })
});

//add wms layer from geoserver
// parse wms capabilities from geoserver
const parser = new WMSCapabilities();
fetch('http://155.254.244.85/geoserver/wms?request=getcapabilities')
  .then(function (response) {
    return response.text();
  })
  .then(function (text) {
    const result = parser.read(text);
    // get layer names from wms capabilities
    window.layerNamesListWMS = result.Capability.Layer.Layer.map(layer => layer.Name);
    console.log(layerNamesListWMS);

    // Remove some elements from the layerNamesListWMS array
    const filteredLayerNames = layerNamesListWMS.filter(layerName => {
      return layerName == "ne:world" || layerName == "topp:states";
    });

    addWMSLayer(filteredLayerNames) // TODO

  });


function authTileLoadFunction(tile, src) {
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.open('GET', src);
  xhr.setRequestHeader("Authorization", "Basic " + window.btoa('gis_app' + ":" + 'ace$$@123'));
  xhr.onload = function () {
    if (this.response) {
      var objectUrl = URL.createObjectURL(xhr.response);
      tile.getImage().onload = function () {
        URL.revokeObjectURL(objectUrl);
      };
      tile.getImage().src = objectUrl;
    } else {
      tile.setState(3);
    }
  };
  xhr.onerror = function () {
    tile.setState(3);
  };
  xhr.send();
}


function addWMSLayer(layerNamesListWMS) {

  var ashokTileSource = new TileWMS({
    url: "http://155.254.244.85/geoserver/wms",
    serverType: 'geoserver',
    params: {
      'LAYERS': layerNamesListWMS,
      'TILED': true,

    },
    tileLoadFunction: authTileLoadFunction
  })

  const wmsLayer = new TileLayer({
    source: ashokTileSource,
    title: 'WMS Layers',
    visible: true
  });
  mapRef.addLayer(wmsLayer);

  layerListUI();

}


// show list of layers and hide and show option
function layerListUI(params) {
  const layerList = document.getElementById('layer-list');
  const layerNames = mapRef.getLayers().getArray().map(layer => layer.get('title'));

  layerNames.forEach(layerName => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = layerName;
    checkbox.value = layerName;

    const layers = mapRef.getLayers().getArray();
    const layer = layers.find(layer => layer.get('title') === layerName);
    checkbox.checked = layer.getVisible();


    const label = document.createElement('label');
    label.for = layerName;
    label.innerHTML = layerName;
    label.style  = ("margin-left: 10px;");


    const grp = document.createElement('div');
    grp.className = "input-group-text";
    grp.style  = ("margin-bottom: 10px;");

    layerList.appendChild(grp);
    grp.appendChild(checkbox);
    grp.appendChild(label);

    checkbox.addEventListener('change', function () {
      const layers = mapRef.getLayers().getArray();
      const layer = layers.find(layer => layer.get('title') === layerName);
      layer.setVisible(this.checked);
    });

  });
}

$("#ic-layers").on("click", function () {
  $("#layerGroupDiv").toggle();

})