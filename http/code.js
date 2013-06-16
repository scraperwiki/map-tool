String.prototype.startsWith = function (str){
  return this.slice(0, str.length) == str
}

String.prototype.endsWith = function (str){
  return this.slice(-str.length) == str
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
        return false
      }
    })
    if(bestTable && bestLatColumn && bestLngColumn){
      scraperwiki.sql('select * from "'+ bestTable +'"', function(data){
        plotDataOnMap(data, bestLatColumn, bestLngColumn)
      }, function(){
        $('#loading, #overlay').fadeOut()
        scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql() failed', 1)
        return false
      })
    } else {
      $('#loading, #overlay').fadeOut()
      scraperwiki.alert('Could not find geo information', 'Are you sure your dataset contains latitude and longitude information?')
    }
  }, function(){
    $('#loading, #overlay').fadeOut()
    scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql.meta() failed', 1)
  })
}


function findLatLngColumns(list){
  if($.inArray('lat', list) > -1 && $.inArray('lng', list) > -1){
    return ['lat', 'lng']
  } else if($.inArray('lat', list) > -1 && $.inArray('long', list) > -1){
    return ['lat', 'long']
  } else if($.inArray('lat', list) > -1 && $.inArray('lon', list) > -1){
    return ['lat', 'lon']
  } else if($.inArray('latitude', list) > -1 && $.inArray('longitude', list) > -1){
    return ['latitude', 'longitude']
  } else {
    return []
  }
}


function plotDataOnMap(data, latColumnName, lngColumnName){
  $('#loading').empty().fadeOut()
  $('#overlay').fadeOut()
  var bounds = []
  $.each(data, function(i, point){
    if(point[latColumnName] != null && point[lngColumnName] != null){
      var latLng = [ point[latColumnName], point[lngColumnName] ]
      var popupContent = '<table class="table table-striped">'
      $.each(point, function(key, value){
        if(typeof(value) == 'string'){
          if(value.startsWith('http')){
            value = '<a target="_blank" href="' + value + '">' + value.replace(new RegExp('(https?://.{40}).+'), '$1&hellip;') + '</a>'
          } else if(value.length > 200){
            value = value.slice(0, 199) + '&hellip;'
          }
        }
        popupContent += '<tr><th>' + key + '</th><td>' + value + '</td></tr>'
      })
      popupContent += '</table>'
      L.marker(latLng).bindPopup(popupContent, {maxWidth: 450}).addTo(map)
      bounds.push(latLng)
    }
  })
  map.fitBounds(bounds)
  return true
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
