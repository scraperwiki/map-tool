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
    quote = "'" // set literal to true for strings you're inserting into a table
    singleQuote = "''"
    doubleQuote = '"'
  } else {
    quote = '"' // set literal to false for column and table names
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
      scraperwiki.alert('This dataset is empty', 'Try running this tool again once you&rsquo;ve got some data.')
      return false
    }

    $('#loading').html('<img src="img/loader-666-fff.gif" width="16" height="16"> Detecting geo data')
    var bestTable = null
    var bestLatColumn = null
    var bestLngColumn = null
    
    $.each(meta.table, function(tableName, tableInfo){
      if(tableName.startsWith('_')){ return true }
      var columnsInThisTable = []
      $.each(tableInfo.columnNames, function(i, columnName){
        if(!columnName.startsWith('_')){
          columnsInThisTable.push(columnName)
        }
      })
      var latLngColumns = findLatLngColumns(columnsInThisTable)
      if(latLngColumns.length){
        bestTable = tableName
        bestLatColumn = latLngColumns[0]
        bestLngColumn = latLngColumns[1]
      } else {
        return true
      }
    })
    if(bestTable && bestLatColumn && bestLngColumn){
      scraperwiki.sql('SELECT * FROM '+ sqlEscape(bestTable) +' WHERE '+ sqlEscape(bestLatColumn) +' IS NOT NULL AND '+ sqlEscape(bestLngColumn) +' IS NOT NULL', function(data){
        plotDataOnMap(data,
          {latColumnName: bestLatColumn, lngColumnName: bestLngColumn})
      }, function(){
        $('#loading, #overlay').fadeOut()
        scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql() failed', 1)
        return false
      })
    } else {
      $('#loading').hide()
      showPicker(meta)
    }
  }, function(){
    $('#loading, #overlay').fadeOut()
    scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql.meta() failed', 1)
  })
}


function findLatLngColumns(list){
  m = list.toLowerCase()
  if(m.indexOf('lat') > -1 && m.indexOf('lng') > -1){
    return [ list[m.indexOf('lat')], list[m.indexOf('lng')] ]
  } else if(m.indexOf('lat') > -1 && m.indexOf('long') > -1){
    return [ list[m.indexOf('lat')], list[m.indexOf('long')] ]
  } else if(m.indexOf('lat') > -1 && m.indexOf('lon') > -1){
    return [ list[m.indexOf('lat')], list[m.indexOf('lon')] ]
  } else if(m.indexOf('latitude') > -1 && m.indexOf('longitude') > -1){
    return [ list[m.indexOf('latitude')], list[m.indexOf('longitude')] ]
  } else {
    return []
  }
}


// Required: option.latColumnName, option.lngColumnName
// Optional: option.clrColumnName
function plotDataOnMap(data, option){
  option = option || {}
  option.clrColumnName = option.clrColumnName || 'colour'
  $('#loading').empty().fadeOut()
  $('#overlay, #picker').fadeOut()
  var bounds = []
  var group = L.markerClusterGroup({"maxClusterRadius": 17})
  var cfg = {
  // radius should be small ONLY if scaleRadius is true (or small radius is intended)
  // if scaleRadius is false it will be the constant radius used in pixels
  "radius": 10,
  "maxOpacity": .8, 
  // scales the radius based on map zoom
  "scaleRadius": false, 
  // if set to false the heatmap uses the global maximum for colorization
  // if activated: uses the data maximum within the current map boundaries 
  //   (there will always be a red spot with useLocalExtremas true)
  "useLocalExtrema": true,
  // which field name in your data represents the latitude - default "lat"
  latField: 'lat',
  // which field name in your data represents the longitude - default "lng"
  lngField: 'lng',
  // which field name in your data represents the data value - default "value"
  valueField: 'count'
  };
  var heatmapLayer = new HeatmapOverlay(cfg);
  var heatmap_points = [];
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
      //L.marker({lat: lat, lng: lng, count: 1}).addTo(heatmapLayer)
      heatmap_points.push({lat: lat, lng: lng, count: 1})
      bounds.push(latLng)
    }
  })
  if(bounds.length){
    //map.addLayer(group)
    map.addLayer(heatmapLayer)
    //console.log ( 'We got here fine' + heatmap_points.length)
    heatmapLayer.setData({max:8, data: heatmap_points})
    
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
          plotDataOnMap(data,
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
