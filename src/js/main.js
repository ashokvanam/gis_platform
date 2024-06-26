import "../scss/style.scss";
import { Map, View } from "ol";
import $ from "jquery";
import "bootstrap";
import Point from "ol/geom/Point.js";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import TileWMS from "ol/source/TileWMS.js";
import * as olProj from "ol/proj";
import { Control, defaults as defaultControls } from "ol/control.js";
import Feature from "ol/Feature.js";
import { circular } from "ol/geom/Polygon";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";

// var init
// create map
window.jQuery = window.$ = $;
// window.JSZip = jsZip;
var currentTableIndex = 0;
var selectedFeatures = [];
var startIndex = 0;
var maxFeaturesCount = 1000;
var currentLayerNameFeatureData = undefined;
var currentLayerTitleFeatureData = undefined;
var currentLayerTotalFeatureCount = undefined;

window.mapRef = new Map({
  target: "map",
  layers: [
    new TileLayer({
      source: new OSM(),
      title: "Open Street Map",
      visible: true,
    }),
  ],
  view: new View({
    center: [-10071037.762310717, 1644842.6876604778],
    zoom: 12,
  }),
});

//myLocationlayer
const myLocationSrc = new VectorSource();
const myLocationlayer = new VectorLayer({
  source: myLocationSrc,
  title: "My Location",
});

mapRef.addLayer(myLocationlayer);

navigator.geolocation.watchPosition(
  function (pos) {
    const coords = [pos.coords.longitude, pos.coords.latitude];
    const accuracy = circular(coords, pos.coords.accuracy);
    myLocationSrc.clear(true);
    myLocationSrc.addFeatures([
      new Feature(
        accuracy.transform("EPSG:4326", mapRef.getView().getProjection())
      ),
      new Feature(new Point(olProj.fromLonLat(coords))),
    ]);
  },
  function (error) {
    console.log(`ERROR: ${error.message}`);
  },
  {
    enableHighAccuracy: true,
  }
);

//Locate me Control
const locate = document.createElement("div");
locate.className = "ol-control ol-unselectable locate ";
locate.innerHTML = '<button title="Locate me">◎</button>';
locate.addEventListener("click", function () {
  if (!myLocationSrc.isEmpty()) {
    mapRef.getView().fit(myLocationSrc.getExtent(), {
      maxZoom: 18,
      duration: 500,
    });
  }
});
mapRef.addControl(
  new Control({
    element: locate,
  })
);

$.getJSON("../config/config.json", function (data) {
  window.layerNamesListWMS = data.Layers;
  localStorage.setItem("layerNamesListWMS", JSON.stringify(data.Layers));
  window.configData = data;

  layerNamesListWMS.forEach((eachVisibleLayer) => {
    const wmsLayer = new TileLayer({
      source: new TileWMS({
        url: configData.WMSEndPoint,
        serverType: configData.ServerType,
        params: {
          LAYERS: eachVisibleLayer.name,
          TILED: true,
        },
        tileLoadFunction: authTileLoadFunction,
      }),
      title: eachVisibleLayer.title,
      visible: eachVisibleLayer.visible,
    });
    mapRef.addLayer(wmsLayer);
  });

  layerListUI();
});
mapRef.on("loadstart", function () {
  $("#progressBar").show()
})
mapRef.on("loadend", function () {
  $("#progressBar").hide()
})
// get info
mapRef.on("singleclick", function (evt) {
  $("#progressBar").show()
  const viewResolution = mapRef.getView().getResolution();

  const layers = mapRef.getAllLayers();
  var promises = [];

  layers.forEach((eachLayer) => {
    if (eachLayer.getVisible()) {
      var source = eachLayer.getSource();
      if (source instanceof TileWMS) {
        var url = source.getFeatureInfoUrl(
          evt.coordinate,
          viewResolution,
          "EPSG:3857",
          { INFO_FORMAT: "application/json", FEATURE_COUNT: "1" }
        );
      }
      if (url) {
        promises.push(
          fetch(url, {
            method: "GET",
            headers: {
              Authorization:
                "Basic " +
                btoa(
                  configData.Authrization.UserName +
                    ":" +
                    configData.Authrization.Password
                ),
            },
          }).then((response) => response.json())
        );
      }
    }
  });

  Promise.all(promises).then(function (responses) {
    //populateDropdown(responses);
    currentTableIndex = 0;
    selectedFeatures = responses;
    handleFeatureSelection(currentTableIndex);
  });
});


function handleFeatureSelection(featureId) {
  // Parse the response JSON (replace this with your actual fetch request)
  var data = selectedFeatures[featureId].features[0].properties;
  var featureSourceTable = selectedFeatures[featureId].features[0].id;

  var layerTitle = featureSourceTable.split(".")[0];
  var layerConfig = configData.Layers.find(function (layer) {
    return layer.name === layerTitle;
  });
  layerTitle = layerConfig.title;
  document.getElementById("popup-heading").innerHTML =
    "<b><u>" + layerTitle + " Record Details</u></b>";

  // // Create a new table element
  var table = document.createElement("table");
  table.classList.add("custom-table"); // Add a class for styling, if needed

  // Create table headers
  var headers = ["Property", "Value"];
  var headerRow = document.createElement("tr");
  headers.forEach(function (header) {
    var th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  Object.keys(data).forEach(function (key) {
    var tr = document.createElement("tr");
    var tdProperty = document.createElement("td");
    var tdValue = document.createElement("td");
    tdProperty.textContent = key;
    tdValue.textContent = data[key];
    tr.appendChild(tdProperty);
    tr.appendChild(tdValue);
    table.appendChild(tr);
  });
  openPopup(table);
  $("#progressBar").hide()
}

function populateDropdown(responses) {
  var dropdown = document.getElementById("featureDropdown");
  dropdown.innerHTML = "";
  responses.forEach(function (response) {
    var feature = response.features[0];
    if (feature) {
      var option = document.createElement("option");
      option.value = feature.id;
      option.textContent = feature.id;
      dropdown.appendChild(option);
    }
  });
}

function openPopup(content) {
  var popup = document.getElementById("popup");
  var popupContent = document.getElementById("popup-content");
  popupContent.innerHTML = content.outerHTML;
  popup.style.display = "block";
}

function authTileLoadFunction(tile, src) {
  var xhr = new XMLHttpRequest();
  xhr.responseType = "blob";
  xhr.open("GET", src);
  xhr.setRequestHeader(
    "Authorization",
    "Basic " +
      window.btoa(
        configData.Authrization.UserName +
          ":" +
          configData.Authrization.Password
      )
  );
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
// show list of layers and hide and show option

function layerListUI() {
  const layerList = document.getElementById("layer-list");
  var layerNamesListWMS = JSON.parse(localStorage.getItem("layerNamesListWMS"));

  layerNamesListWMS.forEach((layerName) => {
    var layerDiv = document.createElement("div");

    var showHideButton = document.createElement("button");
    showHideButton.innerHTML =
      '<i class="fas ' +
      (layerName.visible === true ? "fa-eye" : "fa-eye-slash") +
      '"></i>';
    showHideButton.id = "eye" + layerName.title;
    showHideButton.classList.add("btn");
    showHideButton.onclick = function () {
      toggleLayerVisibility(layerName.title);
    };
    layerDiv.appendChild(showHideButton);

    var featureTableButton = document.createElement("button");
    featureTableButton.id = "featureInfo" + layerName.title;
    featureTableButton.innerHTML =
      '<i class="fa fa-table" style="color:' +
      (layerName.visible === true ? "#0152b4" : "#a4a5a7") +
      '"></i>';
    featureTableButton.classList.add("btn");
    if (layerName.visible === false) {
      featureTableButton.disabled = true;
      featureTableButton.classList.add("custom-disabled-btn");
    }

    featureTableButton.onclick = function () {
      showFeatureTable(layerName.title, layerName.name);
      $("#progressBar").show()
    };
    layerDiv.appendChild(featureTableButton);

    const label = document.createElement("label");
    label.for = layerName.title;
    label.innerHTML = layerName.title;
    label.style = "margin-left: 10px;";
    layerDiv.appendChild(label);

    layerList.appendChild(layerDiv);
  });
}

function showFeatureTable(layerTitle, layerName) {
  var featureTable = document.getElementById("featureTableDataDiv");
  featureTable.innerHTML = "";

  const layers = mapRef.getAllLayers();
  var isLayerVisible = false;
  layers.forEach((eachLayer) => {
    //
    if (eachLayer.get("title") === layerTitle && eachLayer.getVisible()) {
      //
      isLayerVisible = true;
    }
  });
  if (!isLayerVisible) {
    return;
  }

  if(currentLayerNameFeatureData === undefined || currentLayerNameFeatureData != layerName){
    currentLayerNameFeatureData = layerName;
    currentLayerTitleFeatureData = layerTitle;
    startIndex = 0
  }

  console.log(layerName, " >> ",startIndex);
  var wfsUrl = "http://155.254.244.85/geoserver/guatemala/wfs";

  // Construct GetFeature request URL
  var requestUrl =
    wfsUrl +
    "?service=WFS&version=1.1.0&request=GetFeature&typeName=" +
    layerName +
    "&outputFormat=application/json&startIndex="+startIndex+"&maxFeatures="+maxFeaturesCount;

  // Send GetFeature request
  fetch(requestUrl, {
    method: "GET",
    headers: {
      Authorization:
        "Basic " +
        btoa(
          configData.Authrization.UserName +
            ":" +
            configData.Authrization.Password
        ),
    }
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      //Create table element
      const table = generateAndPopulateDataTable(data.features);
      featureTable.append(table[0]);
      new DataTable("#featureTable", {
        scrollX: true,
        paging:false,
        scrollY: 200,
        layout: {
          topStart: {
            buttons: [
              // "pageLength",
              {
                extend: 'collection',
                text: 'Export',
                buttons: ['copy', 'excel', 'csv']
            },
            "colvis"
              
            ],
          },
        },
      });

      currentLayerTotalFeatureCount = data.totalFeatures;
      ft_prevButton.disabled = (startIndex === 0) ? true : false;
      ft_nextButton.disabled = (currentLayerTotalFeatureCount - (startIndex+maxFeaturesCount) < 0) ? true : false;

      var remainingFeatureCount = currentLayerTotalFeatureCount - (startIndex+maxFeaturesCount);
      if(remainingFeatureCount <=0){
        remainingFeatureCount = currentLayerTotalFeatureCount ;
      }else{
        remainingFeatureCount = startIndex+maxFeaturesCount;
      }
      // change feature table info message
      $("#featureTable_info").text("Showing "+(startIndex+1)+" to "+(remainingFeatureCount)+" of "+currentLayerTotalFeatureCount+" features");
      
      // Show table
      $("#featureTableDiv").show();
      $("#progressBar").hide()

    });
}

function generateAndPopulateDataTable(data) {
  // Create a new table element
  var table = $("<table>")
    .attr("id", "featureTable")
    .addClass("display")
    .addClass("custom-table");

  // Create table header
  var thead = $("<thead>").appendTo(table);
  var headerRow = $("<tr>").appendTo(thead);
  Object.keys(data[0].properties).forEach(function (key) {
    $("<th>").text(key).appendTo(headerRow);
  });

  // Create table body
  var tbody = $("<tbody>").appendTo(table);
  data.forEach(function (item) {
    var row = $("<tr>").appendTo(tbody);
    Object.values(item.properties).forEach(function (value) {
      $("<td>").text(value).appendTo(row);
    });
  });

  return table;
}

function toggleFeatureTableDivVisibility() {
  var featureTableDataDiv = document.getElementById("featureTableDataDiv");
  var featureTableDatabuttonsDiv = document.getElementById("ft_buttons");
  if (featureTableDataDiv.style.display === "none") {
    featureTableDataDiv.style.display = "block";
    featureTableDatabuttonsDiv.style.display = "block";
  } else {
    featureTableDataDiv.style.display = "none";
    featureTableDatabuttonsDiv.style.display = "none";
  }
}

function toggleLayerVisibility(layerId) {
  const layers = mapRef.getAllLayers();
  var eyeIcon = document.getElementById("eye" + layerId);
  var featureTableButton = document.getElementById("featureInfo" + layerId);

  layers.forEach((eachLayer) => {
    if (eachLayer.get("title") === layerId) {
      if (eachLayer.getVisible()) {
        eachLayer.setVisible(false);
        eyeIcon.innerHTML = '<i class="fas fa-eye-slash"></i>';
        featureTableButton.innerHTML =
          '<i class="fa fa-table" style="color:#a4a5a7"></i>';
        featureTableButton.disabled = true;
        featureTableButton.classList.add("custom-disabled-btn");
      } else {
        eachLayer.setVisible(true);
        eyeIcon.innerHTML = '<i class="fas fa-eye"></i>';
        featureTableButton.innerHTML =
          '<i class="fa fa-table" style="color:#0152b4"></i>';
        featureTableButton.disabled = false;
        featureTableButton.classList.remove("custom-disabled-btn");
      }
    }
  });
}

$("#ic-layers").on("click", function () {
  $("#layerGroupDiv").toggle();
});
$("#ic-settings").on("click", function () {
  $("#settingTab").toggle();
});

window.closeTab = function closeTab(evt) {
  evt.parentElement.style.display = "none";
};

var prevButton = document.getElementById("popup-prev-btn");
prevButton.addEventListener("click", function () {
  currentTableIndex = Math.max(0, currentTableIndex - 1);
  handleFeatureSelection(currentTableIndex);

  if(selectedFeatures.length > currentTableIndex){
    nextButton.disabled = false;
  }

  if(currentTableIndex === 0){
    prevButton.disabled = true;
  }

});

var nextButton = document.getElementById("popup-next-btn");
nextButton.addEventListener("click", function () {
  currentTableIndex = Math.min(
    selectedFeatures.length - 1,
    currentTableIndex + 1
  );
  if(selectedFeatures.length-1 === currentTableIndex){
    nextButton.disabled = true;
  }
  if(currentTableIndex > 0){
    prevButton.disabled = false;
  }
  handleFeatureSelection(currentTableIndex);
});

var featureTableDivButton = document.getElementById("featureTableDivButton");
featureTableDivButton.onclick = function () {
  toggleFeatureTableDivVisibility();
  if (
    featureTableDivButton.innerHTML ===
    '<i class="fas fa-arrow-up" style="transform:rotate(180deg)"></i>'
  ) {
    featureTableDivButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
  } else {
    featureTableDivButton.innerHTML =
      '<i class="fas fa-arrow-up" style="transform:rotate(180deg)"></i>';
  }
};

var popupElement = document.getElementById("popup");
var popupHeader = document.getElementById("popup-header");
popupElement.style.cursor = "move";
popupElement.addEventListener("mousedown", function (e) {
  e.preventDefault();
  var initialX = e.clientX - popupElement.offsetLeft;
  var initialY = e.clientY - popupElement.offsetTop;
  function onMouseMove(e) {
    popupElement.style.left = e.clientX - initialX + "px";
    popupElement.style.top = e.clientY - initialY + "px";
  }
  function onMouseUp(e) {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
});

// Close the popup on load
var closeBtn = document.getElementById("closeBtn");
closeBtn.addEventListener("click", function () {
  document.getElementById("popup").style.display = "none";
});


$("#featureTableDivCloseBtn").on("click", function () {
  $("#featureTableDiv").hide();
})

var ft_prevButton = document.getElementById("ft_prevButton");
ft_prevButton.onclick  = function() {
  if(startIndex !== 0 || (startIndex - maxFeaturesCount >= 0)){
    startIndex = startIndex - maxFeaturesCount;
  }
  showFeatureTable(currentLayerTitleFeatureData, currentLayerNameFeatureData);
};

var ft_nextButton = document.getElementById("ft_nextButton");
ft_nextButton.onclick = function() {
  if(currentLayerTotalFeatureCount > startIndex+maxFeaturesCount){
    startIndex = startIndex + maxFeaturesCount;
  }
  showFeatureTable(currentLayerTitleFeatureData, currentLayerNameFeatureData);
};