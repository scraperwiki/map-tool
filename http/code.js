String.prototype.startsWith = function (str){
  return this.slice(0, str.length) == str
}

String.prototype.endsWith = function (str){
  return this.slice(-str.length) == str
}

Array.prototype.toLowerCase = function(){
  newArray = []
  for(var i=0; i<this.length; i++) {
    if(this[i].toLowerCase){
      newArray.push(this[i].toLowerCase())
    } else {
      newArray.push(this[i])
    }
  }
  return newArray
}


function sqlEscape(str, literal) {
  if(literal){
    // Set literal to true for strings you're inserting into a table.
    quote = "'"
    singleQuote = "''"
    doubleQuote = '"'
  } else {
    // Set literal to false for column and table names.
    quote = '"'
    singleQuote = "'"
    doubleQuote = '""'
  }
  if(str === '' || str === null){
    return 'NULL'
  } else if(isNaN(str)){
    str = str.replace(/[']/g, singleQuote)
    str = str.replace(/["]/g, doubleQuote)
    return quote + str + quote
  } else {
    return str
  }
}


function detectColumns(){
  scraperwiki.sql.meta(function(meta){
    if(meta.table.length == 0){
      $('#loading, #overlay').fadeOut()
      scraperwiki.alert('This dataset is empty',
        'Try running this tool again once you&rsquo;ve got some data.')
      return false
    }

    $('#loading').html('<img src="img/loader-666-fff.gif" width="16" height="16"> Detecting geo data')
    
    bestGeoTable = null
    $.each(meta.table, function(tableName, tableInfo){
      if(tableName.startsWith('_')){ return true }
      var columnsInThisTable = []
      $.each(tableInfo.columnNames, function(i, columnName){
        if(!columnName.startsWith('_')){
          columnsInThisTable.push(columnName)
        }
      })
      var geoTable = findGeoTable(columnsInThisTable)
      if(geoTable) {
        geoTable.name = tableName
        bestGeoTable = geoTable
      } else {
        return true
      }
    })

    if(bestGeoTable) {
      if(bestGeoTable.geometry == "Point") {
        showPoints(bestGeoTable)
      } else if(bestGeoTable.geometry == "Polygon") {
        showPolygons(bestGeoTable)
      }
    } else {
      $('#loading').hide()
      showPicker(meta)
    }
  }, function(){
    $('#loading, #overlay').fadeOut()
    scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql.meta() failed', 1)
  })
}

// Fetch point data from table, and show it.
function showPoints(geoTable) {
  var table = geoTable.name
  var latitudeColumn = geoTable.latitudeColumn
  var longitudeColumn = geoTable.longitudeColumn
  scraperwiki.sql('SELECT * FROM '+ sqlEscape(table) +
    ' WHERE '+ sqlEscape(latitudeColumn) + ' IS NOT NULL AND ' +
    sqlEscape(longitudeColumn) + ' IS NOT NULL', function(data){
    plotPointsOnMap(data,
      {latColumnName: latitudeColumn, lngColumnName: longitudeColumn})
  }, function(){
    $('#loading, #overlay').fadeOut()
    scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql() failed', 1)
    return false
  })
}

function plotPolygonsOnMap(data, geoTable) {
  $('#loading').empty().fadeOut()
  $('#overlay, #picker').fadeOut()
  // :todo:(drj) this should not bake in the names
  // of the unique columns
  var polys = _.values(_.groupBy(data, function(row) {
      return String([row.feature_index, row.polygon_index])
    }))

  var convertPoly1 = function(l) {
    // Convert a single polygon (which is a list), to
    // a list of [lat,lon] pairs.
    return _.map(l, function(row) {
      return [row[geoTable.latitudeColumn], row[geoTable.longitudeColumn]]
    })
  }
  // The polygons, each one as a list of [lat,lon] pairs.
  var asPoints = _.map(polys, convertPoly1)
  _.each(asPoints, function(p) {
    var leaflet_polygon = L.polygon(p)
    map.addLayer(leaflet_polygon)
  })
}

// Fetch polygon data from table, and show it.
function showPolygons(geoTable) {
  var table = geoTable.name
  var uniqueKey = geoTable.polygonColumns
  var pointColumn = geoTable.pointColumn
  var allColumns = [
    geoTable.latitudeColumn,
    geoTable.longitudeColumn,
    pointColumn
    ] + uniqueKey
  // The text for the WHERE part of the SQL query, which is a
  // load of "IS NOT NULL".
  var isNotNulls = $.map(allColumns, function(col, i) {
    return sqlEscape(col) + ' IS NOT NULL'}).join(" AND ")
  // The text for the ORDER BY part of the SQL query.
  var orderBys = $.map(uniqueKey + [pointColumn], sqlEscape).join(", ")
  // Error callback.
  var gotError = function(){
    $('#loading, #overlay').fadeOut()
    scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql() failed', 1)
    return false
  }
  scraperwiki.sql('SELECT * FROM ' + sqlEscape(table) +
    ' WHERE ' + isNotNulls +
    ' ORDER BY ' + orderBys,
    function(data) {
      return plotPolygonsOnMap(data, geoTable)},
    gotError)
}


// Given a list of column names, return a struct describing the
// GeoData nature of the table. If the table does not contain
// GeoData then null is returned. But if the table does
// contain GeoData then a struct t is returned where
// t.geometry is "Point" if the table contains points, and
//   "Polygon" if the table contains polygons.
// t.latitudeColumn is the name of the column containing latitudes.
// t.longitudeColumn is the name of the column containing longitudes.
// t.polygonColumns is a list of names that uniquely identify a
//   polygon (for example, ['feature_index', 'polygon_index']
//   for GeoJSON derived multipolygon geometries).
// t.pointColumn is the name of the column containing the point index.
// The last 2 properties are only present when t.geometry is "Polygon".
function findGeoTable(columns){
  var result = {}
  var l = columns.toLowerCase()
  var poly, feat, point

  poly = l.indexOf('polygon_index')
  feat = l.indexOf('feature_index')
  point = l.indexOf('point_index')
  if(poly > -1 && feat > -1 && point > -1) {
    result.geometry = "Polygon"
    result.polygonColumns = [columns[feat], columns[poly]]
    result.pointColumn = columns[point]
  }

  // The index of the column that might be a latitude.
  var lat
  lat = l.indexOf('latitude')
  if(lat < 0) {
    lat = l.indexOf('lat')
  }
  // The index of the column that might be a longitude.
  var lon
  lon = l.indexOf('longitude')
  if(lon < 0) {
    lon = l.indexOf('long')
  }
  if(lon < 0) {
    lon = l.indexOf('lon')
  }
  if(lon < 0) {
    lon = l.indexOf('lng')
  }

  if(lat < 0 || lon < 0) {
    return null
  }

  result.latitudeColumn = columns[lat]
  result.longitudeColumn = columns[lon]
  if(!result.geometry) {
    result.geometry = "Point"
  }
  return result
}


// Required: option.latColumnName, option.lngColumnName
// Optional: option.clrColumnName
function plotPointsOnMap(data, option){
  option = option || {}
  option.clrColumnName = option.clrColumnName || 'colour'
  $('#loading').empty().fadeOut()
  $('#overlay, #picker').fadeOut()
  var bounds = []
  var group = L.markerClusterGroup({"maxClusterRadius": 17})
  $.each(data, function(i, point){
    var lat = point[option.latColumnName]
    var lng = point[option.lngColumnName]
    if(typeof(lat) == 'number' && typeof(lng) == 'number'){
      var latLng = [ lat, lng ]
      var popupContent = '<table class="table table-striped">'
      $.each(point, function(key, value){
        if(typeof(value) == 'string') {
          if(value.startsWith('http')){
            value = '<a target="_blank" href="' + value + '">' +
              value.replace(new RegExp('(https?://.{30}).+'), '$1&hellip;')
              + '</a>'
          } else if(value.length > 200){
            value = value.slice(0, 199) + '&hellip;'
          }
        }
        popupContent += '<tr><th>' + key + '</th><td>' + value + '</td></tr>'
      })
      popupContent += '</table>'
      var opt = {}
      var clr = point[option.clrColumnName]
      if(/[0-9a-f]{6}/i.test(clr)) {
        opt.icon = L.icon({
          iconUrl: 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|' + clr,
          iconAnchor: [11, 34]
        })
      }
      L.marker(latLng, opt).bindPopup(popupContent, {maxWidth: 450})
        .addTo(group)
      bounds.push(latLng)
    }
  })
  if(bounds.length){
    map.addLayer(group)
    map.fitBounds(bounds)
  } else {
    scraperwiki.alert('Data could not be geocoded', 'Are you sure the selected Latitude and Longitude columns are numeric?', 1)
  }
  return true
}


function showPicker(meta){
  var $picker = $('<div id="picker">').insertBefore('#overlay')
  $picker.append('<h1>Hmm. I couldn&rsquo;t find any geo data</h1>')
  $picker.append('<p>Could you give me a hand and point out the right columns?</p>')
  var $select = $('<select>')
  $.each(meta.table, function(tableName, tableInfo){
    if(!tableName.startsWith('_')){
      var $optgroup = $('<optgroup>').attr('label', tableName)
      $.each(tableInfo.columnNames, function(i, columnName){
        if(!columnName.startsWith('_')){
          $('<option>').text(columnName).val(columnName).appendTo($optgroup)
        }
      })
      $optgroup.appendTo($select)
    }
  })
  $('<p>').append('<label for="latPicker">Latitude:</label>').append($select.clone().attr('id', 'latPicker')).appendTo($picker)
  $('<p>').append('<label for="lngPicker">Longitude:</label>').append($select.clone().attr('id', 'lngPicker')).appendTo($picker)
  $('<p>').append(
    $('<button>').text('Make it so!').addClass('btn btn-primary').on('click', function(){
      var latColumn = $('#latPicker option:selected').val()
      var latTable = $('#latPicker option:selected').parent().attr('label')
      var lngColumn = $('#lngPicker option:selected').val()
      var lngTable = $('#lngPicker option:selected').parent().attr('label')
      if(latTable != lngTable){
        $('#picker p').eq(0).addClass('text-error').html('Oops. Those two columns aren&rsquo;t in the same table. Try again.')
      } else if(latColumn == lngColumn) {
        $('#picker p').eq(0).addClass('text-error').html('Oops. You picked the same column twice. Try again.')
      } else {
        $(this).addClass('loading').text('Plotting map\u2026')
        scraperwiki.sql('select * from "'+ latTable +'"', function(data){
          plotPointsOnMap(data,
            {latColumnName: latColumn, lngColumnName: lngColumn})
        }, function(){
          $('#picker, #overlay').fadeOut()
          scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql() failed', 1)
          return false
        })
      }
    })
  ).appendTo($picker)
}


// Don't bother waiting for DOM to load.
// It'll be ready by the time the API has responded.
var map = null
detectColumns()


$(function(){

  // DOM is ready. Create map.
  map = L.map('map').setView([53.4167, -3], 8)
  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

});
